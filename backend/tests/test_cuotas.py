"""Tests de la lógica de cuotas / anti-abuso (la parte que cuida el dinero y a
los usuarios legítimos). Corren contra una SQLite TEMPORAL — nunca tocan la DB
de producción: se fuerza SQLite sobreescribiendo config ANTES de importar db.

Correr:  python -m pytest backend/tests/           (o)   python backend/tests/test_cuotas.py
"""
import sys
import tempfile
from pathlib import Path

BACK = Path(__file__).resolve().parents[1]  # .../backend
sys.path.insert(0, str(BACK))

import config  # noqa: E402

# ── Forzar SQLite temporal y topes chicos ANTES de importar db ──────────────
config.USA_POSTGRES = False
config.USA_SUPABASE = False
_TMP = Path(tempfile.mkdtemp())
config.DATA = _TMP
config.DB_PATH = _TMP / "test.db"
config.IMAGENES_GRATIS_DIA = 100     # que NO bloquee el tope por dispositivo
config.IMAGENES_GLOBAL_DIA = 3       # tope global bajo, para tocarlo
config.IMAGENES_IP_DIA = 2           # tope por IP bajo
config.VIDEOS_GRATIS_TOTAL = 1
config.ADMIN_DEVICES = set()

import db  # noqa: E402
db.init()


# ── _agrupar_ip: funciones puras, sin estado ───────────────────────────────
def test_agrupar_ipv4_por_24():
    assert db._agrupar_ip("190.202.45.77") == "190.202.45.0/24"

def test_agrupar_ipv6_por_64():
    assert db._agrupar_ip("2001:db8:abcd:1234:5:6:7:8").endswith("::/64")

def test_agrupar_ip_vacia_se_deja():
    assert db._agrupar_ip("") == ""

def test_agrupar_ip_malformada_se_deja():
    assert db._agrupar_ip("no.es.ip") == "no.es.ip"


# ── Flujo con estado: subred comparte balde, tope global, tope por device ───
def test_ip_misma_subred_comparte_tope():
    db.registrar_ip("190.202.45.10", "imagenes")    # 1ª de la /24
    db.registrar_ip("190.202.45.250", "imagenes")   # 2ª de la /24 (otro octeto)
    # ya llegó a 2/2 → otra IP de la misma /24 queda bloqueada
    assert db.puede_ip("190.202.45.99", "imagenes") is False
    # una /24 distinta NO está afectada
    assert db.puede_ip("10.0.0.1", "imagenes") is True


def test_tope_global_de_imagenes():
    for i in range(3):                                # 3 usos → uso_global=3
        db.registrar_uso(f"dev-{i}", "imagen")
    ok, clave, _ = db.puede_generar("dev-nuevo", "imagen")
    assert ok is False
    assert clave == "limite_global_imagenes"


def test_tope_por_dispositivo():
    config.IMAGENES_GLOBAL_DIA = 9999                 # aislar el tope de device
    config.IMAGENES_GRATIS_DIA = 2
    for _ in range(2):
        db.registrar_uso("dev-tope", "imagen")
    ok, clave, _ = db.puede_generar("dev-tope", "imagen")
    assert ok is False
    assert clave in ("limite_imagenes_free", "limite_imagenes_premium")


def test_migracion_idempotente():
    db.init()  # correr init() de nuevo no debe romper (ADD COLUMN IF NOT EXISTS)
    db.init()


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    fallos = 0
    for fn in fns:
        try:
            fn(); print(f"  OK  {fn.__name__}")
        except AssertionError as e:
            fallos += 1; print(f" FALL {fn.__name__}: {e}")
    print("RESULTADO:", "TODO VERDE" if not fallos else f"{fallos} FALLIDOS")
    sys.exit(1 if fallos else 0)
