"""Motor de generación — reúne la lógica validada en shorts-pipeline como
funciones limpias e importables por el worker del backend.

Flujo: plan (Groq) → editar foto preservando el espacio (flux-kontext) →
imagen antes/después  Y/O  video animado (Seedance) o crossfade (ffmpeg, $0).
"""
import json
import subprocess
import time
from pathlib import Path

import requests

# La máquina del dev tiene inspección TLS; inofensivo en deploy si no está.
try:
    import truststore
    truststore.inject_into_ssl()
except ImportError:
    pass

import config
import i18n

GROQ_URL      = "https://api.groq.com/openai/v1/chat/completions"
REPLICATE_API = "https://api.replicate.com/v1"

_ERRORES_TRANSITORIOS = ("E004", "temporarily unavailable")


# ─── Groq ────────────────────────────────────────────────────────────────────

def groq_json(system: str, user: str, max_tokens: int = 1200) -> dict:
    for intento in range(4):
        r = requests.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {config.GROQ_API_KEY}"},
            json={
                "model": config.GROQ_MODEL,
                "messages": [{"role": "system", "content": system},
                             {"role": "user", "content": user}],
                "temperature": 0.6,
                "max_tokens": max_tokens,
                "response_format": {"type": "json_object"},
            },
            timeout=90,
        )
        if r.status_code == 429 and intento < 3:
            time.sleep(min(float(r.headers.get("retry-after", 10)), 60))
            continue
        r.raise_for_status()
        return json.loads(r.json()["choices"][0]["message"]["content"])
    raise RuntimeError("Groq en rate limit tras 4 intentos")


# Prompts del producto: viven en prompts_privados.py (no versionado).
# En Render se sube como Secret File y queda montado en /etc/secrets.
try:
    from prompts_privados import ASESOR_SYSTEM, _SYSTEM_PLAN
except ImportError:
    import sys
    sys.path.append("/etc/secrets")
    from prompts_privados import ASESOR_SYSTEM, _SYSTEM_PLAN


def groq_chat(mensajes: list, max_tokens: int = 700, model: str = "") -> str:
    """Chat de texto libre (asesor). Sin response_format JSON.
    `model` permite usar el modelo de VISIÓN cuando el mensaje trae imagen."""
    for intento in range(4):
        r = requests.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {config.GROQ_API_KEY}"},
            json={
                "model": model or config.GROQ_MODEL,
                "messages": mensajes,
                "temperature": 0.7,
                "max_tokens": max_tokens,
            },
            timeout=90,
        )
        if r.status_code == 429 and intento < 3:
            time.sleep(min(float(r.headers.get("retry-after", 10)), 60))
            continue
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()
    raise RuntimeError("Groq en rate limit tras 4 intentos")


# ─── Replicate ───────────────────────────────────────────────────────────────

def _headers() -> dict:
    return {"Authorization": f"Bearer {config.REPLICATE_API_TOKEN}"}


def replicate_run(model: str, input_data: dict, timeout_s: int = 600) -> str:
    for intento in range(3):
        r = None
        for reintento in range(5):
            r = requests.post(
                f"{REPLICATE_API}/models/{model}/predictions",
                headers={**_headers(), "Prefer": "wait=60"},
                json={"input": input_data}, timeout=90,
            )
            if r.status_code == 429 and reintento < 4:
                time.sleep(min(float(r.headers.get("retry-after", 10)) * (reintento + 1), 60))
                continue
            break
        if r.status_code == 402:
            raise RuntimeError("Sin crédito en Replicate (402)")
        r.raise_for_status()
        pred = r.json()
        inicio = time.time()
        while pred["status"] not in ("succeeded", "failed", "canceled"):
            if time.time() - inicio > timeout_s:
                raise TimeoutError(f"Replicate no terminó: {pred.get('id')}")
            time.sleep(3)
            pred = requests.get(f"{REPLICATE_API}/predictions/{pred['id']}",
                                headers=_headers(), timeout=30).json()
        if pred["status"] == "succeeded":
            out = pred["output"]
            return out[0] if isinstance(out, list) else out
        error = str(pred.get("error") or pred["status"])
        if intento < 2 and any(m in error for m in _ERRORES_TRANSITORIOS):
            time.sleep(5)
            continue
        raise RuntimeError(f"Replicate falló: {error}")


def replicate_upload(path: Path) -> str:
    import mimetypes
    mime = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    with open(path, "rb") as f:
        r = requests.post(f"{REPLICATE_API}/files", headers=_headers(),
                          files={"content": (path.name, f, mime)}, timeout=120)
    r.raise_for_status()
    return r.json()["urls"]["get"]


