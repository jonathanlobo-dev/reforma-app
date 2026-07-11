# PLAN i18n — Selector de idiomas para RenuevAI (para Sonnet)

Documento autocontenido. Ejecuta por FASES en orden y commitea al final de cada
una. La app funciona (backend Render+Supabase, frontend Vite+TS+Capacitor).
Hoy TODO está en español. Meta: **Español + Inglés completos** (Fase 1-2) y
**Portugués + Italiano** como traducción mecánica del catálogo (Fase 3).

**Costo de crédito: $0.** Nada de esto toca Replicate. No generes imágenes.

Rutas: `frontend/src/` y `backend/`. La app se llama **RenuevAI** (no cambiar).

---

## Reglas de trabajo (obligatorias)

1. **MOCK:** pon `MOCK = true` en `frontend/src/config.ts` mientras desarrollas;
   al terminar CADA fase vuelve a `false`, `npm run build && npx cap sync android`.
2. **Verifica en preview** (viewport móvil 375px) cada pantalla en ES y EN antes
   de commitear. `npx tsc --noEmit` debe quedar limpio.
3. **Gotcha del helper `el()`** (`src/ui.ts`): props con guion van por
   setAttribute; propiedades read-only caen a setAttribute con try/catch. No lo
   toques.
4. **No dejes NI UN string visible hardcodeado.** Si al hacer sweep encuentras
   un texto que no está en este plan, agrégalo al catálogo igual.
5. Las **claves internas** (categorias "pintar", "interior"…, engines, ids de
   estado) NO se traducen — solo lo visible.
6. La **marca de agua "RenuevAI"** y el nombre de la app no se traducen.
7. No toques: fotos de `public/` (privacidad ya resuelta), lógica de premium,
   cadena de ediciones, ads, ni el flujo de pagos.

---

## FASE 1 — Infraestructura + frontend completo en ES/EN

### 1.1 Módulo `src/i18n.ts` (nuevo)
```ts
export type Idioma = "es" | "en" | "pt" | "it";
export const IDIOMAS: { codigo: Idioma; nombre: string }[] = [
  { codigo: "es", nombre: "Español" },
  { codigo: "en", nombre: "English" },
  { codigo: "pt", nombre: "Português" },
  { codigo: "it", nombre: "Italiano" },
];

let actual: Idioma = "es";
export function idioma(): Idioma { return actual; }

// t("clave") busca en el catálogo del idioma actual con fallback a "es".
export function t(clave: string): string { ... }

// Inicializa: Preferences("idioma") → si no existe, navigator.language
// (es-* → es, en-* → en, pt-* → pt, it-* → it, otro → es). Persiste la elección.
export async function initIdioma(): Promise<void> { ... }
export async function setIdioma(l: Idioma): Promise<void> { ... } // persiste + recarga UI
```
- Catálogos en `src/i18n/es.ts` y `src/i18n/en.ts` (objetos planos
  `Record<string, string>`; claves con puntos: `"home.titulo"`,
  `"result.guardar"`, `"paywall.cta"`, etc.). En Fase 1 crea también `pt.ts` e
  `it.ts` VACÍOS re-exportando es (placeholder para Fase 3).
- `setIdioma`: guarda en Preferences y vuelve a renderizar con
  `raiz(pantallaHome)` (import dinámico para evitar ciclos) + re-etiqueta el nav
  (ver 1.3).
- `main.ts`: `await initIdioma()` ANTES del primer render.

### 1.2 Selector en Ajustes
En `screens/ajustes.ts`, nueva sección **"Idioma / Language"** (primera de la
lista): 4 opciones tipo radio-list (reusa clases `.radio-item`/`.radio-dot` de
styles.css), la activa marcada. Tocar una → `setIdioma(...)` → toast "Idioma
cambiado" en el idioma NUEVO → vuelve a Home re-renderizada.

### 1.3 Nav inferior (index.html es estático)
Los labels "Inicio / Inspiración / El Maestro / Recientes" viven en
`index.html`. NO los muevas de ahí (es el shell); en su lugar crea
`aplicarIdiomaNav()` en i18n.ts que reescribe los `.nav-label` por
`data-tab`, y llámala en `initIdioma` y en `setIdioma`.

### 1.4 Sweep completo del frontend (mueve TODO al catálogo)
Archivos y textos a migrar a `t()` — lista de barrido, verifica cada uno:

- **main.ts**: splash tagline ("Transforma tu espacio"), "No se pudo conectar
  con el servidor.", "Reintentar".
- **screens/home.ts**: "Inicio", `SUBTITULOS` (12 subtítulos de modos),
  secciones `SECCIONES` (Todos/Interior/Exterior/Herramientas), "Probar ›".
  OJO: los TÍTULOS de las cards vienen del backend (`cat.titulo`) — en Fase 1
  déjalos; en Fase 2 el backend los manda traducidos.
- **screens/form.ts**: HINTS (3), placeholders de foto ("Toca para elegir…",
  "Toca para subir tu plano", "Cambiar foto", "Foto de inspiración…"),
  "O prueba con una muestra", "Consejos para tu foto", label "Proyecto" y su
  placeholder, listas de opciones (HABITACIONES, INTENSIDADES,
  MATERIALES_SUELO, ACABADOS_PARED), "Imagen · gratis", "Video · Premium",
  "Transformar", toasts ("Elige una foto…", "Pinta la zona…", "Falta la foto de
  inspiración.", "Completa al menos un campo.", "Sube la foto de tu plano.",
  "No se pudo cargar la muestra."), botón pincel ("Pintar la zona a cambiar" /
  "Editar zona pintada"). OJO: el `detalle` que se manda al backend se compone
  con los VALORES elegidos — mándalos en el idioma del usuario tal cual (Groq
  entiende; en Fase 2 se le avisa el idioma).
- **ui/controls.ts**: nombres de ESTILOS (8), nombres de COLORES (16), 
  SUPERFICIES (5), título "Estilo"/"Color"/"Superficie", "Elige un color".
- **screens/mask.ts**: título "Pinta la zona a cambiar", hint, "Pincel",
  "Borrador", "Deshacer", "Tamaño del pincel", "Continuar", toasts.
