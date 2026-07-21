// ─── Configuración del frontend ──────────────────────────────────────────────

// URL del backend en producción (Render + Supabase). Para dev local usar
// "http://localhost:8077" (o la IP LAN del PC si pruebas contra tu backend local).
export const API_BASE = "https://reforma-backend-cgu8.onrender.com";

// MOCK = false → usa el backend real (gasta crédito Replicate por generación).
// Ponlo en true para desarrollar la UI sin gastar (imágenes de ejemplo en /public/mock).
export const MOCK = false;

// AdMob — IDs REALES de RenuevAI.
// testing: en desarrollo (`npm run dev`) se piden anuncios de prueba, que son
// seguros; el build de producción pide anuncios reales.
// ⚠️ NUNCA hagas clic en tus propios anuncios reales: AdMob lo considera fraude
// de clics y suspende la cuenta (perdiendo lo acumulado).
export const ADMOB = {
  appId: "ca-app-pub-8302037284208937~1331963779",
  interstitialId: "ca-app-pub-8302037284208937/6618849398",
  testing: import.meta.env.DEV,
};
