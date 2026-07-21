# Guía de lanzamiento — RenuevAI

Todo lo que hay que hacer para publicar en Google Play, en orden.
Lo que ya está resuelto en el código está marcado ✅; lo que depende de ti, ⬜.

---

## 0. Cómo funcionan los modos (ya implementado ✅)

La app pregunta a `GET /config` al arrancar y se comporta según lo que responda
el backend. **Cambiar de fase NO requiere recompilar el APK**: se cambia una
variable en Render y todos los usuarios lo notan al reabrir la app.

| Variable Render | Fase pruebas | Producción |
|---|---|---|
| `APP_MODE` | `test` | `prod` |
| Paywall | Se ve, se cierra con la X | Bloquea: sin suscripción no se genera |
| Imágenes gratis/día | 3 | 0 (requiere suscripción) |
| Video gratis/día | 1 | 0 |
| Anuncios | Sí | Sí (durante la prueba de 3 días) |

Palancas individuales (opcionales, sobrescriben el modo):
`PAYWALL_DURO`, `VIDEO_ON`, `ADS_ON` (valores `1`/`0`),
`IMAGENES_GRATIS_DIA`, `VIDEOS_GRATIS_DIA`, `IMAGENES_TRIAL_DIA`.

**Importante**: los bloqueos se aplican en el SERVIDOR, no solo en la interfaz.
Un APK modificado no puede saltárselos.

### Para cortar el gasto de golpe
Si en pruebas se disparan los costos: en Render pon `VIDEO_ON=0` y
`IMAGENES_GRATIS_DIA=1`. Efecto inmediato, sin tocar el APK.

---

## 1. Usuarios "power user" (ya funciona ✅ — no hace falta código)

Para dar más cuota a alguien de confianza **sin hacerlo admin**, usa el panel de
administración (`dashboard/renuevai-admin.html`) y dale **Premium por N días**.

- Premium ≠ admin. Premium tiene cuota alta (`IMAGENES_PREMIUM_DIA`,
  `VIDEOS_PREMIUM_DIA`) pero sigue teniendo topes: no te puede vaciar la cuenta.
- Admin (`ADMIN_DEVICES` en Render) es solo para ti: sin límite ninguno.
- Es temporal: se lo das por 7, 30 o los días que quieras, y caduca solo.

Necesitas el **ID de dispositivo** de esa persona: lo ve en la app en
**Ajustes → Mi cuenta**. Que te lo pase y lo metes en el panel.

---

## 2. Política de privacidad ✅ / ⬜ publicar

El texto ya está listo y actualizado (contacto: CodaliaLabs@gmail.com).
El backend la sirve en:

    https://reforma-backend-cgu8.onrender.com/privacidad

⬜ **Recomendado**: publicarla también en GitHub Pages, como Bolos VE. Motivo:
Render (plan gratis) apaga el servidor tras un rato de inactividad y tarda ~50 s
en despertar. Si el revisor de Google entra justo entonces, ve un error y puede
rechazar la ficha. GitHub Pages nunca duerme.

---

## 3. Keystore (firma de la app) ⬜

Es el archivo que demuestra que las actualizaciones vienen de ti.
**Si lo pierdes, no puedes volver a actualizar la app en Play jamás.**

Créalo UNA sola vez, en una carpeta FUERA del repositorio:

```bash
cd "C:/Users/Jonathan Lobo/Documents"
keytool -genkey -v -keystore renuevai-release.keystore -alias renuevai \
        -keyalg RSA -keysize 2048 -validity 10000
```

Si `keytool` no aparece, está en:
`C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe`

Te pedirá una contraseña y algunos datos (nombre, ciudad…). Anota:
- contraseña del keystore
- contraseña del alias
- alias: `renuevai`

**Guárdalo en tu gestor de contraseñas y con una copia en la nube.**
NUNCA lo subas a GitHub.

> Consejo: activa **Play App Signing** en Play Console (viene activado por
> defecto). Google guarda una copia de la clave de firma final, así que si
> pierdes tu keystore de subida, se puede recuperar el acceso. Sin eso, perderlo
> es definitivo.

Puedes usar el mismo keystore para varias apps, pero es más limpio uno por app.

---

## 4. AdMob ⬜ (ahora mismo están los IDs de PRUEBA)

Estado actual: `frontend/src/config.ts` y el `AndroidManifest.xml` tienen los IDs
de prueba de Google (`ca-app-pub-3940256099942544...`). Con esos, los anuncios
son falsos y no generan ingresos.

### Pasos
1. Entra a https://admob.google.com con la cuenta de Codalia.
2. **Apps → Agregar app → Android → "¿Está publicada?" → No** (todavía).
   Nombre: RenuevAI.
3. Copia el **App ID**: tiene forma `ca-app-pub-XXXXXXXX~YYYYYYYY` (con `~`).
4. **Bloques de anuncios → Crear bloque → Intersticial**. Nombre: "Intersticial
   principal". Copia el **Ad Unit ID**: `ca-app-pub-XXXXXXXX/ZZZZZZZZ` (con `/`).
5. Pásame los dos y yo los pongo en el código (van en dos sitios distintos y hay
   que poner `testing: false`).

⚠️ **Nunca hagas clic en tus propios anuncios reales.** AdMob lo detecta como
fraude y suspende la cuenta. Es la causa nº 1 de baneo en desarrolladores nuevos.

