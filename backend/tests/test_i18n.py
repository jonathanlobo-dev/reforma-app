"""Paridad de i18n del frontend: los 4 catálogos (es/en/pt/it) deben tener
EXACTAMENTE las mismas claves. Una clave que falte en un idioma cae a español
sin avisar — bug que ya nos mordió antes. Esta prueba lo caza.

Correr:  python -m pytest backend/tests/   (o)   python backend/tests/test_i18n.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]          # raíz del repo
I18N = ROOT / "frontend" / "src" / "i18n"


def _claves(archivo: str) -> set:
    texto = (I18N / archivo).read_text(encoding="utf-8")
    return set(re.findall(r'^\s*"([^"]+)"\s*:', texto, re.M))


def test_paridad_de_claves():
    base = _claves("es.ts")
    assert base, "no se encontraron claves en es.ts (¿cambió el formato?)"
    for archivo in ("en.ts", "pt.ts", "it.ts"):
        claves = _claves(archivo)
        faltan = base - claves
        extra = claves - base
        assert not faltan, f"{archivo}: faltan claves {sorted(faltan)[:8]}"
        assert not extra, f"{archivo}: claves de más {sorted(extra)[:8]}"


if __name__ == "__main__":
    try:
        test_paridad_de_claves()
        print("  OK  paridad i18n (es/en/pt/it)")
    except AssertionError as e:
        print(f" FALL {e}")
        raise SystemExit(1)
