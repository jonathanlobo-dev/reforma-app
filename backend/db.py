"""Persistencia mínima con SQLite: trabajos + cuota diaria por dispositivo.

La cuota es el control de costos (lección CatchCat): se consulta ANTES de
llamar a Replicate. Sin login: el cliente manda un device_id (UUID local).
"""
import sqlite3
import time
import uuid
from datetime import date

import config

_SCHEMA = """
CREATE TABLE IF NOT EXISTS trabajos (
    id            TEXT PRIMARY KEY,
    device_id     TEXT NOT NULL,
    categoria     TEXT NOT NULL,
    detalle       TEXT,
    tipo          TEXT NOT NULL,            -- imagen | video
    status        TEXT NOT NULL,            -- pending | processing | done | error
    error         TEXT,
    antes         TEXT, despues TEXT, comparacion TEXT, video TEXT,
    creado        REAL, actualizado REAL
);
CREATE TABLE IF NOT EXISTS uso (
    device_id TEXT, fecha TEXT, imagenes INTEGER DEFAULT 0, videos INTEGER DEFAULT 0,
    PRIMARY KEY (device_id, fecha)
);
CREATE TABLE IF NOT EXISTS uso_global (
    fecha TEXT PRIMARY KEY, videos INTEGER DEFAULT 0
);
"""


def _con():
    con = sqlite3.connect(config.DB_PATH, timeout=30)
    con.row_factory = sqlite3.Row
    return con


def init() -> None:
    with _con() as con:
        con.executescript(_SCHEMA)


# ─── Cuota ───────────────────────────────────────────────────────────────────

def puede_generar(device_id: str, tipo: str) -> tuple[bool, str]:
    """Chequea topes por dispositivo/día y el tope global de videos."""
    hoy = date.today().isoformat()
    with _con() as con:
        fila = con.execute("SELECT imagenes, videos FROM uso WHERE device_id=? AND fecha=?",
                           (device_id, hoy)).fetchone()
        img = fila["imagenes"] if fila else 0
        vid = fila["videos"] if fila else 0
        if tipo == "imagen" and img >= config.IMAGENES_GRATIS_DIA:
            return False, f"Llegaste al límite de {config.IMAGENES_GRATIS_DIA} imágenes por hoy."
        if tipo == "video":
            if vid >= config.VIDEOS_GRATIS_DIA:
                return False, f"Los videos son premium (máx {config.VIDEOS_GRATIS_DIA}/día por ahora)."
            g = con.execute("SELECT videos FROM uso_global WHERE fecha=?", (hoy,)).fetchone()
            if g and g["videos"] >= config.VIDEOS_GLOBAL_DIA:
                return False, "El sistema alcanzó su límite diario de videos. Intenta mañana."
    return True, ""


def registrar_uso(device_id: str, tipo: str) -> None:
    hoy = date.today().isoformat()
    col = "imagenes" if tipo == "imagen" else "videos"
    with _con() as con:
        con.execute(
            f"INSERT INTO uso (device_id, fecha, {col}) VALUES (?,?,1) "
            f"ON CONFLICT(device_id, fecha) DO UPDATE SET {col}={col}+1",
            (device_id, hoy))
        if tipo == "video":
            con.execute(
                "INSERT INTO uso_global (fecha, videos) VALUES (?,1) "
                "ON CONFLICT(fecha) DO UPDATE SET videos=videos+1", (hoy,))
        con.commit()


# ─── Trabajos ────────────────────────────────────────────────────────────────

def crear_trabajo(device_id: str, categoria: str, detalle: str, tipo: str) -> str:
    tid = uuid.uuid4().hex
    ahora = time.time()
    with _con() as con:
        con.execute(
            "INSERT INTO trabajos (id, device_id, categoria, detalle, tipo, status, creado, actualizado)"
            " VALUES (?,?,?,?,?,'pending',?,?)",
            (tid, device_id, categoria, detalle, tipo, ahora, ahora))
        con.commit()
    return tid


def actualizar(tid: str, **campos) -> None:
    campos["actualizado"] = time.time()
    sets = ", ".join(f"{k}=?" for k in campos)
    with _con() as con:
        con.execute(f"UPDATE trabajos SET {sets} WHERE id=?", (*campos.values(), tid))
        con.commit()


def obtener(tid: str) -> dict | None:
    with _con() as con:
        fila = con.execute("SELECT * FROM trabajos WHERE id=?", (tid,)).fetchone()
        return dict(fila) if fila else None
