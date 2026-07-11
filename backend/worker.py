"""Procesamiento de un trabajo en segundo plano: plan → generar → imagen/video.

Corre vía FastAPI BackgroundTasks (MVP). En producción se cambia por una cola
real (Redis/RQ) sin tocar esta lógica.

Engines:
  editar  → flux-kontext (prompt de Groq + filtro)
  inpaint → flux-fill-pro (máscara del pincel + prompt de Groq + filtro)
  estilo  → flux-2-pro (foto + referencia, prompt fijo, sin Groq)
  plano   → flux-kontext (prompt fijo especializado, sin texto del usuario)
"""
import shutil
import traceback

import requests

import avisos
import config
import db
import pipeline
import storage
from categorias import CATEGORIAS


def _error_usuario(e: Exception) -> str:
    """Traduce cualquier excepción a un mensaje amable en español para el
    usuario. Lo crudo (en inglés) se queda en los logs, nunca en la app.
    Además avisa al dueño cuando el problema es de plataforma (sin crédito)."""
    s = str(e).lower()
    if "402" in s or "sin crédito" in s or "payment required" in s or "insufficient credit" in s:
        avisos.owner("⚠️ Replicate SIN CRÉDITO — las generaciones están fallando. Recarga en replicate.com/account/billing", clave="sin-credito")
        return "El servicio está a máxima capacidad en este momento. Intenta de nuevo en un rato."
    if "flagged" in s or "sensitive" in s or "nsfw" in s or "safety" in s or "content policy" in s:
        return "La imagen o el pedido no pasó los filtros de contenido. Intenta con otra foto u otra descripción."
    if "timeout" in s or "no terminó" in s or "timed out" in s:
        return "La generación tardó demasiado y se canceló. Intenta de nuevo."
    if "429" in s or "rate limit" in s:
        return "Hay muchas personas generando en este momento. Intenta en unos minutos."
    if "falta la máscara" in s:
        return "Falta pintar la zona a cambiar. Vuelve atrás y usa el pincel."
    if "falta la foto de referencia" in s:
        return "Falta la foto de inspiración. Vuelve atrás y súbela."
    # Cualquier otra cosa (errores técnicos en inglés incluidos): genérico.
    return "Algo salió mal generando tu transformación. Intenta de nuevo."

_PROMPT_PLANO = (
    "Convert this 2D architectural floor plan into a realistic 3D furnished "
    "top-down isometric render. CRITICAL: reproduce the plan faithfully — keep "
    "the exact same wall layout and proportions, the same number of rooms, and "
    "every DOOR OPENING and window in its exact position from the plan. Do not "
    "add, move or remove any doors, walls or windows. Interior door openings "
    "must connect the same rooms as in the plan. Modern tasteful furniture "
    "matching what the plan suggests, soft daylight, architectural "
    "visualization quality."
)


def procesar(tid: str) -> None:
    trabajo = db.obtener(tid)
    if not trabajo:
        return
    carpeta = config.DATA / tid
    carpeta.mkdir(parents=True, exist_ok=True)
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

        else:
            # editar | inpaint → texto libre del usuario → Groq (plan + FILTRO
            # de contenido, ANTES de gastar Replicate)
            try:
                plan = pipeline.generar_plan(cat["titulo"], cat["guia_llm"],
                                             trabajo["detalle"] or "")
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

        # Subir a storage persistente (Supabase o /media local)
        campos = {
            "antes": storage.subir(antes, tid, antes.name),
            "despues": storage.subir(despues, tid, "despues.png"),
            "comparacion": storage.subir(comp, tid, "comparacion.png"),
        }
        # limpio: si es premium, despues ya es limpio (reusa su URL, no re-sube)
        campos["limpio"] = campos["despues"] if premium else storage.subir(limpio, tid, "limpio.png")
        if video:
            campos["video"] = storage.subir(video, tid, "final.mp4")

        db.registrar_uso(trabajo["device_id"], trabajo["tipo"])
        db.actualizar(tid, status="done", **campos)
    except Exception as e:
        traceback.print_exc()  # lo crudo (inglés) va al log, no al usuario
        db.actualizar(tid, status="error", error=_error_usuario(e))


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

        campos = {
            "antes": storage.subir(rutas[0], tid, "antes.png"),
            "despues": storage.subir(rutas[-1], tid, "despues.png"),
            "video": storage.subir(video, tid, "final.mp4"),
        }
        db.actualizar(tid, status="done", **campos)
    except Exception as e:
        traceback.print_exc()
        db.actualizar(tid, status="error", error=_error_usuario(e))
