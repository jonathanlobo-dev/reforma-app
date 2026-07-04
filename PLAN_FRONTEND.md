# PLAN DE EJECUCIÓN — Frontend de Reforma AI (para Sonnet)

Este documento es autocontenido. Ejecuta los pasos en orden. El **backend ya está
construido y probado** (`backend/`, FastAPI). Tu trabajo es SOLO el frontend
(Capacitor + AdMob) que consume esa API. No modifiques el backend salvo que un paso
lo pida explícitamente.

## 0. Contexto mínimo que necesitas

- App: el usuario sube una foto de SU espacio (cuarto/cocina/mueble/auto/pared),
  elige una categoría, y recibe una transformación (imagen antes/después o video).
- El backend hace todo el trabajo pesado (IA + video). El frontend solo: elegir
  categoría → llenar cuestionario → subir foto → mandar a la API → mostrar resultado.
- Stack elegido (igual al de Bolitas del usuario): **Vite + TypeScript + Capacitor + AdMob**.
- El usuario tiene ~$0.20 de crédito Replicate. **NO quemes crédito en pruebas de UI:**
  usa el modo mock (ver §7) para casi todo; haz como máximo 1 generación real de imagen.

## 1. Contrato de la API (embebido — no hace falta leer el backend)

Base URL en dev: `http://localhost:8077` (el backend corre con
`cd backend && python -m uvicorn main:app --reload --port 8077`).
En Android emulador/dispositivo, `localhost` NO apunta al PC → usar la IP LAN del PC
(ej. `http://192.168.x.x:8077`); dejarlo en una constante `API_BASE` configurable.

- `GET /health` → `{ "ok": true }`
- `GET /categorias` →
  ```json
  {
    "pintar":   { "titulo": "...", "emoji": "🎨", "tipo_default": "imagen",
                  "campos": [ { "clave": "superficie", "label": "¿Qué superficie?", "ejemplo": "la pared del fondo" }, ... ] },
    "muebles":  { ... "tipo_default": "imagen" ... },
    "restaurar":{ ... "tipo_default": "video" ... },
    "remodelar":{ ... "tipo_default": "video" ... }
  }
  ```
- `POST /trabajos` (multipart/form-data), campos:
  - `device_id` (string, UUID del dispositivo)
  - `categoria` (string, una clave de /categorias)
  - `detalle` (string, ver §4 cómo se arma desde el cuestionario)
  - `tipo` (`"imagen"` | `"video"`)
  - `foto` (archivo JPG/PNG/WEBP)
  - Respuesta 200: `{ "id": "...", "status": "pending", "tipo": "imagen" }`
  - Respuesta 429: `{ "detail": "Llegaste al límite de N imágenes por hoy." }` (mostrar el mensaje)
- `GET /trabajos/{id}` →
  ```json
  { "id": "...", "status": "pending|processing|done|error", "tipo": "...",
    "error": null,
    "resultados": { "antes": "/media/.../antes.jpg", "despues": "/media/.../despues.png",
                    "comparacion": "/media/.../comparacion.png", "video": "/media/.../final.mp4" } }
  ```
  Las URLs de `resultados` son **relativas al backend** → prefijarlas con `API_BASE`.
  `video` solo existe si `tipo=video`.

## 2. Estructura a crear

```
frontend/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  capacitor.config.ts
  src/
    main.ts
    api.ts          # llamadas a la API + tipos
    device.ts       # device_id persistente (UUID)
    state.ts        # estado simple de navegación entre pantallas
    screens/
      home.ts       # grid de categorías
      form.ts       # cuestionario + foto + tipo
      processing.ts # polling con loader
      result.ts     # antes/después + video + compartir + ad
    ui.ts           # helpers de DOM
    styles.css
```

## 3. Setup inicial (pasos de comandos)

1. `cd C:/Users/Jonathan Lobo/Documents/reforma-app && npm create vite@latest frontend -- --template vanilla-ts` (o crear los archivos a mano si el prompt interactivo estorba; el usuario está en Windows, evita comandos interactivos).
2. `cd frontend && npm install`
3. `npm install @capacitor/core @capacitor/cli @capacitor/camera @capacitor/preferences @capacitor-community/admob`
4. `npx cap init "Reforma AI" com.reforma.ai --web-dir dist`
5. Configurar `capacitor.config.ts` (appId `com.reforma.ai`, appName "Reforma AI").
6. Android se agrega al final: `npm run build && npx cap add android` (solo cuando la UI web funcione en el navegador).

## 4. Lógica clave (implementar tal cual)

- **device_id** (`device.ts`): al arrancar, leer de `@capacitor/preferences` (o
  `localStorage` como fallback en web) la clave `device_id`; si no existe, generar
  `crypto.randomUUID()` y guardarlo. Exportar `getDeviceId(): Promise<string>`.
