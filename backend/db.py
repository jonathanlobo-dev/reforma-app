"""Persistencia: trabajos + cuota diaria por dispositivo.

Dos backends según config:
  - Postgres (Supabase)  si DATABASE_URL está seteado  → persiste en producción.
  - SQLite local         si no                          → solo dev.

La cuota es el control de costos (lección CatchCat): se consulta ANTES de
llamar a Replicate. Sin login: el cliente manda un device_id (UUID local).
"""
import time
import uuid
from datetime import date

import config

# ─── Backend de base de datos ────────────────────────────────────────────────
# PH = placeholder de parámetros según el motor (%s en Postgres, ? en SQLite).
if config.USA_POSTGRES:
    import psycopg
    from psycopg.rows import dict_row
    PH = "%s"

    def _con():
        # prepare_threshold=None → sin prepared statements: compatible con el
        # pooler en modo "transaction" de Supabase (puerto 6543).
        return psycopg.connect(config.DATABASE_URL, row_factory=dict_row,
                               prepare_threshold=None)
else:
    import sqlite3
    PH = "?"

    def _con():
        con = sqlite3.connect(config.DB_PATH, timeout=30)
        con.row_factory = sqlite3.Row
        return con


_TABLAS = [
    """CREATE TABLE IF NOT EXISTS trabajos (
        id TEXT PRIMARY KEY, device_id TEXT NOT NULL, categoria TEXT NOT NULL,
        detalle TEXT, tipo TEXT NOT NULL, status TEXT NOT NULL, error TEXT,
        antes TEXT, despues TEXT, comparacion TEXT, video TEXT,
        creado DOUBLE PRECISION, actualizado DOUBLE PRECISION)""",
    """CREATE TABLE IF NOT EXISTS uso (
        device_id TEXT, fecha TEXT, imagenes INTEGER DEFAULT 0, videos INTEGER DEFAULT 0,
        PRIMARY KEY (device_id, fecha))""",
    """CREATE TABLE IF NOT EXISTS uso_global (
        fecha TEXT PRIMARY KEY, videos INTEGER DEFAULT 0)""",
    """CREATE TABLE IF NOT EXISTS feedback (
        trabajo_id TEXT PRIMARY KEY, voto INTEGER NOT NULL,
        creado DOUBLE PRECISION)""",
    """CREATE TABLE IF NOT EXISTS uso_ip (
        ip TEXT, fecha TEXT, imagenes INTEGER DEFAULT 0, videos INTEGER DEFAULT 0,
        chats INTEGER DEFAULT 0, PRIMARY KEY (ip, fecha))""",
    # Premium: device_id → epoch hasta cuándo tiene premium (0/pasado = free).
    """CREATE TABLE IF NOT EXISTS premium (
        device_id TEXT PRIMARY KEY, hasta DOUBLE PRECISION, plan TEXT,
        actualizado DOUBLE PRECISION)""",
]

# Columnas añadidas después del despliegue inicial: (tabla, columna, tipo)
_MIGRACIONES = [
    ("uso", "chats", "INTEGER DEFAULT 0"),
    ("trabajos", "oculto", "INTEGER DEFAULT 0"),
    ("trabajos", "proyecto", "TEXT"),
    ("trabajos", "limpio", "TEXT"),  # resultado SIN marca de agua (para encadenar)
]


def _q(sql: str) -> str:
    """Adapta placeholders y tipos: en SQLite usamos ? y evitamos DOUBLE PRECISION."""
    if config.USA_POSTGRES:
        return sql
    return sql.replace("%s", "?").replace("DOUBLE PRECISION", "REAL")


def init() -> None:
    with _con() as con:
        cur = con.cursor()
        for t in _TABLAS:
            cur.execute(_q(t))
        con.commit()
    # Migraciones de columnas sobre tablas ya desplegadas.
    for tabla, col, tipo in _MIGRACIONES:
        try:
            with _con() as con:
                cur = con.cursor()
                if config.USA_POSTGRES:
                    cur.execute(f"ALTER TABLE {tabla} ADD COLUMN IF NOT EXISTS {col} {tipo}")
                else:
                    cur.execute(f"ALTER TABLE {tabla} ADD COLUMN {col} {tipo}")
                con.commit()
        except Exception:
            pass  # SQLite sin IF NOT EXISTS: si ya existe, lanza y se ignora

    # Seguridad (solo Postgres/Supabase): activar Row-Level Security en todas
    # nuestras tablas. El backend usa el rol `postgres` del pooler, que IGNORA
    # RLS, así que sigue funcionando; pero la API REST pública (anon key) queda
    # bloqueada. Sin políticas = deny-all para roles no privilegiados.
    # Idempotente: ENABLE no falla si ya estaba activo.
    # NO usar FORCE: el backend se conecta como el rol dueño de las tablas y
    # FORCE lo sujetaría a RLS (sin políticas = bloqueo total → backend caído).
    # Con solo ENABLE, el dueño sigue accediendo y la API REST anon queda fuera.
    if config.USA_POSTGRES:
        for tabla in ("trabajos", "uso", "uso_global", "feedback", "uso_ip"):
            try:
                with _con() as con:
                    cur = con.cursor()
                    cur.execute(f"ALTER TABLE {tabla} ENABLE ROW LEVEL SECURITY")
                    con.commit()
            except Exception:
                pass