def descargar(url: str, destino: Path) -> Path:
    destino.parent.mkdir(parents=True, exist_ok=True)
    r = requests.get(url, timeout=300)
    r.raise_for_status()
    destino.write_bytes(r.content)
    return destino


# ─── ffmpeg helpers ──────────────────────────────────────────────────────────

def _ff(args: list) -> None:
    r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error"] + [str(a) for a in args])
    if r.returncode != 0:
        raise RuntimeError("ffmpeg falló")


def _fuente() -> str:
    return config.FONT_PATH.replace("\\", "/").replace(":", r"\:")


def _label(texto: str, y: int = 60) -> str:
    t = texto.replace(":", r"\:").replace("'", r"\'").replace("%", r"\%")
    return (f"drawtext=fontfile='{_fuente()}':text='{t}':fontcolor=white:fontsize=48:"
            f"borderw=4:bordercolor=black@0.6:x=(w-text_w)/2:y={y}")


# ─── Pasos del pipeline ──────────────────────────────────────────────────────



class PeticionRechazada(Exception):
    """La petición no pasó el filtro de contenido/intención."""


def generar_plan(titulo_cat: str, guia: str, detalle: str, lang: str = "es") -> dict:
    nombre_idioma = i18n.NOMBRES_IDIOMA.get(i18n.normalizar_lang(lang), "español")
    system = _SYSTEM_PLAN.replace("%%IDIOMA%%", nombre_idioma)
    plan = groq_json(system,
                     f"CATEGORÍA: {titulo_cat}\nGUÍA (obligatoria): {guia}\nPETICIÓN: {detalle}")
    if plan.get("ok") is False or not plan.get("edit_prompt"):
        raise PeticionRechazada(
            plan.get("motivo") or i18n.plan_msg("peticion_generica", lang))
    return plan


def editar(foto: Path, edit_prompt: str, out: Path) -> tuple[str, str]:
    """Devuelve (url_antes, url_despues); guarda la imagen editada en `out`."""
    url_antes = replicate_upload(foto)
    url_despues = replicate_run(config.EDIT_MODEL, {
        "prompt": edit_prompt, "input_image": url_antes, "output_format": "png",
    })
    descargar(url_despues, out)
    return url_antes, url_despues


def inpaint(foto: Path, mask: Path, edit_prompt: str, out: Path) -> tuple[str, str]:
    """Edita SOLO la zona pintada de la máscara (blanco=cambiar, negro=conservar).
    flux-fill-pro: inputs image, mask, prompt."""
    url_antes = replicate_upload(foto)
    url_mask = replicate_upload(mask)
    url_despues = replicate_run(config.INPAINT_MODEL, {
        "prompt": edit_prompt, "image": url_antes, "mask": url_mask,
        "output_format": "png",
    })
    descargar(url_despues, out)
    return url_antes, url_despues


def transferir_estilo(foto: Path, referencia: Path, out: Path) -> tuple[str, str]:
    """Rediseña `foto` adoptando el estilo de `referencia` (flux-2-pro, input_images)."""
    url_antes = replicate_upload(foto)
    url_ref = replicate_upload(referencia)
    prompt = ("Redesign the room in the first image adopting the interior style, "
              "color palette, materials and mood of the second reference image. "
              "Keep the first room's architecture, layout, window position and "
              "camera perspective exactly the same.")
    url_despues = replicate_run(config.STYLE_MODEL, {
        "prompt": prompt, "input_images": [url_antes, url_ref],
        "output_format": "png",
    })
    descargar(url_despues, out)
    return url_antes, url_despues


def _watermark(path: Path) -> None:
    """Añade 'RenuevAI' semitransparente abajo-derecha (marketing viral)."""
    if not path.exists():
        return
    tmp = path.with_suffix(".wm_tmp" + path.suffix)
    fuente = _fuente()
    filtro = (
        f"drawtext=fontfile='{fuente}':text='RenuevAI':fontcolor=white@0.55:"
        f"fontsize=24:borderw=2:bordercolor=black@0.4:"
        f"x=w-text_w-16:y=h-text_h-14"
    )
    if path.suffix.lower() in (".mp4", ".mov"):
        _ff(["-i", path, "-vf", filtro, "-c:a", "copy",
             "-c:v", "libx264", "-preset", "fast", "-crf", "20",
             "-x264-params", "threads=2", tmp])
    else:
        _ff(["-i", path, "-vf", filtro, tmp])
    tmp.replace(path)


def miniatura(imagen: Path, out: Path, ancho: int = 480) -> None:
    """Thumbnail JPEG liviano para la grilla de Recientes (~20-30 KB)."""
    _ff(["-i", imagen, "-vf", f"scale={ancho}:-2", "-q:v", "7", out])