> Nota: una vez publicada la app, vuelve a AdMob y vincúlala con la ficha real de
> Play (**App → Vincular a la tienda**). Sin eso, AdMob limita los anuncios.

---

## 5. RevenueCat (cobros) ⬜ — lo más largo

### ¿Qué es y por qué usarlo?
Google Play Billing es la API de pagos de Android: es la que cobra de verdad.
Es funcional pero engorrosa: hay que validar los recibos en un servidor, detectar
renovaciones, cancelaciones, reembolsos, periodos de gracia… y si te equivocas,
o regalas Premium o cobras a quien canceló.

**RevenueCat es una capa por encima** que hace todo eso. Tú preguntas
"¿este usuario es premium?" y responde sí/no. Gratis hasta $2 500/mes de
ingresos, así que para empezar no cuesta nada.

Y lo mejor para tus planes: **el mismo código sirve para iOS**. Si algún día
haces la versión de iPhone, esta parte ya está hecha.

### Orden de los pasos (importante: hay dependencias)

**Paso 1 — Play Console: crear la app y las suscripciones**
1. Crear la ficha de RenuevAI (puede quedar en borrador).
2. **Monetizar → Suscripciones → Crear suscripción.** Crea una por plan:

   | Plan | ID de producto sugerido | Precio |
   |---|---|---|
   | Semanal | `renuevai_semanal` | USD 4,99 |
   | Anual | `renuevai_anual` | USD 29,99 |

   En cada una, dentro del plan base, **añade una oferta de prueba gratuita de
   3 días**. Ahí es donde se configura el trial — no se programa en la app.

   > El plan "de por vida" ($49,99) no es una suscripción sino un pago único:
   > se crea en **Productos dentro de la app**, no en Suscripciones.

3. Para que las suscripciones se puedan activar, Play exige que hayas subido al
   menos un AAB a alguna vía (aunque sea pruebas internas). Por eso conviene
   subir primero, configurar cobros después.

**Paso 2 — RevenueCat**
1. Cuenta en https://revenuecat.com → nuevo proyecto "RenuevAI".
2. Añadir app Android con el package `com.renovai.app`.
3. Conectar con Google: hay que crear una **cuenta de servicio** en Google Cloud
   y darle permisos en Play Console. RevenueCat lo explica paso a paso; es la
   parte más tediosa (~20 min).
4. Crear un **entitlement** llamado `premium`.
5. Crear los **productos** con los mismos IDs de Play y asociarlos al entitlement.

**Paso 3 — Código (esto lo hago yo)**
- Instalar `@revenuecat/purchases-capacitor`.
- Conectar el botón del paywall (hoy solo muestra "los pagos se activan pronto").
- Endpoint `/revenuecat/webhook` en el backend: cuando alguien compra, renueva o
  cancela, RevenueCat avisa y el backend actualiza `db.activar_premium`.
  **El webhook es la fuente de verdad, no el cliente** — si la app dijera "soy
  premium" y le creyéramos, cualquiera se haría premium gratis.
- Diferenciar `trial` de `pagado` para aplicar 2 imágenes/día en la prueba y
  quitar los anuncios solo a quien paga.

Necesito de ti: la **API key pública** de RevenueCat y los IDs de producto que
crees en Play.

---

## 6. Qué falta aparte de eso

⬜ **Material gráfico para la ficha** (se sube en Play Console, no va en el código):
   - Ícono 512×512 (ya lo tenemos, solo exportarlo a ese tamaño)
   - Gráfico destacado 1024×500
   - Mínimo 2 capturas de pantalla reales — para esta app, un **antes/después**
     vende muchísimo mejor que capturas de la interfaz.

⬜ **Cuestionarios de Play Console**:
   - Clasificación de contenido
   - **Anuncios: sí, contiene anuncios**
   - **Seguridad de datos**: declara que subes **fotos** de usuarios (procesadas
     por terceros y borrables), identificador de dispositivo y datos de uso.
     Aquí no conviene omitir nada: Google contrasta lo declarado con lo que hace
     el APK, y las apps que suben fotos reciben más escrutinio.

⬜ **Elegir la vía de publicación**: para los testers venezolanos usa
   **Pruebas cerradas** (Closed Testing): entra solo la gente que invites por
   correo. Esto acota el gasto de Replicate a tu círculo.

   > Ojo: Google ahora exige a las **cuentas de desarrollador personales nuevas**
   > hacer una prueba cerrada con **12 testers durante 14 días seguidos** antes
   > de poder publicar en producción. Comprueba si te aplica: si sí, cuanto antes
   > empieces la prueba cerrada, antes podrás lanzar.

⬜ **Subir `versionCode`** en cada actualización (`android/app/build.gradle`).
   Ahora está en `versionCode 1` / `versionName "1.0"`, correcto para el primer envío.

---

## 7. Orden recomendado

1. Crear el keystore (5 min).
2. Crear la ficha de RenuevAI en Play Console.
3. Crear la app en AdMob y pasarme los IDs → pongo los reales.
4. Publicar la política de privacidad en GitHub Pages.
5. Generar el AAB firmado y subirlo a **Pruebas cerradas**.
6. Invitar a tus testers. **Fase de pruebas en marcha** (`APP_MODE=test`).
7. Mientras tanto: RevenueCat + integración de cobros.
8. Cuando esté todo: `APP_MODE=prod` en Render y pasar a Producción.