- **detalle** (`form.ts`): el backend recibe UN string `detalle`. Arma ese string
  concatenando las respuestas del cuestionario de la categoría, formato:
  `"<label1>: <valor1>. <label2>: <valor2>."` — ej. `"¿Qué superficie?: la pared del fondo. Color y acabado: verde esmeralda mate."`
- **foto** (`form.ts`): usar `@capacitor/camera` `Camera.getPhoto({ source: CameraSource.Prompt })`
  para elegir cámara o galería. En web (dev), fallback a un `<input type="file" accept="image/*">`.
  Convertir a `File`/`Blob` para el `FormData`.
- **tipo**: por defecto `tipo_default` de la categoría. Mostrar un toggle
  "Imagen (gratis)" / "Video (premium)". Marcar video con un candado/etiqueta premium.
- **polling** (`processing.ts`): tras `POST /trabajos`, cada 3s hacer `GET /trabajos/{id}`
  hasta `done` o `error`. Mostrar loader con mensaje ("Generando tu transformación…";
  para video avisar "El video puede tardar 1-2 minutos"). Timeout de seguridad ~5 min.
- **AdMob** (`result.ts`): en tier gratis (imagen), mostrar un intersticial de AdMob
  al llegar al resultado (usar IDs de PRUEBA de AdMob mientras no haya cuenta real;
  dejar los IDs en constantes con comentario "// TODO: reemplazar por IDs reales").
  En web (dev) envolver AdMob en try/catch para que no rompa.
- **compartir**: botón que use `navigator.share` (web) / plugin share si se agrega,
  para compartir `comparacion.png` o el `final.mp4` (con marca de agua futura).

## 5. Pantallas (comportamiento)

1. **Home**: título + grid de tarjetas (emoji + titulo) desde `GET /categorias`.
   Tap en una → Form de esa categoría.
2. **Form**: inputs del cuestionario (campos con placeholder = ejemplo) + botón para
   elegir foto (muestra miniatura) + toggle imagen/video + botón "Transformar".
   Validar que haya foto y al menos un campo con texto antes de enviar.
3. **Processing**: loader + polling. Si `error`, mostrar el mensaje y botón "Reintentar".
4. **Result**: mostrar `comparacion.png` (o antes/después con un slider si te animas);
   si hay `video`, un `<video controls>` con `final.mp4`; botones Compartir y
   "Hacer otra". Mostrar ad (tier gratis).

## 6. Estilo

Mobile-first, limpio, español. Paleta simple (un color de acento). No frameworks de
UI pesados; CSS propio en `styles.css`. Prioriza que se entienda y funcione en un
teléfono; nada de escritorio.

## 7. Pruebas SIN quemar crédito

- Levanta el backend: `cd backend && python -m uvicorn main:app --port 8077`.
- Para probar la UI end-to-end sin gastar Replicate, agrega en `api.ts` un flag
  `const MOCK = true` que, cuando esté activo, NO llame al backend real sino que
  devuelva respuestas simuladas: un job que pasa a `done` tras ~4s y retorna URLs
  a imágenes locales de ejemplo (puedes usar las de `../shorts-pipeline/proyectos_espacio/`
  copiadas a `frontend/public/mock/`). Desarrolla TODA la UI con `MOCK=true`.
- Solo al final, con `MOCK=false`, haz **una** prueba real de tipo `imagen` (~$0.05)
  para confirmar el flujo real. NO pruebes `video` (el usuario casi no tiene crédito).
- Verifica en el navegador con las herramientas de preview antes de tocar Android.

## 8. Definición de "listo" (para esta tanda)

- [ ] La web (Vite) corre en el navegador y navega Home → Form → Processing → Result.
- [ ] Con `MOCK=true`, el flujo completo funciona visualmente.
- [ ] Con `MOCK=false`, una prueba real de imagen devuelve y muestra el resultado.
- [ ] device_id persiste entre recargas.
- [ ] El mensaje de límite (429) se muestra bien.
- [ ] AdMob envuelto en try/catch (no rompe en web).
- [ ] Android NO es obligatorio en esta tanda; dejarlo documentado como paso final
      (`npm run build && npx cap add android && npx cap open android`).

## 9. Notas / decisiones ya tomadas (no re-litigar)

- Sin login: identidad = device_id anónimo.
- El backend ya valida cuota y costos; el frontend NO necesita lógica de límites,
  solo mostrar el mensaje 429 si llega.
- El motor de IA está validado; no lo toques. Categorías vienen de `GET /categorias`.
- No implementes pagos aún (el toggle de video solo marca "premium"; el cobro real
  es una tanda futura).
```
