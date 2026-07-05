"""Procesamiento de un trabajo en segundo plano: plan → generar → imagen/video.

Corre vía FastAPI BackgroundTasks (MVP). En producción se cambia por una cola
real (Redis/RQ) sin tocar esta lógica.

Engines:
  editar  → flux-kontext (prompt de Groq + filtro)
  inpaint → flux-fill-pro (máscara del pincel + prompt de Groq + filtro)
  estilo  → flux-2-pro (foto + referencia, prompt fijo, sin Groq)
  plano   → flux-kontext (prompt fijo especializado, sin texto del usuario)
"""
import traceback

import config
import db
import pipeline
import storage
from categorias import CATEGORIAS

_PROMPT_PLANO = (
    "Convert this 2D architectural floor plan into a realistic 3D furnished "
    "top-down isometric render. Keep exactly the same room layout, wall "
    "positions and proportions as the plan. Modern tasteful furniture, "
    "soft daylight, architectural visualization quality."
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

        # Watermark "Reforma AI" en lo que el usuario comparte (no en 'antes')
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
        if video:
            campos["video"] = storage.subir(video, tid, "final.mp4")

        db.registrar_uso(trabajo["device_id"], trabajo["tipo"])
        db.actualizar(tid, status="done", **campos)
    except Exception as e:
        traceback.print_exc()
        db.actualizar(tid, status="error", error=str(e)[:300])
