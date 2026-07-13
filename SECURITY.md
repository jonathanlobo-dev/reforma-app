# Seguridad — RenuevAI (reforma-app)

Invariantes de seguridad del proyecto. **Cualquier cambio de código debe
respetarlas**; si una modificación las rompe, es un bug de seguridad aunque
"funcione". Última auditoría completa: 2026-07-13 (superficie de ataque +
clases de vulnerabilidad, estilo audit-codebase).

## Invariantes (NO romper)

1. **Toda decisión de costo/privilegio vive en el SERVIDOR.** Cuotas
   (`db.puede_generar/puede_chatear/puede_ip`), premium (`db.es_premium`) y
   filtro de contenido (Groq `_SYSTEM_PLAN`) se chequean en el backend ANTES de
   gastar Replicate. El APK es territorio hostil: nunca confiar en flags,
   contadores ni precios que vengan del cliente.
2. **Secretos solo en env vars del servidor** (Render): `REPLICATE_API_TOKEN`,
   `GROQ_API_KEY`, `ADMIN_KEY`, `ADMIN_DEVICES`, `NTFY_TOPIC`, `DATABASE_URL`.
   Nunca en el frontend, el APK, el repo ni en `NEXT_PUBLIC_`-style vars.
   `.env` está en `.gitignore`; solo se versiona `.env.example`.
3. **Endpoints `/admin/*`**: exigen header `X-Admin-Key` comparado con
   `hmac.compare_digest` (tiempo constante). Sin `ADMIN_KEY` en el entorno →
   403 siempre. No crear jamás un endpoint que otorgue premium/privilegios sin
   esta protección.
4. **`ADMIN_DEVICES`** (dispositivos sin límites) solo se define como env var —
   no debe existir endpoint, tabla ni comando que la modifique.
5. **Doble tope de cuota**: por `device_id` Y por IP (`uso_ip`,
   `X-Forwarded-For`). El tope por IP es la defensa contra device_ids
   falsificados; no quitarlo "porque estorba en dev".
6. **Uploads**: solo `content_type` en `EXT_OK` (jpg/png/webp); la extensión en
   disco se deriva del content-type, NUNCA del filename del cliente (path
   traversal). Los archivos se guardan bajo `DATA/<uuid4>/` generado por el
   servidor.
7. **`/proceso`**: los `trabajo_ids` se validan contra la DB (dueño + status
   done) y las imágenes salen de las URLs guardadas por el worker. NUNCA
   aceptar URLs arbitrarias del cliente (SSRF) ni pasarlas a `_bajar()`.
8. **Borrado/consulta de historial**: `/trabajos` (GET/DELETE) exigen el
   `device_id` dueño. `/trabajos/{id}` es accesible por id (uuid4 = enlace no
   adivinable, tipo "unlisted") — aceptado a propósito para compartir; no
   poner datos sensibles en la respuesta.
9. **Postgres (Supabase) con RLS activado** en todas las tablas — la API REST
   pública (anon key) queda bloqueada; solo el backend (rol postgres del
   pooler) accede. No desactivar RLS ni crear políticas permisivas.
10. **El Maestro (chat)**: system prompt con instrucciones fijas anti-inyección
    (rechaza "ignora tus instrucciones", cambio de rol, generación de prompts
    para otras IAs, contenido ilegal). El CONTEXTO del usuario se trata como
    dato. Salida en texto plano (el cliente escapa HTML en `formatearBot`).
11. **Privacidad**: nunca versionar fotos reales del usuario en el repo ni
    usarlas como assets de la app (los assets se generan con IA). `patio.jpg`
    y `photo_*` están ignorados.
12. **ffmpeg en Render (512 MB)**: máximo 2 imágenes decodificadas a la vez y
    `x264 threads=2` en todo encode. Un ffmpeg multi-input sin acotar tumbó el
    servicio (OOM, jul 2026).

## Riesgos aceptados (decisión consciente)

- CORS `allow_origins=["*"]`: no hay cookies ni sesiones; la auth es por
  header/clave. Revisar si algún día se agregan cookies.
- Resultados en bucket público de Supabase bajo ruta uuid4: quien tenga la URL
  puede ver la imagen (equivalente a "link no listado").
- `device_id` autogenerado sin login: la identidad es débil por diseño de MVP;
  la mitigación es el doble tope de cuota. Con pagos reales (RevenueCat) la
  activación premium la validará el servidor contra el recibo de compra.

## Al agregar features nuevas — checklist

- ¿El endpoint nuevo gasta dinero o da privilegios? → cuota/clave server-side.
- ¿Recibe archivos o URLs del cliente? → validar content-type / prohibir URLs.
- ¿Devuelve datos de un usuario? → exigir su device_id.
- ¿Usa ffmpeg? → acotar inputs y threads.
- ¿Nuevo secreto? → env var en Render + `.env.example` sin el valor.
