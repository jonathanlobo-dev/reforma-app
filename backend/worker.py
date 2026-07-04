"""Procesamiento de un trabajo en segundo plano: plan → editar → imagen/video.

Corre vía FastAPI BackgroundTasks (MVP). En producción se cambia por una cola
real (Redis/RQ) sin tocar esta lógica.
"""
import traceback

import config
import db
import pipeline
import storage
from categorias import CATEGORIAS


def procesar(tid: str) -> None:
    trabajo = db.obtener(tid)
    if not trabajo:
        return
    carpeta = config.DATA / tid
    carpeta.mkdir(parents=True, exist_ok=True)
    try:
        db.actualizar(tid, status="processing")
        cat = CATEGORIAS[trabajo["categoria"]]

        # La foto ya fue guardada por el endpoint como <carpeta>/antes.<ext>
        antes = next(carpeta.glob("antes.*"))

        # 1) Plan (Groq) + FILTRO de contenido/intención (antes de gastar Replicate)
        try:
            plan = pipeline.generar_plan(cat["titulo"], cat["guia_llm"], trabajo["detalle"] or "")
        except pipeline.PeticionRechazada as e:
            db.actualizar(tid, status="error", error=str(e)[:300])
            return

        # 2) Editar preservando el espacio (flux-kontext)
        despues = carpeta / "despues.png"
        url_antes, url_despues = pipeline.editar(antes, plan["edit_prompt"], despues)

        # 3) Comparación antes/después (siempre, es el compartible base)
        comp = carpeta / "comparacion.png"
        pipeline.comparacion(antes, despues, comp)

        # 4) Video según tipo
        video = None
        if trabajo["tipo"] == "video":
            video = carpeta / "final.mp4"
            pipeline.animar(url_antes, url_despues, plan.get("motion_prompt", ""), video)

        # 5) Watermark "Reforma AI" en los archivos que el usuario comparte/descarga.
        #    No al 'antes' — es la referencia original.
        pipeline._watermark(despues)
        pipeline._watermark(comp)
        if video:
            pipeline._watermark(video)

        # 6) Subir resultados a storage persistente (Supabase o /media local).
        #    Guardamos URLs completas — sobreviven al reinicio del contenedor.
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
