"""Configuración del backend de la app de reforma."""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

# ─── API keys ────────────────────────────────────────────────────────────────
GROQ_API_KEY        = os.getenv("GROQ_API_KEY", "")
REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN", "")
# Clave de administrador (dueño) para otorgar premium manualmente. Se define
# como env var en Render; si está vacía, el endpoint /admin/premium queda cerrado.
ADMIN_KEY           = os.getenv("ADMIN_KEY", "")
# Topic de ntfy.sh para avisos al dueño (sin crédito, errores). Vacío = sin avisos.
NTFY_TOPIC          = os.getenv("NTFY_TOPIC", "")
# Dispositivos del DUEÑO sin límites de cuota (coma-separados). Solo se puede
# definir como env var en Render — no hay endpoint que lo modifique, así que
# nadie puede auto-agregarse. Estos dispositivos: sin límite diario de imágenes/
# videos/chats, sin tope por IP y tratados como premium (sin marca, sin ads).
ADMIN_DEVICES       = {d.strip() for d in os.getenv("ADMIN_DEVICES", "").split(",") if d.strip()}

# ─── Persistencia externa (Supabase) ─────────────────────────────────────────
# Sin esto, el backend cae a SQLite local + disco local (solo dev; en Render
# free se BORRA). Con esto, trabajos → Postgres y media → Supabase Storage,
# ambos sobreviven a los reinicios del contenedor.
DATABASE_URL          = os.getenv("DATABASE_URL", "")          # postgres de Supabase
SUPABASE_URL          = os.getenv("SUPABASE_URL", "")          # https://xxxx.supabase.co
SUPABASE_SERVICE_KEY  = os.getenv("SUPABASE_SERVICE_KEY", "")  # service_role key
SUPABASE_BUCKET       = os.getenv("SUPABASE_BUCKET", "reforma")  # bucket público

USA_POSTGRES = bool(DATABASE_URL)
USA_SUPABASE = bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)

# ─── Modelos (validados en shorts-pipeline) ──────────────────────────────────
GROQ_MODEL   = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
EDIT_MODEL   = os.getenv("EDIT_MODEL", "black-forest-labs/flux-kontext-pro")  # edita preservando
VIDEO_MODEL  = os.getenv("VIDEO_MODEL", "bytedance/seedance-1.5-pro")         # anima (last_frame)
INPAINT_MODEL = os.getenv("INPAINT_MODEL", "black-forest-labs/flux-fill-pro")  # pincel/máscara
STYLE_MODEL   = os.getenv("STYLE_MODEL", "black-forest-labs/flux-2-pro")       # transferencia estilo

CLIP_SECONDS = int(os.getenv("CLIP_SECONDS", "5"))
RESOLUTION   = os.getenv("RESOLUTION", "720p")

# ─── Control de costos (lección CatchCat: topes ANTES de llamar a Replicate) ─
# Por dispositivo y por día. El video es caro → tope bajo (premium).
IMAGENES_GRATIS_DIA = int(os.getenv("IMAGENES_GRATIS_DIA", "3"))
# 3/día durante la fase de pruebas con amigos (cada video ~$0.25 de Replicate).
# Ajústalo en Render sin recompilar el APK: env var VIDEOS_GRATIS_DIA.
VIDEOS_GRATIS_DIA   = int(os.getenv("VIDEOS_GRATIS_DIA", "3"))
# ── Tier PREMIUM (suscripción) ──────────────────────────────────────────────
# Video cuesta ~$0.25 → mantener bajo aunque sea premium (o perder margen).
IMAGENES_PREMIUM_DIA = int(os.getenv("IMAGENES_PREMIUM_DIA", "10"))
VIDEOS_PREMIUM_DIA   = int(os.getenv("VIDEOS_PREMIUM_DIA", "1"))
# Tope global de seguridad: máximo de videos que TODO el sistema genera por día,
# sin importar cuántos dispositivos haya. Freno de mano contra un pico viral.
VIDEOS_GLOBAL_DIA   = int(os.getenv("VIDEOS_GLOBAL_DIA", "50"))
# Mensajes/día al asesor por dispositivo (Groq free tier aguanta de sobra)
ASESOR_MENSAJES_DIA = int(os.getenv("ASESOR_MENSAJES_DIA", "30"))

# Topes por IP: segunda línea de defensa (el device_id lo genera el cliente y
# es falsificable con curl). Más holgados que los de device porque una IP de
# CGNAT/universidad puede agrupar a muchos usuarios legítimos.
IMAGENES_IP_DIA = int(os.getenv("IMAGENES_IP_DIA", "20"))
VIDEOS_IP_DIA   = int(os.getenv("VIDEOS_IP_DIA", "4"))
CHATS_IP_DIA    = int(os.getenv("CHATS_IP_DIA", "80"))

# ─── Rutas ───────────────────────────────────────────────────────────────────
DATA   = ROOT / "data"
DB_PATH = DATA / "reforma.db"

# Fuente para overlays de ffmpeg (en deploy Linux cambiar a una .ttf disponible)
FONT_PATH = os.getenv("FONT_PATH", "C:/Windows/Fonts/arialbd.ttf")

DATA.mkdir(exist_ok=True)
