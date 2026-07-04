"""API del backend de reforma (FastAPI).

Endpoints:
  GET  /health                    → estado
  GET  /categorias                → catálogo para la UI
  POST /trabajos                  → crea trabajo (foto + categoria + detalle + tipo + device_id)
  GET  /trabajos/{id}             → estado + URLs de resultados
  /media/...                      → sirve los archivos generados
"""
import shutil
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import config
import db
from categorias import CATEGORIAS, resolver
from worker import procesar

app = FastAPI(title="Reforma AI — backend")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.mount("/media", StaticFiles(directory=config.DATA), name="media")

db.init()

EXT_OK = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/categorias")
def categorias():
    return {k: {"titulo": v["titulo"], "emoji": v["emoji"],
                "tipo_default": v["tipo_default"], "campos": v["campos"],
                "engine": v.get("engine", "editar")}
            for k, v in CATEGORIAS.items()}


def _urls(trabajo: dict) -> dict:
    """Devuelve las URLs de resultados. Ya están completas en la DB:
    Supabase → https absoluta; local → /media/<id>/<archivo> (el frontend le
    antepone API_BASE)."""
    return {k: trabajo[k] for k in ("antes", "despues", "comparacion", "video")
            if trabajo.get(k)}


@app.post("/trabajos")
async def crear_trabajo(
    background: BackgroundTasks,
    device_id: str = Form(...),
    categoria: str = Form(...),
    detalle: str = Form(""),
    tipo: str = Form(""),
    foto: UploadFile = File(...),
):
    cat = resolver(categoria)
    tipo = tipo or cat["tipo_default"]
    if tipo not in ("imagen", "video"):
        raise HTTPException(400, "tipo debe ser 'imagen' o 'video'")
    if foto.content_type not in EXT_OK:
        raise HTTPException(400, "La foto debe ser JPG, PNG o WEBP")

    # Control de costos ANTES de aceptar el trabajo
    ok, motivo = db.puede_generar(device_id, tipo)
    if not ok:
        raise HTTPException(429, motivo)

    tid = db.crear_trabajo(device_id, categoria, detalle, tipo)
    carpeta = config.DATA / tid
    carpeta.mkdir(parents=True, exist_ok=True)
    destino = carpeta / f"antes{EXT_OK[foto.content_type]}"
    with open(destino, "wb") as f:
        shutil.copyfileobj(foto.file, f)

    background.add_task(procesar, tid)
    return {"id": tid, "status": "pending", "tipo": tipo}


@app.get("/trabajos")
def historial(device_id: str, limit: int = 30):
    trabajos = db.listar(device_id, min(limit, 50))
    return [
        {
            "id": t["id"], "status": t["status"], "tipo": t["tipo"],
            "categoria": t["categoria"], "detalle": (t.get("detalle") or "")[:120],
            "creado": t.get("creado"), "error": t["error"],
            "resultados": _urls(t),
        }
        for t in trabajos
    ]


@app.get("/trabajos/{tid}")
def estado_trabajo(tid: str):
    trabajo = db.obtener(tid)
    if not trabajo:
        raise HTTPException(404, "Trabajo no encontrado")
    return {
        "id": trabajo["id"], "status": trabajo["status"], "tipo": trabajo["tipo"],
        "categoria": trabajo.get("categoria"), "creado": trabajo.get("creado"),
        "error": trabajo["error"], "resultados": _urls(trabajo),
    }
