"""Catálogo de categorías — lo consume tanto el backend como la UI de la app.

`tipo_default`: "imagen" (tier gratis) o "video" (premium animado).
`engine`: qué función del pipeline usar ("editar" | "inpaint" | "estilo" | "plano").
`guia_llm`: restringe qué puede cambiar el editor para preservar el espacio real.
`titulo_i18n` / `campos[].label_i18n` / `campos[].ejemplo_i18n`: traducciones
visibles al usuario (ES base; EN/PT/IT completos desde la Fase 3).
"""
from i18n import normalizar_lang

# El catalogo con las guias afinadas vive en prompts_privados.py (no versionado).
# En Render se sube como Secret File y queda montado en /etc/secrets.
try:
    from prompts_privados import CATEGORIAS
except ImportError:
    import sys
    sys.path.append("/etc/secrets")
    from prompts_privados import CATEGORIAS


def resolver(nombre: str) -> dict:
    if nombre not in CATEGORIAS:
        from fastapi import HTTPException
        raise HTTPException(400, f"Categoría inválida. Opciones: {', '.join(CATEGORIAS)}")
    return CATEGORIAS[nombre]


def categorias_traducidas(lang: str = "es") -> dict:
    """Catálogo para la UI, con título y campos en el idioma pedido (fallback
    a ES si la clave no tiene traducción para ese idioma — así PT/IT ya
    funcionan hoy mismo aunque la Fase 3 no los haya llenado todavía)."""
    l = normalizar_lang(lang)
    out = {}
    for clave, v in CATEGORIAS.items():
        titulo = v.get("titulo_i18n", {}).get(l) or v["titulo"]
        campos = [
            {
                "clave": c["clave"],
                "label": c.get("label_i18n", {}).get(l) or c["label"],
                "ejemplo": c.get("ejemplo_i18n", {}).get(l) or c["ejemplo"],
            }
            for c in v["campos"]
        ]
        out[clave] = {
            "titulo": titulo, "emoji": v["emoji"], "tipo_default": v["tipo_default"],
            "campos": campos, "engine": v.get("engine", "editar"),
            "oculta": v.get("oculta", False),
        }
    return out
