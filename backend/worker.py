"""Procesamiento de un trabajo en segundo plano: plan → generar → imagen/video.

Corre vía FastAPI BackgroundTasks (MVP). En producción se cambia por una cola
real (Redis/RQ) sin tocar esta lógica.

Engines:
  editar  → flux-kontext (prompt de Groq + filtro)
  inpaint → flux-fill-pro (máscara del pincel + prompt de Groq + filtro)
  estilo  → flux-2-pro (foto + referencia, prompt fijo, sin Groq)
  plano   → flux-kontext (prompt fijo especializado, sin texto del usuario)
  explorar→ flux-kontext (recorte del render del plano → vista interior, prompt fijo)
"""
import shutil
import traceback

import requests

import avisos
import config
import db
import i18n
import pipeline
import storage
from categorias import CATEGORIAS


def _error_usuario(e: Exception, lang: str = "es") -> str:
    """Traduce cualquier excepción a un mensaje amable EN EL IDIOMA del
    usuario. Lo crudo (casi siempre en inglés) se queda en los logs, nunca en
    la app. Además avisa al dueño cuando el problema es de plataforma (sin
    crédito) — ese aviso siempre en español, es solo para nosotros."""
    s = str(e).lower()
    if "402" in s or "sin crédito" in s or "payment required" in s or "insufficient credit" in s:
        avisos.owner("⚠️ Replicate SIN CRÉDITO — las generaciones están fallando. Recarga en replicate.com/account/billing", clave="sin-credito")
        return i18n.error_msg("sin_credito", lang)
    if "flagged" in s or "sensitive" in s or "nsfw" in s or "safety" in s or "content policy" in s:
        return i18n.error_msg("contenido", lang)
    if "timeout" in s or "no terminó" in s or "timed out" in s:
        return i18n.error_msg("timeout", lang)
    if "429" in s or "rate limit" in s:
        return i18n.error_msg("rate_limit", lang)
    if "falta la máscara" in s:
        return i18n.error_msg("falta_mascara", lang)
    if "falta la foto de referencia" in s:
        return i18n.error_msg("falta_referencia", lang)
    # Cualquier otra cosa (errores técnicos en inglés incluidos): genérico.
    return i18n.error_msg("generico", lang)

_PROMPT_PLANO = (
    "Convert this 2D architectural floor plan into a realistic 3D furnished "
    "top-down isometric render. CRITICAL: reproduce the plan faithfully — keep "
    "the exact same wall layout and proportions, the same number of rooms, and "
    "every DOOR OPENING and window in its exact position from the plan. Do not "
    "add, move or remove any doors, walls or windows. Interior door openings "
    "must connect the same rooms as in the plan. IMPORTANT: the render must "
    "contain NO text at all — remove every room label, dimension line, "
    "measurement, annotation and title block from the plan; use them only to "
    "decide which furniture belongs in each room. Modern tasteful furniture "
    "matching what the plan suggests, soft daylight, architectural "
    "visualization quality."
)

# "Vaciar habitación" (virtual staging inverso, B2B inmobiliaria): quita TODO
# el mobiliario y desorden dejando el espacio vacío y limpio. Prompt fijo.
_PROMPT_VACIAR = (
    "Remove ALL furniture, movable appliances, decorations, boxes, clutter, "
    "loose objects and any people from this room, leaving it completely EMPTY. "
    "KEEP fixed installations in place: wall-mounted air conditioners, ceiling "
    "fans, light fixtures, radiators, built-in shelves and sockets stay exactly "
    "as they are. Realistically reconstruct the walls, floor and ceiling behind "
    "the removed items, keeping their current materials, colors and condition. "
    "Do not change the architecture: same walls, windows, doors, ceiling, floor "
    "and camera angle. The result is the same room, just empty and clean."
)

# "Explorar habitaciones": recorte de una habitación del render isométrico →
# vista interior fotorrealista a nivel de ojos. Prompt fijo, sin Groq.
_PROMPT_EXPLORAR = (
    "CHANGE THE CAMERA COMPLETELY: move the camera down INSIDE this room and "
    "shoot it at human eye level (1.6 m height), standing at one end looking "
    "across the room. The input is a top-down dollhouse view; the output must "
    "be a normal interior photograph with vertical walls, visible ceiling and "
    "one-point perspective — NOT a top-down or isometric view. Recreate the "
    "same furniture, colors, materials, rug, windows and layout seen in the "
    "input. Photorealistic, natural daylight, interior photography. No text."
)