def comparacion(antes: Path, despues: Path, out: Path) -> None:
    _ff(["-i", antes, "-i", despues, "-filter_complex",
         "[0:v]scale=-2:720[a];[1:v]scale=-2:720[b];[a][b]hstack=inputs=2", out])


def crossfade(antes: Path, despues: Path, et_a: str, et_d: str, out: Path) -> None:
    filtro = (
        f"[0:v]scale=1080:810,setsar=1,fps=30,{_label(et_a)}[a];"
        f"[1:v]scale=1080:810,setsar=1,fps=30,{_label(et_d)}[b];"
        f"[a][b]xfade=transition=fade:duration=1.5:offset=1[v]"
    )
    _ff(["-loop", "1", "-t", "3", "-i", antes, "-loop", "1", "-t", "3", "-i", despues,
         "-filter_complex", filtro, "-map", "[v]", "-c:v", "libx264", "-preset", "fast",
         "-crf", "20", "-pix_fmt", "yuv420p", "-x264-params", "threads=2", "-t", "4", out])


def crossfade_multi(imagenes: list, out: Path) -> None:
    """Video del PROCESO: encadena N imágenes (original → ediciones → final)
    con fundidos. Puro ffmpeg → costo $0 (no toca Replicate).

    Memoria CONSTANTE: se genera un segmento por PAR de imágenes consecutivas
    (nunca hay más de 2 fotos decodificadas a la vez) y al final se concatena
    con el demuxer concat sin re-encodar. La versión anterior metía las N
    imágenes en un solo filtro xfade encadenado y con cadenas largas reventaba
    los 512 MB de la instancia de Render (OOM + reinicio)."""
    n = len(imagenes)
    if n < 2:
        raise ValueError("Se necesitan al menos 2 imágenes")
    DUR, FADE = 2.2, 0.9
    X264 = ["-c:v", "libx264", "-preset", "fast", "-crf", "20",
            "-pix_fmt", "yuv420p", "-x264-params", "threads=2"]
    segmentos = []
    try:
        # Un segmento por par: img_k entera (DUR-FADE) + fundido a img_k+1 (FADE)
        for k in range(n - 1):
            seg = out.with_suffix(f".seg{k}.mp4")
            filtro = (
                f"[0:v]scale=1080:810,setsar=1,fps=30[a];"
                f"[1:v]scale=1080:810,setsar=1,fps=30[b];"
                f"[a][b]xfade=transition=fade:duration={FADE}:offset={round(DUR - FADE, 3)},"
                f"trim=duration={DUR},setpts=PTS-STARTPTS[v]"
            )
            _ff(["-loop", "1", "-t", str(DUR), "-i", imagenes[k],
                 "-loop", "1", "-t", str(DUR), "-i", imagenes[k + 1],
                 "-filter_complex", filtro, "-map", "[v]", *X264, seg])
            segmentos.append(seg)

        # Cola: la imagen final quieta un momento para cerrar el video
        cola = out.with_suffix(".segfin.mp4")
        _ff(["-loop", "1", "-t", str(round(DUR - FADE, 3)), "-i", imagenes[-1],
             "-vf", "scale=1080:810,setsar=1,fps=30", *X264, cola])
        segmentos.append(cola)

        # Concat sin re-encodar (mismos parámetros de codec en cada segmento)
        lista = out.with_suffix(".concat.txt")
        lista.write_text("".join(f"file '{Path(s).name}'\n" for s in segmentos),
                         encoding="utf-8")
        _ff(["-f", "concat", "-safe", "0", "-i", lista, "-c", "copy", out])
        lista.unlink(missing_ok=True)
    finally:
        for s in segmentos:
            Path(s).unlink(missing_ok=True)


def animar(url_antes: str, url_despues: str, motion_prompt: str, out: Path) -> None:
    input_data = {
        "prompt": (motion_prompt or "smooth transformation") +
                  " Camera completely static and locked, no zoom, no pan. Room stays the same.",
        "image": url_antes, "last_frame_image": url_despues,
        "duration": config.CLIP_SECONDS, "resolution": config.RESOLUTION,
        "camera_fixed": True,
    }
    if "seedance-1.5" in config.VIDEO_MODEL:
        input_data["generate_audio"] = False
    url = replicate_run(config.VIDEO_MODEL, input_data)
    tmp = out.with_suffix(".raw.mp4")
    descargar(url, tmp)
    # normalizar a 1080x810
    _ff(["-i", tmp, "-vf",
         "scale=1080:810:force_original_aspect_ratio=increase,crop=1080:810,fps=30",
         "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "20",
         "-x264-params", "threads=2", out])
    tmp.unlink(missing_ok=True)