# ─── Cuota ───────────────────────────────────────────────────────────────────

def es_premium(device_id: str) -> bool:
    with _con() as con:
        cur = con.cursor()
        cur.execute(_q(f"SELECT hasta FROM premium WHERE device_id={PH}"), (device_id,))
        fila = cur.fetchone()
        return bool(fila and fila["hasta"] and fila["hasta"] > time.time())


def estado_premium(device_id: str) -> dict:
    with _con() as con:
        cur = con.cursor()
        cur.execute(_q(f"SELECT hasta, plan FROM premium WHERE device_id={PH}"), (device_id,))
        fila = cur.fetchone()
    activo = bool(fila and fila["hasta"] and fila["hasta"] > time.time())
    return {"premium": activo,
            "hasta": (fila["hasta"] if fila else None),
            "plan": (fila["plan"] if fila else None)}


def activar_premium(device_id: str, hasta: float, plan: str = "") -> None:
    """La llamará la integración de pagos (RevenueCat) tras validar la compra."""
    with _con() as con:
        cur = con.cursor()
        cur.execute(_q(
            "INSERT INTO premium (device_id, hasta, plan, actualizado) "
            f"VALUES ({PH},{PH},{PH},{PH}) "
            "ON CONFLICT(device_id) DO UPDATE SET hasta=EXCLUDED.hasta, "
            "plan=EXCLUDED.plan, actualizado=EXCLUDED.actualizado"),
            (device_id, hasta, plan, time.time()))
        con.commit()


def puede_generar(device_id: str, tipo: str) -> tuple[bool, str]:
    hoy = date.today().isoformat()
    premium = es_premium(device_id)
    lim_img = config.IMAGENES_PREMIUM_DIA if premium else config.IMAGENES_GRATIS_DIA
    lim_vid = config.VIDEOS_PREMIUM_DIA if premium else config.VIDEOS_GRATIS_DIA
    with _con() as con:
        cur = con.cursor()
        cur.execute(_q(f"SELECT imagenes, videos FROM uso WHERE device_id={PH} AND fecha={PH}"),
                    (device_id, hoy))
        fila = cur.fetchone()
        img = fila["imagenes"] if fila else 0
        vid = fila["videos"] if fila else 0
        if tipo == "imagen" and img >= lim_img:
            extra = "" if premium else " Hazte Premium para más."
            return False, f"Llegaste al límite de {lim_img} imágenes por hoy.{extra}"
        if tipo == "video":
            if vid >= lim_vid:
                if premium:
                    return False, f"Llegaste al límite de {lim_vid} video(s) por hoy."
                return False, ("Los videos son Premium. Hazte Premium para desbloquearlos."
                               if lim_vid == 0 else
                               f"Llegaste a tu límite de {lim_vid} video(s) por hoy. Hazte Premium para más.")
            cur.execute(_q(f"SELECT videos FROM uso_global WHERE fecha={PH}"), (hoy,))
            g = cur.fetchone()
            if g and g["videos"] >= config.VIDEOS_GLOBAL_DIA:
                return False, "El sistema alcanzó su límite diario de videos. Intenta mañana."
    return True, ""


def puede_chatear(device_id: str) -> tuple[bool, str]:
    hoy = date.today().isoformat()
    with _con() as con:
        cur = con.cursor()
        cur.execute(_q(f"SELECT chats FROM uso WHERE device_id={PH} AND fecha={PH}"),
                    (device_id, hoy))
        fila = cur.fetchone()
        chats = (fila["chats"] if fila and fila["chats"] is not None else 0)
        if chats >= config.ASESOR_MENSAJES_DIA:
            return False, f"El Maestro descansa: llegaste a los {config.ASESOR_MENSAJES_DIA} mensajes de hoy. Vuelve mañana."
    return True, ""


# ─── Tope por IP (defensa contra device_id falsificados) ────────────────────

_TOPES_IP = {"imagenes": ("IMAGENES_IP_DIA",), "videos": ("VIDEOS_IP_DIA",),
             "chats": ("CHATS_IP_DIA",)}


