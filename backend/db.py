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

    class _ConCerrable(sqlite3.Connection):
        """El context manager de sqlite3 hace commit/rollback pero NO cierra la
        conexión → fuga de file descriptors con el tiempo. Este cierra al salir."""
        def __exit__(self, *exc):
            try:
                super().__exit__(*exc)
            finally:
                self.close()

    def _con():
        con = sqlite3.connect(config.DB_PATH, timeout=30, factory=_ConCerrable)
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
    ("trabajos", "lang", "TEXT"),    # idioma del usuario al crear el trabajo (es/en/pt/it)
    ("trabajos", "thumb", "TEXT"),   # miniatura liviana para la grilla de Recientes
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
    if device_id in config.ADMIN_DEVICES:
        return True
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


def puede_generar(device_id: str, tipo: str) -> tuple[bool, str, dict]:
    """Devuelve (ok, clave_mensaje, params) — no un string final: main.py lo
    traduce con i18n.cuota_msg(clave, lang, **params) según el idioma del
    request. clave="" cuando ok=True."""
    if device_id in config.ADMIN_DEVICES:
        return True, "", {}  # el dueño no tiene límites (ni cuenta en el global)
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
            clave = "limite_imagenes_premium" if premium else "limite_imagenes_free"
            return False, clave, {"n": lim_img}
        if tipo == "video":
            if vid >= lim_vid:
                if premium:
                    return False, "limite_videos_premium", {"n": lim_vid}
                if lim_vid == 0:
                    return False, "limite_videos_lock", {}
                return False, "limite_videos_free", {"n": lim_vid}
            cur.execute(_q(f"SELECT videos FROM uso_global WHERE fecha={PH}"), (hoy,))
            g = cur.fetchone()
            if g and g["videos"] >= config.VIDEOS_GLOBAL_DIA:
                return False, "limite_global_videos", {}
    return True, "", {}


def puede_chatear(device_id: str) -> tuple[bool, str, dict]:
    if device_id in config.ADMIN_DEVICES:
        return True, "", {}
    hoy = date.today().isoformat()
    with _con() as con:
        cur = con.cursor()
        cur.execute(_q(f"SELECT chats FROM uso WHERE device_id={PH} AND fecha={PH}"),
                    (device_id, hoy))
        fila = cur.fetchone()
        chats = (fila["chats"] if fila and fila["chats"] is not None else 0)
        if chats >= config.ASESOR_MENSAJES_DIA:
            return False, "limite_chats", {"n": config.ASESOR_MENSAJES_DIA}
    return True, "", {}


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
    if col not in _TOPES_IP:  # whitelist: col se interpola en el SQL
        raise ValueError(f"columna inválida: {col}")
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
                  proyecto: str = "", lang: str = "es") -> str:
    tid = uuid.uuid4().hex
    ahora = time.time()
    with _con() as con:
        cur = con.cursor()
        cur.execute(_q(
            "INSERT INTO trabajos (id, device_id, categoria, detalle, tipo, status, proyecto, lang, creado, actualizado)"
            f" VALUES ({PH},{PH},{PH},{PH},{PH},'pending',{PH},{PH},{PH},{PH})"),
            (tid, device_id, categoria, detalle, tipo, proyecto or None, lang or "es", ahora, ahora))
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


def zombis(max_edad_s: int = 900) -> list[dict]:
    """Trabajos clavados en pending/processing (ej. el server se reinició a
    mitad de una generación). Devuelve (id, lang) para marcarlos como error
    con mensaje traducido desde main."""
    with _con() as con:
        cur = con.cursor()
        cur.execute(_q(
            f"SELECT id, lang FROM trabajos WHERE status IN ('pending','processing') "
            f"AND actualizado < {PH}"), (time.time() - max_edad_s,))
        return [dict(f) for f in cur.fetchall()]


def admin_usuarios() -> list[dict]:
    """Usuarios (dispositivos) para el panel admin: uso acumulado, última
    actividad, premium y cantidad de trabajos."""
    with _con() as con:
        cur = con.cursor()
        cur.execute(_q(
            "SELECT device_id, SUM(imagenes) AS imagenes, SUM(videos) AS videos, "
            "SUM(COALESCE(chats,0)) AS chats, MAX(fecha) AS ultima_actividad "
            "FROM uso GROUP BY device_id"))
        usuarios = {f["device_id"]: dict(f) for f in cur.fetchall()}
        cur.execute(_q("SELECT device_id, COUNT(*) AS trabajos FROM trabajos GROUP BY device_id"))
        for f in cur.fetchall():
            usuarios.setdefault(f["device_id"], {"device_id": f["device_id"]})["trabajos"] = f["trabajos"]
        cur.execute(_q("SELECT device_id, hasta, plan FROM premium"))
        ahora = time.time()
        for f in cur.fetchall():
            u = usuarios.setdefault(f["device_id"], {"device_id": f["device_id"]})
            u["premium"] = bool(f["hasta"] and f["hasta"] > ahora)
            u["premium_hasta"] = f["hasta"]
            u["premium_plan"] = f["plan"]
    out = list(usuarios.values())
    out.sort(key=lambda u: u.get("ultima_actividad") or "", reverse=True)
    return out


