"""API del backend de reforma (FastAPI).

Endpoints:
  GET  /health                    → estado
  GET  /categorias                → catálogo para la UI
  POST /trabajos                  → crea trabajo (foto + categoria + detalle + tipo + device_id)
  GET  /trabajos/{id}             → estado + URLs de resultados
  /media/...                      → sirve los archivos generados
"""
import shutil
import time
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import config
import db
import i18n
import pipeline
from categorias import categorias_traducidas, resolver
from worker import procesar, procesar_proceso

app = FastAPI(title="RenuevAI — backend")
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


@app.get("/privacidad")
@app.get("/privacy")
def privacidad():
    """Política de privacidad pública (Play Console / AdMob / RevenueCat)."""
    return FileResponse(config.ROOT / "privacidad.html", media_type="text/html")


@app.get("/categorias")
def categorias(lang: str = "es"):
    return categorias_traducidas(lang)


def _urls(trabajo: dict) -> dict:
    """Devuelve las URLs de resultados. Ya están completas en la DB:
    Supabase → https absoluta; local → /media/<id>/<archivo> (el frontend le
    antepone API_BASE)."""
    return {k: trabajo[k] for k in ("antes", "despues", "comparacion", "video", "limpio")
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
    lang: str = Form("es"),
    foto: UploadFile = File(...),
    mask: UploadFile | None = File(None),        # engine=inpaint (PNG b/n del pincel)
    referencia: UploadFile | None = File(None),  # engine=estilo (foto de inspiración)
):
    lang = i18n.normalizar_lang(lang)
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
    ok, clave, params = db.puede_generar(device_id, tipo)
    if not ok:
        raise HTTPException(429, i18n.cuota_msg(clave, lang, **params))
    ip = _ip_cliente(request)
    if not db.puede_ip(ip, "imagenes" if tipo == "imagen" else "videos"):
        raise HTTPException(429, i18n.cuota_msg("limite_ip", lang))
    db.registrar_ip(ip, "imagenes" if tipo == "imagen" else "videos")

    tid = db.crear_trabajo(device_id, categoria, detalle, tipo, proyecto.strip()[:60], lang)
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


@app.post("/proceso")
def crear_proceso(
    background: BackgroundTasks,
    device_id: str = Form(...),
    trabajo_ids: str = Form(...),  # ids separados por coma, en orden de edición
    lang: str = Form("es"),
):
    """Video del PROCESO (premium): foto original → cada edición → final,
    con fundidos. Solo ffmpeg, sin costo de Replicate, por eso no consume
    la cuota de videos."""
    if not db.es_premium(device_id):
        raise HTTPException(402, "El video del proceso es una función Premium.")
    ids = [t.strip() for t in trabajo_ids.split(",") if t.strip()][:8]
    if len(ids) < 2:
        raise HTTPException(400, "Se necesitan al menos 2 ediciones para el video del proceso.")

    imagenes: list[str] = []
    for i, tid in enumerate(ids):
        t = db.obtener(tid)
        if not t or t["device_id"] != device_id or t["status"] != "done":
            raise HTTPException(404, f"Edición {i + 1} no encontrada.")
        if i == 0 and t.get("antes"):
            imagenes.append(t["antes"])          # la foto original arranca el video
        resultado = t.get("limpio") or t.get("despues")
        if resultado:
            imagenes.append(resultado)
    if len(imagenes) < 2:
        raise HTTPException(400, "No hay suficientes imágenes para montar el video.")

    nuevo = db.crear_trabajo(device_id, "proceso", f"Video del proceso ({len(imagenes)} pasos)", "video",
                             lang=i18n.normalizar_lang(lang))
    background.add_task(procesar_proceso, nuevo, imagenes)
    return {"id": nuevo, "status": "pending", "tipo": "video"}


@app.get("/premium")
def premium(device_id: str):
    """Estado premium del dispositivo. El frontend lo consulta al abrir la app
    y tras una compra. La ACTIVACIÓN real la hará RevenueCat (validando la
    compra) llamando a db.activar_premium — nunca desde un endpoint abierto."""
    return db.estado_premium(device_id)


@app.post("/admin/premium")
def admin_premium(
    device_id: str = Form(...),
    dias: int = Form(365),
    x_admin_key: str = Header(""),
):
    """Otorga premium a un device_id. SOLO para el dueño: exige la clave secreta
    ADMIN_KEY (env var en Render, NUNCA en el APK). Así ni un APK modeado ni
    nadie sin la clave puede darse premium — la decisión vive en el servidor.
    Uso: curl -X POST .../admin/premium -H "X-Admin-Key: TU_CLAVE"
             -F device_id=XXXX -F dias=365"""
    if not config.ADMIN_KEY or x_admin_key != config.ADMIN_KEY:
        raise HTTPException(403, "No autorizado")
    hasta = time.time() + max(1, dias) * 86400
    db.activar_premium(device_id, hasta, "admin")
    return {"ok": True, "device_id": device_id, "dias": dias}


@app.get("/admin/stats")
def admin_stats(x_admin_key: str = Header("")):
    """Métricas globales para el dashboard del dueño. Misma protección que
    /admin/premium: exige ADMIN_KEY."""
    if not config.ADMIN_KEY or x_admin_key != config.ADMIN_KEY:
        raise HTTPException(403, "No autorizado")
    return db.stats()


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
    lang: str | None = None       # idioma del usuario (es/en/pt/it); default es


@app.post("/asesor")
def asesor(req: AsesorReq, request: Request):
    if not req.mensajes or req.mensajes[-1].role != "user":
        raise HTTPException(400, "Falta el mensaje del usuario")
    lang = i18n.normalizar_lang(req.lang)
    ok, clave, params = db.puede_chatear(req.device_id)
    if not ok:
        raise HTTPException(429, i18n.cuota_msg(clave, lang, **params))
    ip = _ip_cliente(request)
    if not db.puede_ip(ip, "chats"):
        raise HTTPException(429, i18n.cuota_msg("limite_ip", lang))
    db.registrar_ip(ip, "chats")

    system = pipeline.ASESOR_SYSTEM + i18n.asesor_idioma_instruccion(lang)
    if req.contexto:
        system += f"\n\nCONTEXTO de la transformación que el usuario generó en la app: {req.contexto[:400]}"

    # Historial acotado: últimos 12 turnos, cada uno recortado (control de tokens)
    historia = [{"role": m.role, "content": m.content[:1500]}
                for m in req.mensajes[-12:] if m.role in ("user", "assistant")]

    respuesta = pipeline.groq_chat([{"role": "system", "content": system}] + historia)
    db.registrar_chat(req.device_id)
    return {"respuesta": respuesta}
