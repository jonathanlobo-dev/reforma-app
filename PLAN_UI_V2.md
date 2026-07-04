# PLAN v2 — Rediseño pro + funciones nuevas (para Sonnet)

Documento autocontenido. Ejecuta por FASES en orden. La app ya funciona
(backend en Render + Supabase, frontend Capacitor Android). Esto es un
**rediseño visual grande (tema oscuro premium)** + funciones inspiradas en dos
apps de referencia (Interio y una tipo "AI Remodel"). El usuario aprobó tema
OSCURO y las 3 funciones avanzadas (pincel/inpainting, transferencia de estilo,
plano 2D→3D).

Rutas: `frontend/` (Vite+TS+Capacitor), `backend/` (FastAPI). Backend en
producción: `https://reforma-backend-cgu8.onrender.com` (config en
`frontend/src/config.ts`).

---

## ⚠️ Presupuesto de crédito (LEER)

El usuario tiene ~$0.63 en Replicate. Las **Fases 1 y 2 casi no gastan** (UI en
modo MOCK + funciones que reusan flux-kontext ya validado). La **Fase 3
(avanzadas) SÍ necesita crédito** para validar 3 modelos nuevos. **Antes de la
Fase 3, pídele al usuario que recargue (≥$5).** En Fase 3, valida cada modelo con
UNA sola imagen de prueba y confirma la calidad visualmente ANTES de construir su
UI completa. Si un modelo da mala calidad, PÁRATE y repórtalo — no shippees algo roto.

---

## Sistema de diseño (tema oscuro premium) — usa estos tokens exactos

En `frontend/src/styles.css` reemplaza las variables por:
```css
--bg: #0c0c10;            /* fondo casi negro */
--surface: #17181f;      /* tarjetas */
--surface2: #1f2029;     /* inputs, chips */
--borde: #2a2b36;
--acento: #6d5efc;       /* violeta/indigo premium */
--acento-press: #5a4be0;
--texto: #f4f4f7;
--sub: #9a9bab;
--exito: #37d67a;
--error: #ff5c6c;
--radio: 20px;           /* tarjetas grandes muy redondeadas */
```
Principios: fondo casi negro, tarjetas con imagen de fondo + degradado oscuro
abajo para el texto (como las capturas), tipografía bold en títulos, mucho aire,
esquinas muy redondeadas, un solo acento violeta. Mobile-first, español.

---

## FASE 1 — Rediseño visual + funciones fáciles (SIN crédito, usa MOCK=true para dev)

> Pon MOCK=true en config.ts mientras desarrollas la UI; al final vuelve a false.

### 1.1 Navegación con barra inferior
3 tabs (como las referencias), reutiliza el router `nav.ts` existente:
- **Inicio**: grilla de modos (cards grandes).
- **Generar**: atajo directo a elegir foto + modo (opcional; puede abrir Inicio).
- **Recientes**: historial (ver 1.5).
Barra fija abajo, ícono + label, tab activa en color --acento.

### 1.2 Home: tarjetas de modo (estilo referencia)
Cada modo = tarjeta grande con imagen de fondo (before/after split si tienes),
título bold, subtítulo, y toda la card es tocable (quita el botón "Probar", toda
la tarjeta navega). Modos a mostrar (ver tabla de categorías abajo). Las imágenes
de portada: usa las de `public/covers/` (crea placeholders con las muestras que ya
existen o genera unas simples; no bloquees por esto).

### 1.3 Flujo de entrada de foto (pantalla por modo)
Al tocar un modo → pantalla con:
- Zona "Tu foto" con botón **Añadir foto** (cámara/galería, ya existe `foto.ts`).
- **Muestras**: fila horizontal de 3-4 fotos de ejemplo (bundle en
  `public/samples/`, usa las fotos reales que ya están en `public/mock/` u otras)
  — tocar una la usa como foto sin subir nada. Bájalas como Blob con fetch.
- Los controles del modo (selectores, según la tabla).
- Botón **Generar**.

### 1.4 Controles reutilizables (componentes en `src/ui/`)
- **Selector de estilo**: carrusel horizontal de chips con miniatura + nombre
  (Moderno, Contemporáneo, Rústico, Minimalista, Industrial, Ecléctico,
  Escandinavo, Tradicional). El elegido resalta con borde --acento.
- **Selector de color**: modal con paleta de ~16 swatches (blancos, grises,
  tierras, verdes, azules, terracota, etc.) + nombre. Devuelve nombre legible.
- **Selector de superficie**: lista (Auto, Pared, Puerta, Ladrillo, Gabinete,
  Pared exterior, Piso) con ícono + radio.
