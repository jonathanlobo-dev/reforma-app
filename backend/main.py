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

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import config
import db
import pipeline
from categorias import CATEGORIAS, resolver
from worker import procesar

app = FastAPI(title="Reforma AI — backend")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.mount("/media", StaticFiles(directory=config.DATA), name="media")

db.init()

EXT_OK = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


def _ip_cliente(request: Request) -> str:
    """IP real detrás del proxy de Render (primer valor de X-Forwarded-For)."""
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else ""


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
    request: Request,
    background: BackgroundTasks,
    device_id: str = Form(...),
    categoria: str = Form(...),
    detalle: str = Form(""),
    tipo: str = Form(""),
    proyecto: str = Form(""),
    foto: UploadFile = File(...),
    mask: UploadFile | None = File(None),        # engine=inpaint (PNG b/n del pincel)
    referencia: UploadFile | None = File(None),  # engine=estilo (foto de inspiración)
):
    cat = resolver(categoria)
    engine = cat.get("engine", "editar")
    tipo = tipo or cat["tipo_default"]
    if tipo not in ("imagen", "video"):
        raise HTTPException(400, "tipo debe ser 'imagen' o 'video'")
    if foto.content_type not in EXT_OK:
        raise HTTPException(400, "La foto debe ser JPG, PNG o WEBP")
    if engine == "inpaint" and not mask:
        raise HTTPException(400, "Este modo necesita la máscara del pincel")
    if engine == "estilo" and not referencia:
        raise HTTPException(400, "Este modo necesita la foto de referencia")
    if referencia and referencia.content_type not in EXT_OK:
        raise HTTPException(400, "La referencia debe ser JPG, PNG o WEBP")

    # Control de costos ANTES de aceptar el trabajo (device + IP)
    ok, motivo = db.puede_generar(device_id, tipo)
    if not ok:
        raise HTTPException(429, motivo)
    ip = _ip_cliente(request)
    if not db.puede_ip(ip, "imagenes" if tipo == "imagen" else "videos"):
        raise HTTPException(429, "Se alcanzó el límite diario desde esta red. Intenta mañana.")
    db.registrar_ip(ip, "imagenes" if tipo == "imagen" else "videos")

    tid = db.crear_trabajo(device_id, categoria, detalle, tipo, proyecto.strip()[:60])
    carpeta = config.DATA / tid
    carpeta.mkdir(parents=True, exist_ok=True)
    destino = carpeta / f"antes{EXT_OK[foto.content_type]}"
    with open(destino, "wb") as f:
        shutil.copyfileobj(foto.file, f)
    if mask:
        with open(carpeta / "mask.png", "wb") as f:
            shutil.copyfileobj(mask.file, f)
    if referencia:
        with open(carpeta / f"referencia{EXT_OK[referencia.content_type]}", "wb") as f:
            shutil.copyfileobj(referencia.file, f)

    background.add_task(procesar, tid)
    return {"id": tid, "status": "pending", "tipo": tipo}


@app.get("/trabajos")
def historial(device_id: str, limit: int = 30):
    trabajos = db.listar(device_id, max(1, min(limit, 50)))
    return [
        {
            "id": t["id"], "status": t["status"], "tipo": t["tipo"],
            "categoria": t["categoria"], "detalle": (t.get("detalle") or "")[:120],
            "proyecto": t.get("proyecto"), "creado": t.get("creado"),
            "error": t["error"], "resultados": _urls(t),
        }
        for t in trabajos
    ]


@app.delete("/trabajos/{tid}")
def borrar_trabajo(tid: str, device_id: str):
    if not db.ocultar(tid, device_id):
        raise HTTPException(404, "Trabajo no encontrado")
    return {"ok": True}


class FeedbackReq(BaseModel):
    trabajo_id: str
    voto: int  # 1 = 👍, -1 = 👎


@app.post("/feedback")
def feedback(req: FeedbackReq):
    if req.voto not in (1, -1):
        raise HTTPException(400, "voto debe ser 1 o -1")
    db.votar(req.trabajo_id, req.voto)
    return {"ok": True}


@app.get("/trabajos/{tid}")
def estado_trabajo(tid: str):
    trabajo = db.obtener(tid)
    if not trabajo:
        raise HTTPException(404, "Trabajo no encontrado")
    return {
        "id": trabajo["id"], "status": trabajo["status"], "tipo": trabajo["tipo"],
        "categoria": trabajo.get("categoria"), "creado": trabajo.get("creado"),
        "detalle": trabajo.get("detalle"),
        "error": trabajo["error"], "resultados": _urls(trabajo),
    }


# ─── Asesor "El Maestro" (chatbot 3-en-1: obra + decoración + materiales) ────

class MensajeChat(BaseModel):
    role: str      # "user" | "assistant"
    content: str

class AsesorReq(BaseModel):
    device_id: str
    mensajes: list[MensajeChat]
    contexto: str | None = None   # ej. "Remodelar: cocina moderna minimalista"


@app.post("/asesor")
def asesor(req: AsesorReq, request: Request):
    if not req.mensajes or req.mensajes[-1].role != "user":
        raise HTTPException(400, "Falta el mensaje del usuario")
    ok, motivo = db.puede_chatear(req.device_id)
    if not ok:
        raise HTTPException(429, motivo)
    ip = _ip_cliente(request)
    if not db.puede_ip(ip, "chats"):
        raise HTTPException(429, "Se alcanzó el límite diario desde esta red. Intenta mañana.")
    db.registrar_ip(ip, "chats")

    system = pipeline.ASESOR_SYSTEM
    if req.contexto:
        system += f"\n\nCONTEXTO de la transformación que el usuario generó en la app: {req.contexto[:400]}"

    # Historial acotado: últimos 12 turnos, cada uno recortado (control de tokens)
    historia = [{"role": m.role, "content": m.content[:1500]}
                for m in req.mensajes[-12:] if m.role in ("user", "assistant")]

    respuesta = pipeline.groq_chat([{"role": "system", "content": system}] + historia)
    db.registrar_chat(req.device_id)
    return {"respuesta": respuesta}