def procesar(tid: str) -> None:
    trabajo = db.obtener(tid)
    if not trabajo:
        return
    carpeta = config.DATA / tid
    carpeta.mkdir(parents=True, exist_ok=True)
    lang = trabajo.get("lang") or "es"
    try:
        db.actualizar(tid, status="processing")
        cat = CATEGORIAS[trabajo["categoria"]]
        engine = cat.get("engine", "editar")

        # La foto ya fue guardada por el endpoint como <carpeta>/antes.<ext>
        antes = next(carpeta.glob("antes.*"))
        despues = carpeta / "despues.png"
        plan = {}

        if engine == "estilo":
            referencia = next(carpeta.glob("referencia.*"), None)
            if not referencia:
                raise RuntimeError("Falta la foto de referencia de estilo")
            url_antes, url_despues = pipeline.transferir_estilo(antes, referencia, despues)

        elif engine == "plano":
            url_antes, url_despues = pipeline.editar(antes, _PROMPT_PLANO, despues)

        elif engine == "explorar":
            url_antes, url_despues = pipeline.editar(antes, _PROMPT_EXPLORAR, despues)

        elif engine == "vaciar":
            url_antes, url_despues = pipeline.editar(antes, _PROMPT_VACIAR, despues)

        else:
            # editar | inpaint → texto libre del usuario → Groq (plan + FILTRO
            # de contenido, ANTES de gastar Replicate)
            try:
                plan = pipeline.generar_plan(cat["titulo"], cat["guia_llm"],
                                             trabajo["detalle"] or "", lang=lang)
            except pipeline.PeticionRechazada as e:
                db.actualizar(tid, status="error", error=str(e)[:300])
                return

            if engine == "inpaint":
                mask = carpeta / "mask.png"
                if not mask.exists():
                    raise RuntimeError("Falta la máscara del pincel")
                url_antes, url_despues = pipeline.inpaint(
                    antes, mask, plan["edit_prompt"], despues)
            else:
                url_antes, url_despues = pipeline.editar(
                    antes, plan["edit_prompt"], despues)

        # Comparación antes/después (siempre, es el compartible base)
        comp = carpeta / "comparacion.png"
        pipeline.comparacion(antes, despues, comp)

        # Video según tipo (solo engines con motion plan; estilo/plano = imagen)
        video = None
        if trabajo["tipo"] == "video" and engine in ("editar", "inpaint"):
            video = carpeta / "final.mp4"
            pipeline.animar(url_antes, url_despues, plan.get("motion_prompt", ""), video)

        premium = db.es_premium(trabajo["device_id"])

        # Copia LIMPIA (sin marca de agua) del resultado, ANTES de estampar.
        # Se usa para "seguir editando" (no apilar marcas) y para montar el
        # video del proceso. Para premium, despues ya es limpio.
        limpio = carpeta / "limpio.png"
        shutil.copy(despues, limpio)

        # Watermark "RenuevAI" en lo que el usuario comparte (no en 'antes').
        # Premium NO lleva marca de agua (es uno de los beneficios pagados).
        if not premium:
            pipeline._watermark(despues)
            pipeline._watermark(comp)
            if video:
                pipeline._watermark(video)

        # Miniatura liviana (~25 KB) para la grilla de Recientes: sin esto las
        # cards bajaban la comparación completa (2-5 MB) y en conexiones lentas
        # tardaban o se veían rotas mientras cargaban.
        thumb = carpeta / "thumb.jpg"
        pipeline.miniatura(comp, thumb)

        # Subir a storage persistente (Supabase o /media local)
        campos = {
            "antes": storage.subir(antes, tid, antes.name),
            "despues": storage.subir(despues, tid, "despues.png"),
            "comparacion": storage.subir(comp, tid, "comparacion.png"),
            "thumb": storage.subir(thumb, tid, "thumb.jpg"),
        }
        # limpio: si es premium, despues ya es limpio (reusa su URL, no re-sube)
        campos["limpio"] = campos["despues"] if premium else storage.subir(limpio, tid, "limpio.png")
        if video:
            campos["video"] = storage.subir(video, tid, "final.mp4")

        db.registrar_uso(trabajo["device_id"], trabajo["tipo"])
        db.actualizar(tid, status="done", **campos)
    except Exception as e:
        traceback.print_exc()  # lo crudo (inglés) va al log, no al usuario
        db.actualizar(tid, status="error", error=_error_usuario(e, lang))


def _bajar(url_o_ruta: str, destino) -> None:
    """Trae una imagen de resultado: URL absoluta (Supabase) o /media local."""
    if url_o_ruta.startswith("http"):
        destino.write_bytes(requests.get(url_o_ruta, timeout=120).content)
    else:
        # "/media/<tid>/<archivo>" → archivo en disco local (solo dev)
        rel = url_o_ruta.replace("/media/", "", 1)
        shutil.copy(config.DATA / rel, destino)


def procesar_proceso(tid: str, imagenes_urls: list) -> None:
    """Video del PROCESO (premium): crossfade de la foto original pasando por
    cada edición hasta el resultado final. Solo ffmpeg → costo $0."""
    carpeta = config.DATA / tid
    carpeta.mkdir(parents=True, exist_ok=True)
    trabajo = db.obtener(tid) or {}
    lang = trabajo.get("lang") or "es"
    try:
        db.actualizar(tid, status="processing")
        rutas = []
        for i, url in enumerate(imagenes_urls):
            destino = carpeta / f"paso{i}.png"
            _bajar(url, destino)
            rutas.append(destino)

        video = carpeta / "final.mp4"
        pipeline.crossfade_multi(rutas, video)
        # Es una función premium: sin marca de agua.

        thumb = carpeta / "thumb.jpg"
        pipeline.miniatura(rutas[-1], thumb)

        campos = {
            "antes": storage.subir(rutas[0], tid, "antes.png"),
            "despues": storage.subir(rutas[-1], tid, "despues.png"),
            "video": storage.subir(video, tid, "final.mp4"),
            "thumb": storage.subir(thumb, tid, "thumb.jpg"),
        }
        db.actualizar(tid, status="done", **campos)
    except Exception as e:
        traceback.print_exc()
        db.actualizar(tid, status="error", error=_error_usuario(e, lang))