- **Selector simple (dropdown/bottom-sheet)**: para "Habitación" (Sala, Cocina,
  Dormitorio, Baño, Comedor, Exterior) e "Intensidad" (Sutil, Media, Fuerte).
Todos estos controles solo COMPONEN un string `detalle` legible que se manda al
backend (ver 1.6). No requieren cambios de IA.

### 1.5 Recientes (historial)
Nuevo endpoint backend `GET /trabajos?device_id=X&limit=30` (ver Fase 2).
Grid de resultados pasados (miniatura = comparacion o despues, etiqueta =
categoría + resumen). Tocar → abre la pantalla de resultado. Botón basurero para
ocultar (borrado lógico opcional; mínimo: quitar de la vista).

### 1.6 Composición del `detalle`
Cada modo arma el `detalle` juntando sus controles, ej.:
- Pintar: `"Superficie: Pared. Color: Verde salvia. Intensidad: Media."`
- Diseño interior: `"Estilo: Moderno. Habitación: Sala de estar. Intensidad: Sutil."`
El backend ya convierte `detalle` en el prompt vía Groq (con el filtro de
seguridad ya incluido). No cambia el contrato para los modos estándar.

### 1.7 Resultado mejorado (estilo referencia)
- **Slider antes/después**: dos imágenes superpuestas con divisor arrastrable
  (para tipo imagen). Para video, el `<video>` como está.
- Feedback opcional **"¿Qué opinas? 👍/👎"** (guárdalo local o manda a un
  endpoint simple `POST /feedback` si lo agregas; opcional).
