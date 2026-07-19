# Estrategia de monetización — RenuevAI (decidida 13-jul-2026)

Modelo elegido (el de los competidores DecAI/Interio/SnapHome): **suscripción
obligatoria con prueba gratis**. Se ACTIVA cuando Google Play Console apruebe
la cuenta y exista Google Play Billing (RevenueCat). Hasta entonces la app
sigue en modo actual (free tier con cuotas).

## Flujo al instalar (cuando se active)

1. Onboarding corto (3 pantallas de valor: antes/después reales).
2. **Paywall obligatorio**: no se puede usar la app sin iniciar la suscripción
   (con los 3 días de prueba gratis via Google Play Billing — Google gestiona
   la tarjeta, nosotros NUNCA la vemos).
3. **Durante la prueba (3 días)**:
   - CON anuncios (AdMob) — la prueba no quita ads.
   - Límite bajo: ~3 imágenes/día.
   - Videos: NO genera — solo muestra un video DEMO ya hecho (mock/final.mp4)
     para enseñar qué obtendrá pagando.
4. **Suscripción pagada** (tras el trial):
   - Sin anuncios.
   - Cuota alta de imágenes por CRÉDITOS mensuales (ej. 100 img/mes).
   - Videos por créditos (ej. 3/mes) — para proteger margen: un video Seedance
     cuesta $0.25-0.50. NUNCA "ilimitado".
   - Packs extra pay-as-you-go si se acaban los créditos.

## Implementación técnica (cuando se active)

- RevenueCat SDK (Capacitor) → entitlement "premium" + estado "trial"/"pagado".
- Backend: webhook de RevenueCat → db.activar_premium con plan="trial"|"pagado";
  columna nueva `plan` diferencia cuotas y ads.
- Ads: el cliente pregunta el estado; "trial" muestra ads, "pagado" no. La
  DECISIÓN de cuota sigue 100% server-side (SECURITY.md invariante 1).
- Créditos: tabla `creditos` (device_id, mes, img_usadas, videos_usados) o
  reusar `uso` con tope mensual en vez de diario.
- El gate del paywall va detrás de un flag remoto (env/endpoint /config) para
  poder activarlo sin recompilar APK.

## Números de referencia

- Costo por imagen (kontext/fill): $0.04-0.05 · video Seedance: $0.25-0.50.
- 100 img + 3 videos/mes ≈ $5.50 de costo → precio mensual sugerido $9.99
  (margen ~45%) o $6.99 agresivo. El anual placeholder de $29.99 queda
  DESCARTADO (margen negativo).