def puede_ip(ip: str, col: str) -> bool:
    """col: 'imagenes' | 'videos' | 'chats'."""
    if not ip:
        return True
    tope = getattr(config, _TOPES_IP[col][0])
    hoy = date.today().isoformat()
    with _con() as con:
        cur = con.cursor()
        cur.execute(_q(f"SELECT {col} FROM uso_ip WHERE ip={PH} AND fecha={PH}"), (ip, hoy))
        fila = cur.fetchone()
        usado = (fila[col] if fila and fila[col] is not None else 0)
        return usado < tope


def registrar_ip(ip: str, col: str) -> None:
    if not ip:
        return
    hoy = date.today().isoformat()
    with _con() as con:
        cur = con.cursor()
        cur.execute(_q(
            f"INSERT INTO uso_ip (ip, fecha, {col}) VALUES ({PH},{PH},1) "
            f"ON CONFLICT(ip, fecha) DO UPDATE SET {col}=COALESCE(uso_ip.{col},0)+1"),
            (ip, hoy))
        con.commit()


def registrar_chat(device_id: str) -> None:
    hoy = date.today().isoformat()
    with _con() as con:
        cur = con.cursor()
        cur.execute(_q(
            f"INSERT INTO uso (device_id, fecha, chats) VALUES ({PH},{PH},1) "
            f"ON CONFLICT(device_id, fecha) DO UPDATE SET chats=COALESCE(uso.chats,0)+1"),
            (device_id, hoy))
        con.commit()


def registrar_uso(device_id: str, tipo: str) -> None:
    hoy = date.today().isoformat()
    col = "imagenes" if tipo == "imagen" else "videos"
    with _con() as con:
        cur = con.cursor()
        cur.execute(_q(
            f"INSERT INTO uso (device_id, fecha, {col}) VALUES ({PH},{PH},1) "
            f"ON CONFLICT(device_id, fecha) DO UPDATE SET {col}=uso.{col}+1"),
            (device_id, hoy))
        if tipo == "video":
            cur.execute(_q(
                f"INSERT INTO uso_global (fecha, videos) VALUES ({PH},1) "
                f"ON CONFLICT(fecha) DO UPDATE SET videos=uso_global.videos+1"), (hoy,))
        con.commit()


# ─── Trabajos ────────────────────────────────────────────────────────────────

def crear_trabajo(device_id: str, categoria: str, detalle: str, tipo: str,
                  proyecto: str = "") -> str:
    tid = uuid.uuid4().hex
    ahora = time.time()
    with _con() as con:
        cur = con.cursor()
        cur.execute(_q(
            "INSERT INTO trabajos (id, device_id, categoria, detalle, tipo, status, proyecto, creado, actualizado)"
            f" VALUES ({PH},{PH},{PH},{PH},{PH},'pending',{PH},{PH},{PH})"),
            (tid, device_id, categoria, detalle, tipo, proyecto or None, ahora, ahora))
        con.commit()
    return tid


def actualizar(tid: str, **campos) -> None:
    campos["actualizado"] = time.time()
    sets = ", ".join(f"{k}={PH}" for k in campos)
    with _con() as con:
        cur = con.cursor()
        cur.execute(_q(f"UPDATE trabajos SET {sets} WHERE id={PH}"), (*campos.values(), tid))
        con.commit()


def obtener(tid: str) -> dict | None:
    with _con() as con:
        cur = con.cursor()
        cur.execute(_q(f"SELECT * FROM trabajos WHERE id={PH}"), (tid,))
        fila = cur.fetchone()
        return dict(fila) if fila else None


def listar(device_id: str, limit: int = 30) -> list[dict]:
    with _con() as con:
        cur = con.cursor()
        cur.execute(_q(
            f"SELECT * FROM trabajos WHERE device_id={PH} AND status='done' "
            f"AND COALESCE(oculto,0)=0 ORDER BY creado DESC LIMIT {PH}"),
            (device_id, limit))
        return [dict(f) for f in cur.fetchall()]


def ocultar(tid: str, device_id: str) -> bool:
    """Borrado lógico del historial (solo el dueño del trabajo)."""
    with _con() as con:
        cur = con.cursor()
        cur.execute(_q(f"UPDATE trabajos SET oculto=1 WHERE id={PH} AND device_id={PH}"),
                    (tid, device_id))
        con.commit()
        return cur.rowcount > 0


def votar(tid: str, voto: int) -> None:
    with _con() as con:
        cur = con.cursor()
        cur.execute(_q(
            f"INSERT INTO feedback (trabajo_id, voto, creado) VALUES ({PH},{PH},{PH}) "
            f"ON CONFLICT(trabajo_id) DO UPDATE SET voto={PH}"),
            (tid, voto, time.time(), voto))
        con.commit()
