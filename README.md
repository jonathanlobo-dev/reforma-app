# Reforma AI

App: el usuario sube la foto de SU espacio (cuarto, cocina, mueble, auto, pared)
y recibe una transformación —restaurar, pintar, cambiar muebles, remodelar— que
**preserva su espacio real** (flux-kontext) como imagen antes/después o video
animado (Seedance / crossfade).

Motor validado en `../shorts-pipeline` (pruebas con fotos reales). Este repo es
el producto: backend (API) + frontend (Capacitor + AdMob, funcional).

## Deploy del backend (Render, gratis)

El repo trae `render.yaml` + `backend/Dockerfile` (con ffmpeg y fuente DejaVu):

1. Crea cuenta en render.com (botón "Sign in with GitHub").
2. Dashboard → **New → Blueprint** → elige este repo → Render lee `render.yaml`.
3. Te pedirá `GROQ_API_KEY` y `REPLICATE_API_TOKEN` → pégalas → Apply.
4. Al terminar tendrás una URL tipo `https://reforma-backend.onrender.com`.
5. En `frontend/src/config.ts`: `API_BASE = "<esa URL>"` y `MOCK = false`,
   luego `npm run build && npx cap sync android` y Run en Android Studio.

Limitaciones del plan free (aceptables para probar):
- **Se duerme tras ~15 min sin uso** → la primera petición tarda ~1 min en
  despertar (la app puede dar error la primera vez; reintentar).
- **Disco efímero** → los resultados generados se pierden en cada redeploy.
  (El siguiente paso real es storage S3/R2.)

## backend/  (FastAPI + Python)

Reutiliza el motor probado como servicio.

```
config.py       claves, modelos, TOPES de costo por día
categorias.py   catálogo (pintar/muebles/restaurar/remodelar) — lo usa la UI
pipeline.py     motor: Groq (plan) + flux-kontext (editar) + Seedance/ffmpeg (video)
db.py           SQLite: trabajos + cuota diaria por dispositivo (control de costos)
worker.py       procesa un trabajo (plan → editar → imagen/video)
main.py         API FastAPI
```

### Endpoints
- `GET /health`
- `GET /categorias` — catálogo para la UI
- `POST /trabajos` — multipart: `device_id`, `categoria`, `detalle`, `tipo`(imagen|video), `foto`
- `GET /trabajos/{id}` — estado + URLs de resultados
- `/media/{id}/...` — sirve los archivos generados

### Correr local
```
cd backend
pip install -r requirements.txt          # + ffmpeg en el PATH
# .env con GROQ_API_KEY y REPLICATE_API_TOKEN
python -m uvicorn main:app --reload --port 8077
```

### Control de costos (lección CatchCat)
`db.puede_generar()` se llama ANTES de tocar Replicate: tope de imágenes/día y
videos/día por dispositivo, más un tope GLOBAL de videos/día (freno anti-viral).
Todo configurable por env en `config.py`.

## Pendiente
- **Cola real** (Redis/RQ) en vez de BackgroundTasks para escalar.
- **Storage** en S3/R2 en vez de disco local (en Render free el disco es efímero).
- **Pagos** para el tier premium (video) — mecanismo LATAM por definir.

## 🔒 Prompts del producto

Los prompts afinados del planificador/asesor y el catálogo completo de categorías
viven en `backend/prompts_privados.py`, que **no se versiona**. Para ejecutar el
backend copia `backend/prompts_privados.example.py` como `prompts_privados.py`
(en Render: súbelo como *Secret File*). La plantilla trae versiones genéricas
funcionales con 2 categorías de muestra.