- **screens/processing.ts**: PASOS_IMAGEN (5), PASOS_VIDEO (6),
  PASOS_PROCESO (4), subtítulos ("Puede tardar 1–2 minutos…", "Unos
  segundos…", "Enviando tu foto…"), errores de timeout, "Reintentar",
  "Tu transformación está lista ✨ — mírala en Recientes.".
- **screens/result.ts**: "Tu transformación", tags "Antes"/"Después",
  "¿Qué te pareció?", toasts de voto, "Guardar en el teléfono", "Seguir
  editando este resultado", "Otra versión" (+ confirm), "Video del proceso
  (N pasos)" (usa plantilla con {n}), "Compartir", "Preguntar al Maestro",
  "Hacer otra", texto de compartir ("Mira cómo transformé mi espacio con
  RenuevAI"), toasts de guardar/compartir, confirm de otra versión.
- **screens/recientes.ts**: "Recientes", "Tus transformaciones anteriores",
  "Todos", vacíos ("Aún no has generado…", "Este proyecto no tiene…"),
  formatFecha ("Ahora mismo", "Hace X min/h/día(s)"), confirm de borrar,
  toasts, "Reporte PDF de …", "Cargando recientes…".
- **screens/asesor.ts**: SALUDO, SUGERENCIAS (3), placeholder "Pregúntale al
  Maestro…", "El Maestro está escribiendo…", subtítulo "Obra · Decoración ·
  Materiales", "Ver esto en mi espacio", confirm del puente, "Sobre tu
  transformación:". El NOMBRE "El Maestro" se traduce a "The Foreman" (en) /
  "O Mestre" (pt) / "Il Maestro" (it).
- **screens/paywall.ts**: PLANES (etiquetas/títulos/subs — los PRECIOS no se
  tocan), BENEFICIOS (5), "RenuevAI Premium", "Transforma tu espacio sin
  límites", "Continuar", letra chica, "Términos de uso", "Política de
  privacidad", toast de pagos próximamente.
- **screens/ajustes.ts**: TODAS las secciones y su contenido (cómo usar,
  límites, descargo, mi cuenta, acerca de), "Copiar", "ID copiado".
- **screens/inspiracion.ts**: "Inspiración", subtítulo, AMBIENTES (7), títulos
  del CATALOGO (24) — usa claves (`inspo.moderno` etc.), "Usar este estilo en
  mi espacio", texto del sheet, toasts.
- **ui/consejos.ts**: título, texto, "Evita esto"/"Así sí", etiquetas de los 4
  ejemplos, "Entendido".
- **ui/reporte.ts**: "Proyecto:", "N transformación(es)", "ANTES"/"DESPUÉS",
  pie de página, fecha con locale del idioma (`toLocaleDateString(idioma())`).
- **notif.ts**: título y cuerpos de la notificación.

### 1.5 Verificación Fase 1
En preview: cambia a EN en Ajustes → recorre Home, un form, chat, Recientes,
paywall, Ajustes → todo en inglés (los títulos de cards aún en ES, ok hasta
F2). Vuelve a ES → todo vuelve. Reinicia (reload) → el idioma persiste.
Commit: `feat(i18n): infraestructura + catálogo ES/EN frontend`.

---

## FASE 2 — Backend consciente del idioma

### 2.1 `GET /categorias?lang=es|en|pt|it`
En `backend/categorias.py` agrega por categoría `titulo_i18n` y en cada campo
`label_i18n`/`ejemplo_i18n` (dicts por idioma; ES ya existe como base, escribe
EN ahora, PT/IT en F3 con fallback a ES si falta). `main.py` resuelve según
`lang` (default "es") y responde `titulo`, `campos` ya traducidos (el contrato
del frontend NO cambia). Frontend: `getCategorias()` añade `?lang=${idioma()}`.

### 2.2 `POST /trabajos` y errores por idioma
- Nuevo Form opcional `lang` (default "es"); guárdalo en columna nueva
  `trabajos.lang` (agrega a `_MIGRACIONES` en db.py, tipo TEXT).
- `worker._error_usuario(e)` → `_error_usuario(e, lang)`: convierte el mapa
  actual en dict de dicts `{clave: {es, en, pt, it}}` (traduce EN ahora; PT/IT
  en F3, fallback ES). `procesar` lee `trabajo["lang"]`.
- Mensajes de CUOTA en `db.puede_generar` (hoy devuelven español): muévelos a
  claves — que `puede_generar` devuelva `(False, clave, params)` y `main.py`
  los traduzca con el mismo diccionario según `lang` del request. Igual el
  mensaje de tope por IP y el de `puede_chatear`.
- El prompt del plan (`_SYSTEM_PLAN` en pipeline.py) ya pide edit_prompt EN
  INGLÉS — añade una línea: "La PETICIÓN puede venir en cualquier idioma".
  `PeticionRechazada` (el motivo del filtro): añade al system que el "motivo"
  se escriba en el idioma de la petición.

### 2.3 El Maestro multi-idioma
`POST /asesor` acepta `lang` (el frontend lo manda). En `ASESOR_SYSTEM`
reemplaza "Responde SIEMPRE en español…" por instrucción parametrizada: el
main inyecta una línea final `"Responde SIEMPRE en {nombre del idioma}."`
manteniendo la personalidad. Verifica con una llamada real a Groq en EN
(pregunta de pintura) — la respuesta debe salir en inglés y en texto plano.

### 2.4 Verificación Fase 2
- TestClient: `/categorias?lang=en` → títulos en inglés; `?lang=es` → español.
- Simular error 402 → `trabajos.error` en el idioma del trabajo.
- Asesor real en EN (1 llamada Groq, gratis).
Commit: `feat(i18n): backend por idioma (categorias, errores, cuotas, Maestro)`.

---

## FASE 3 — Portugués e Italiano (mecánica)

1. Traduce los catálogos `pt.ts` e `it.ts` completos (desde es.ts como fuente;
   portugués brasileño neutro; italiano estándar). Cuida plantillas {n}.
2. Completa `titulo_i18n/label_i18n/ejemplo_i18n` PT/IT en categorias.py y los
   dicts de errores/cuotas del backend.
3. Verifica en preview PT e IT: Home, un form, paywall, Ajustes (sin recorrer
   todo — spot check de 4 pantallas por idioma).
Commit: `feat(i18n): catálogos PT e IT`.

---

## Al terminar
- `MOCK = false`, `npm run build && npx cap sync android`, push.
- Avisa al usuario: recompilar APK en Android Studio; el backend se
  redespliega solo en Render.
- NO toques versionCode/versionName.

## Fuera de alcance (no hacer)
- Traducir la política de privacidad (queda en español por ahora).
- RTL, plurales complejos, librerías i18n externas (el dict plano basta).
- Cambiar el idioma de la marca de agua o del nombre de la app.
