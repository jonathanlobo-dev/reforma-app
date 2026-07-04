"""Configuración del backend de la app de reforma."""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

# ─── API keys ────────────────────────────────────────────────────────────────
GROQ_API_KEY        = os.getenv("GROQ_API_KEY", "")
REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN", "")

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
GROQ_MODEL  = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
EDIT_MODEL  = os.getenv("EDIT_MODEL", "black-forest-labs/flux-kontext-pro")  # edita preservando
VIDEO_MODEL = os.getenv("VIDEO_MODEL", "bytedance/seedance-1.5-pro")         # anima (last_frame)

CLIP_SECONDS = int(os.getenv("CLIP_SECONDS", "5"))
RESOLUTION   = os.getenv("RESOLUTION", "720p")

# ─── Control de costos (lección CatchCat: topes ANTES de llamar a Replicate) ─
# Por dispositivo y por día. El video es caro → tope bajo (premium).
IMAGENES_GRATIS_DIA = int(os.getenv("IMAGENES_GRATIS_DIA", "5"))
VIDEOS_GRATIS_DIA   = int(os.getenv("VIDEOS_GRATIS_DIA", "1"))
# Tope global de seguridad: máximo de videos que TODO el sistema genera por día,
# sin importar cuántos dispositivos haya. Freno de mano contra un pico viral.
VIDEOS_GLOBAL_DIA   = int(os.getenv("VIDEOS_GLOBAL_DIA", "50"))

# ─── Rutas ───────────────────────────────────────────────────────────────────
DATA   = ROOT / "data"
DB_PATH = DATA / "reforma.db"

# Fuente para overlays de ffmpeg (en deploy Linux cambiar a una .ttf disponible)
FONT_PATH = os.getenv("FONT_PATH", "C:/Windows/Fonts/arialbd.ttf")

DATA.mkdir(exist_ok=True)
