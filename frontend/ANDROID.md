# Compilar la app en Android Studio y probar en tu teléfono

El proyecto Android ya está generado en `frontend/android/`. Android Studio trae
su propio JDK y gestiona el SDK, así que no necesitas instalar Java aparte.

## Primera prueba (modo MOCK, SIN backend ni crédito)

La app viene con `MOCK = true` → funciona sola con imágenes de ejemplo bundleadas.
Ideal para ver toda la UI en tu teléfono sin gastar nada.

1. Abre **Android Studio** → *Open* → selecciona la carpeta
   `C:/Users/Jonathan Lobo/Documents/reforma-app/frontend/android`.
2. Espera a que **Gradle sync** termine (la primera vez descarga dependencias).
3. Conecta tu teléfono por USB con **depuración USB** activada
   (Ajustes → Opciones de desarrollador → Depuración por USB).
4. Elige tu dispositivo en la barra superior y pulsa **Run ▶**.
5. La app abre en la pantalla de categorías. Elige una, toca "Elegir foto"
   (cámara o galería), escribe el cambio, y pulsa "Transformar". Verás el
   resultado de ejemplo (cocina) — es el mock, aún no usa tu foto real.

## Segunda prueba (REAL, con tu backend y tu foto)

Cuando quieras que procese de verdad TU foto:

1. Recarga ~$5 de crédito en replicate.com/account/billing.
2. Levanta el backend en tu PC:
   ```
   cd C:/Users/Jonathan Lobo/Documents/reforma-app/backend
   python -m uvicorn main:app --host 0.0.0.0 --port 8077
   ```
   (`--host 0.0.0.0` para que el teléfono lo alcance por la red.)
3. Averigua la IP LAN de tu PC: en PowerShell `ipconfig` → "Dirección IPv4"
   (algo como `192.168.1.50`). El teléfono y el PC deben estar en el mismo WiFi.
4. Edita `frontend/src/config.ts`:
   ```ts
   export const API_BASE = "http://192.168.1.50:8077";  // ← tu IP
   export const MOCK = false;
   ```
5. Recompila y sincroniza:
   ```
   cd C:/Users/Jonathan Lobo/Documents/reforma-app/frontend
   npm run build
   npx cap sync android
   ```
6. En Android Studio pulsa **Run ▶** otra vez. Ahora sube una foto real y la
   transformará de verdad (imagen ~$0.05; video, si lo activas, ~$0.20).

## Notas

- **AdMob** usa IDs de PRUEBA de Google (ya configurados en el manifiesto). Los ads
  de prueba salen con la etiqueta "Test Ad". Cuando tengas cuenta real de AdMob,
  reemplaza el App ID en `android/app/src/main/AndroidManifest.xml` y los IDs en
  `src/config.ts`.
- Si la app crashea al abrir: casi siempre es el App ID de AdMob faltante en el
  manifiesto (ya está puesto) o Gradle sin sincronizar.
- Para generar un APK instalable: Android Studio → Build → Build APK(s).