- Botones: **Descargar/Guardar** (ya existe, mejóralo para que confirme "Guardado
  en tu galería"), **Compartir**, **Generar de nuevo** (repite el mismo trabajo),
  **Hacer otra** (a Inicio).

---

## FASE 2 — Backend: watermark, historial y modos nuevos (bajo/nulo crédito)

### 2.1 Marca de agua "Reforma AI" (MARKETING VIRAL — importante)
En `pipeline.py`, agrega un watermark con ffmpeg drawtext a las salidas que el
usuario comparte/descarga: `comparacion.png`, `despues.png` y el `video`. NO al
`antes` (es la referencia). Texto pequeño semitransparente abajo-derecha:
`"Reforma AI"`. Reusa el patrón `_label`/drawtext ya presente. Hazlo en una
función `_watermark(path)` aplicada tras generar cada salida final.

### 2.2 Endpoint de historial
`main.py`: `GET /trabajos?device_id=X&limit=30` → lista de trabajos `done` de ese
device, más recientes primero, con id, categoria, detalle (recortado), y
`resultados`. Agrega `db.listar(device_id, limit)` (SELECT ... WHERE device_id=?
AND status='done' ORDER BY creado DESC LIMIT ?).

### 2.3 Modos nuevos (solo prompts especializados → reusan flux-kontext)
En `categorias.py` agrega estas categorías (cada una con `titulo`, `emoji`,
`tipo_default`, `campos`, `guia_llm`, y un nuevo campo **`engine`**):

| clave | título | engine | controles (campos/UI) |
|---|---|---|---|
| pintar | Pintar / color | `inpaint`* o `editar` | superficie, color, intensidad (+ máscara en Fase 3) |
| interior | Diseño de interiores | `editar` | estilo, habitación, intensidad |
| exterior | Diseño exterior | `editar` | estilo, intensidad |
| muebles | Cambiar / mover muebles | `editar` | acción libre |
| suelo | Suelo nuevo | `editar` | material (madera, porcelanato, mármol…) |
| paredes | Paredes nuevas | `editar` | acabado (pintura, ladrillo, piedra…) |
| eliminar | Eliminar objetos | `editar` | qué quitar |
| restaurar | Restaurar | `editar` | objeto, estilo |
| estilo | Transferencia de estilo | `estilo` | foto de referencia (Fase 3) |
| plano | Plano de planta 2D→3D | `plano` | (solo la foto del plano) (Fase 3) |

`engine` decide qué función del pipeline se usa (ver Fase 3). Para los `editar`
no cambia nada del backend actual salvo tener la categoría con buena `guia_llm`.
*Pintar arranca como `editar`; pasa a `inpaint` en Fase 3.

Añade `engine` al JSON de `GET /categorias` para que el frontend sepa el flujo.

---

## FASE 3 — Funciones avanzadas (NECESITA CRÉDITO — validar primero)

> Antes de empezar: confirma con el usuario que recargó Replicate (≥$5).
> Para cada una: valida el modelo con 1 test, mira el resultado, y solo si es
> bueno construye la UI. Modelos ya verificados que EXISTEN en Replicate:
> - inpainting: `black-forest-labs/flux-fill-pro` (inputs: image, mask, prompt)
> - estilo: `black-forest-labs/flux-2-pro` (inputs: input_images[], prompt)
> - plano: `black-forest-labs/flux-kontext-pro` (prompt-based, mismo que edición)

### 3.1 Pincel / máscara (inpainting) — la más compleja
**Backend** (`pipeline.py` + `worker.py` + `main.py`):
- Nueva función `inpaint(foto, mask, prompt, out)` que sube foto+máscara y llama a
  `flux-fill-pro` con `{image, mask, prompt}`. La máscara: blanco = zona a cambiar,
  negro = conservar (verifica la convención con el test; flux-fill usa blanco=editar).
- `POST /trabajos` acepta un archivo opcional `mask` (PNG) cuando la categoría es
  `inpaint`. Guárdalo como `mask.png` en la carpeta del trabajo. worker: si hay
  máscara y engine=inpaint, usa `inpaint()` en vez de `editar()`.
**Frontend** (pantalla de máscara, estilo la captura de Interio):
- Canvas encima de la foto: el usuario **pinta con el dedo** la zona a cambiar
  (pincel rojo semitransparente). Herramientas: pincel, borrador, deshacer/rehacer,
  slider de ancho de pincel, zoom.
- Al continuar, exporta la máscara como PNG en blanco/negro al tamaño de la foto
  (canvas oculto: pintado=blanco sobre fondo negro). Súbela junto con la foto.
- Escala bien las coordenadas del dedo al tamaño real de la imagen.
**Validación previa:** genera una máscara a mano (un PNG con un rectángulo blanco)
y prueba `flux-fill-pro` con la foto de una pared + prompt "paint this wall blue".
Confirma que solo cambia la zona enmascarada.

### 3.2 Transferencia de estilo
**Backend:** función `transferir_estilo(foto, referencia, out)` → `flux-2-pro` con
`input_images=[foto_url, referencia_url]` y prompt tipo "Redesign the room in the
first image adopting the interior style, colors and mood of the second reference
image. Keep the room's architecture, layout and perspective." `POST /trabajos`
acepta segundo archivo opcional `referencia` cuando engine=estilo.
**Frontend:** la pantalla del modo "estilo" pide DOS fotos: tu espacio + una foto
de referencia/inspiración. Preview de ambas.
**Validación:** 1 test con la cocina + una foto de cocina moderna de referencia.

### 3.3 Plano de planta 2D→3D
**Backend:** engine `plano` usa `flux-kontext-pro` con prompt "Convert this 2D
architectural floor plan into a realistic 3D furnished top-down isometric render,
keeping the same room layout and proportions." (mismo pipeline que editar, distinto
prompt — puedes meterlo como guia_llm de la categoría `plano`).
**Frontend:** modo normal de una foto (la del plano).
**Validación:** 1 test con una imagen de plano cualquiera. Si la calidad es mala,
repórtalo — es el de mayor riesgo; quizá haya que marcarlo "beta" o quitarlo.

---

## API — resumen de cambios
- `GET /categorias` → cada categoría añade `engine` ("editar"|"inpaint"|"estilo"|"plano").
- `GET /trabajos?device_id=X&limit=N` → NUEVO, historial.
- `POST /trabajos` → acepta archivos opcionales `mask` y `referencia` según engine.
- (opcional) `POST /feedback` → {trabajo_id, voto} para el 👍/👎.
Lo demás del contrato no cambia (ver README / código actual).

## Pruebas
- UI: MOCK=true + herramientas de preview del navegador para todo el flujo visual.
- Backend nuevo: prueba local con `.env` (tiene las creds Supabase+Replicate) antes
  de desplegar. Cada función de IA nueva: 1 test visual.
- Al terminar: MOCK=false, `npm run build && npx cap sync android`, y avisa al
  usuario para recompilar el APK.

## Orden recomendado
Fase 1 completa (entrega el look pro sin gastar) → Fase 2 → **pausa: pedir recarga
de crédito** → Fase 3 una función a la vez. Commitea al final de cada fase.

## No hacer (fuera de alcance de esta tanda)
- Buscador de muebles con links de compra / afiliados (proyecto futuro aparte).
- Pagos del tier premium (video) — otra tanda.
- Cola real de trabajos (Redis/RQ) — otra tanda.
