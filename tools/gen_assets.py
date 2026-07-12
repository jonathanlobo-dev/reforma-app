"""Genera los assets de marketing de la app con Replicate (se corre UNA vez).

Fases (argumento):
  inspiracion  → 16 fotos txt2img (flux-2-dev) para la galería de Inspiración
  covers       → pares antes/después por categoría para la Home
                 (antes: flux-2-dev "versión desgastada"; después: kontext la renueva)
  explorar     → prueba REAL del engine explorar: recorta el render del plano
                 y genera la vista interior (validación, no asset)

Uso:  python tools/gen_assets.py inspiracion
Costos aprox: dev ~$0.025/img, kontext-pro ~$0.04/edición.
"""
import io
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

import requests
from PIL import Image

import config
import pipeline

FRONT = Path(__file__).parent.parent / "frontend" / "public"
DEV_MODEL = "black-forest-labs/flux-2-dev"

BASE_FOTO = ("Professional interior design photography, realistic, natural light, "
             "no people, no text, no watermarks. ")


def guardar_webp(url: str, destino: Path, ancho: int = 800) -> None:
    destino.parent.mkdir(parents=True, exist_ok=True)
    img = Image.open(io.BytesIO(requests.get(url, timeout=300).content)).convert("RGB")
    if img.width > ancho:
        img = img.resize((ancho, round(img.height * ancho / img.width)), Image.LANCZOS)
    img.save(destino, "WEBP", quality=82)
    print(f"  ✓ {destino.relative_to(FRONT)} ({destino.stat().st_size // 1024} KB)")


def dev(prompt: str, aspecto: str = "4:3") -> str:
    return pipeline.replicate_run(DEV_MODEL, {
        "prompt": prompt, "aspect_ratio": aspecto, "output_format": "png",
    })


# ─── Fase 1: Inspiración ─────────────────────────────────────────────────────
# Los nombres de archivo son EXACTAMENTE los que ya espera inspiracion.ts.

INSPO = [
    ("cocina_moderna",      "modern kitchen, white glossy cabinets, quartz island, black fixtures"),
    ("cocina_escandinava",  "scandinavian kitchen, light oak wood, white walls, minimal open shelves"),
    ("cocina_industrial",   "industrial kitchen, dark metal, exposed brick wall, concrete countertop"),
    ("cocina_tradicional",  "traditional warm kitchen, cream wooden cabinets, tiled backsplash"),
    ("dormitorio_moderno",  "modern bedroom, upholstered bed, warm led accent lighting, neutral palette"),
    ("dormitorio_minimalista", "minimalist bedroom, low platform bed, white and beige, clean and airy"),
    ("dormitorio_rustico",  "rustic bedroom, wooden beams, linen bedding, warm cozy tones"),
    ("dormitorio_contemp",  "contemporary bedroom, bold headboard wall, elegant curtains, soft carpet"),
    ("bano_moderno",        "modern bathroom, walk-in shower with glass, large format grey tiles"),
    ("bano_minimalista",    "minimalist bathroom, floating vanity, white stone sink, matte fixtures"),
    ("bano_clasico",        "classic elegant bathroom, marble, freestanding bathtub, brass details"),
    ("fachada_moderna",     "modern house facade, clean lines, wood and concrete, landscaped entrance"),
    ("fachada_rustica",     "rustic house facade, stone walls, terracotta roof, wooden door"),
    ("terraza_moderna",     "modern terrace, outdoor lounge furniture, wooden deck, string lights, plants"),
    ("jardin_paisajistico", "landscaped garden, curved lawn, flower beds, stone path, mature trees"),
    ("jardin_zen",          "zen garden, raked gravel, moss rocks, bamboo, minimal japanese style"),
]


def fase_inspiracion():
    def hacer(item):
        nombre, prompt = item
        destino = FRONT / "inspiracion" / f"{nombre}.webp"
        if destino.exists():
            print(f"  ~ {nombre} ya existe, salto")
            return
        guardar_webp(dev(BASE_FOTO + prompt), destino)
    with ThreadPoolExecutor(4) as ex:
        list(ex.map(hacer, INSPO))


# ─── Fase 2: portadas antes/después por categoría ───────────────────────────
# antes: txt2img de la versión "vieja/desgastada". después: kontext la renueva.
# El par de "plano" es especial: antes = plano 2D, después = render 3D (mismo
# prompt real del engine) — y ese render sirve luego para la fase explorar.