def admin_trabajos(dias: int = 7, limit: int = 200) -> list[dict]:
    """Trabajos recientes para el panel admin (todos los dispositivos)."""
    desde = time.time() - dias * 86400
    with _con() as con:
        cur = con.cursor()
        cur.execute(_q(
            "SELECT id, device_id, categoria, tipo, status, error, detalle, "
            f"proyecto, lang, creado, despues FROM trabajos WHERE creado > {PH} "
            f"ORDER BY creado DESC LIMIT {PH}"), (desde, limit))
        return [dict(f) for f in cur.fetchall()]


def admin_feedback(limit: int = 100) -> list[dict]:
    """Votos 👍/👎 con el contexto del trabajo votado."""
    with _con() as con:
        cur = con.cursor()
        cur.execute(_q(
            "SELECT f.trabajo_id, f.voto, f.creado, t.device_id, t.categoria, "
            "t.detalle, t.despues FROM feedback f LEFT JOIN trabajos t "
            f"ON t.id = f.trabajo_id ORDER BY f.creado DESC LIMIT {PH}"), (limit,))
        return [dict(f) for f in cur.fetchall()]


def stats() -> dict:
    """Métricas globales para el dashboard del dueño (GET /admin/stats).
    Todo en una sola conexión; consultas simples que funcionan igual en
    Postgres y SQLite."""
    hoy = date.today().isoformat()
    hace7 = time.time() - 7 * 86400
    with _con() as con:
        cur = con.cursor()

        def uno(sql: str, params: tuple = ()) -> dict:
            cur.execute(_q(sql), params)
            fila = cur.fetchone()
            return dict(fila) if fila else {}

        tot = uno("SELECT COUNT(*) AS n FROM trabajos")
        t7 = uno(f"SELECT COUNT(*) AS n, COUNT(DISTINCT device_id) AS dispositivos "
                 f"FROM trabajos WHERE creado > {PH}", (hace7,))
        cur.execute(_q(f"SELECT status, COUNT(*) AS n FROM trabajos "
                       f"WHERE creado > {PH} GROUP BY status"), (hace7,))
        por_status = {f["status"]: f["n"] for f in (dict(x) for x in cur.fetchall())}
        cur.execute(_q(f"SELECT categoria, COUNT(*) AS n FROM trabajos "
                       f"WHERE creado > {PH} GROUP BY categoria ORDER BY n DESC"), (hace7,))
        por_categoria = {f["categoria"]: f["n"] for f in (dict(x) for x in cur.fetchall())}
        cur.execute(_q("SELECT error, creado FROM trabajos WHERE status='error' "
                       "ORDER BY creado DESC LIMIT 5"))
        errores = [dict(f) for f in cur.fetchall()]

        uso_hoy = uno(f"SELECT COALESCE(SUM(imagenes),0) AS imagenes, "
                      f"COALESCE(SUM(videos),0) AS videos, COALESCE(SUM(chats),0) AS chats, "
                      f"COUNT(DISTINCT device_id) AS dispositivos FROM uso WHERE fecha={PH}", (hoy,))
        fb = uno("SELECT COALESCE(SUM(CASE WHEN voto=1 THEN 1 ELSE 0 END),0) AS positivos, "
                 "COALESCE(SUM(CASE WHEN voto=-1 THEN 1 ELSE 0 END),0) AS negativos FROM feedback")
        prem = uno(f"SELECT COUNT(*) AS n FROM premium WHERE hasta > {PH}", (time.time(),))

    return {
        "trabajos_total": tot.get("n", 0),
        "ultimos_7d": {"trabajos": t7.get("n", 0), "dispositivos": t7.get("dispositivos", 0),
                       "por_status": por_status, "por_categoria": por_categoria},
        "hoy": uso_hoy,
        "feedback": fb,
        "premium_activos": prem.get("n", 0),
        "errores_recientes": errores,
    }


def votar(tid: str, voto: int) -> None:
    with _con() as con:
        cur = con.cursor()
        cur.execute(_q(
            f"INSERT INTO feedback (trabajo_id, voto, creado) VALUES ({PH},{PH},{PH}) "
            f"ON CONFLICT(trabajo_id) DO UPDATE SET voto={PH}"),
            (tid, voto, time.time(), voto))
        con.commit()