PARES = {
    "pintar":    ("living room with faded scratched dull beige walls, dated look",
                  "Paint the walls in an elegant matte emerald green, freshly painted, keep everything else exactly the same."),
    "interior":  ("dated old-fashioned living room, worn furniture from the 90s, cluttered",
                  "Redesign as a bright modern minimalist living room, keep the architecture, window and camera perspective the same."),
    "exterior":  ("worn house facade with stained cracked paint and old windows",
                  "Renovate the facade: fresh contemporary paint, clean modern finishes, tidy entrance, keep the structure identical."),
    "muebles":   ("living room with old sagging worn-out sofa and dated furniture",
                  "Replace the furniture with modern gray sofas and a clean coffee table, keep walls, floor and window the same."),
    "suelo":     ("room with old scratched stained floor tiles, dated look",
                  "Replace the floor with glossy white porcelain tiles, keep furniture, walls and everything else exactly the same."),
    "paredes":   ("plain room with dull damaged walls with stains and cracks",
                  "Cover the main wall with industrial exposed brick finish, keep furniture, floor and window exactly the same."),
    "eliminar":  ("room cluttered with boxes, junk and old objects piled in a corner",
                  "Remove all the clutter, boxes and junk, realistically reconstruct the clean wall and floor behind, change nothing else."),
    "restaurar": ("close view of a worn cracked leather sofa, faded and scratched",
                  "Restore the leather sofa to like-new condition, smooth clean leather, same sofa, same angle, same room."),
    "pincel":    ("simple living room with plain white walls, minimal decor",
                  "Paint ONLY the back wall in deep navy blue, keep every other wall and everything else exactly the same."),
    "estilo":    ("plain generic living room, basic neutral furniture, no defined style",
                  "Redesign the room in bold industrial style: exposed brick, metal, leather, keep layout and window the same."),
}

_PROMPT_PLANO_2D = ("clean 2D architectural floor plan of a small two-bedroom house, black lines on "
                    "white background, furniture symbols, top view, professional CAD style drawing, "
                    "no dimensions, no text labels")


def fase_covers():
    destino_dir = FRONT / "covers"

    def hacer(item):
        cat, (prompt_antes, prompt_despues) = item
        f_a, f_d = destino_dir / f"{cat}_a.webp", destino_dir / f"{cat}_d.webp"
        if f_a.exists() and f_d.exists():
            print(f"  ~ {cat} ya existe, salto")
            return
        url_antes = dev(BASE_FOTO + prompt_antes, "3:4")
        guardar_webp(url_antes, f_a, 600)
        url_despues = pipeline.replicate_run(config.EDIT_MODEL, {
            "prompt": prompt_despues, "input_image": url_antes, "output_format": "png",
        })
        guardar_webp(url_despues, f_d, 600)

    with ThreadPoolExecutor(3) as ex:
        list(ex.map(hacer, PARES.items()))

    # Par especial del plano (usa el prompt REAL del engine)
    import worker
    f_a, f_d = destino_dir / "plano_a.webp", destino_dir / "plano_d.webp"
    if not (f_a.exists() and f_d.exists()):
        url_plano = dev(_PROMPT_PLANO_2D, "3:4")
        guardar_webp(url_plano, f_a, 600)
        url_render = pipeline.replicate_run(config.EDIT_MODEL, {
            "prompt": worker._PROMPT_PLANO, "input_image": url_plano, "output_format": "png",
        })
        guardar_webp(url_render, f_d, 600)
        # guardar el render a resolución completa para la fase explorar
        pipeline.descargar(url_render, Path(__file__).parent / "_render_plano.png")


# ─── Fase 3: prueba real de "Explorar habitaciones" ─────────────────────────

def fase_explorar():
    import worker
    render = Path(__file__).parent / "_render_plano.png"
    if not render.exists():
        print("Primero corre la fase covers (genera _render_plano.png)")
        return
    img = Image.open(render)
    # recorte tipo usuario: cuadrante superior-izquierdo ampliado (una habitación)
    w, h = img.size
    recorte = img.crop((int(w * 0.08), int(h * 0.08), int(w * 0.55), int(h * 0.5)))
    rec_path = Path(__file__).parent / "_recorte_habitacion.jpg"
    recorte.convert("RGB").save(rec_path, quality=92)
    url = pipeline.replicate_upload(rec_path)
    out = pipeline.replicate_run(config.EDIT_MODEL, {
        "prompt": worker._PROMPT_EXPLORAR, "input_image": url, "output_format": "png",
    })
    pipeline.descargar(out, Path(__file__).parent / "_vista_interior.png")
    print("  ✓ vista interior generada: tools/_vista_interior.png")


if __name__ == "__main__":
    fase = sys.argv[1] if len(sys.argv) > 1 else ""
    {"inspiracion": fase_inspiracion, "covers": fase_covers, "explorar": fase_explorar}.get(
        fase, lambda: print(__doc__))()
