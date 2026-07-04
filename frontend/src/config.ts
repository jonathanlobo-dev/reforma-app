// ─── Configuración del frontend ──────────────────────────────────────────────

// URL del backend en producción (Render + Supabase). Para dev local usar
// "http://localhost:8077" (o la IP LAN del PC si pruebas contra tu backend local).
export const API_BASE = "https://reforma-backend-cgu8.onrender.com";

// MOCK = false → usa el backend real (gasta crédito Replicate por generación).
// Ponlo en true para desarrollar la UI sin gastar (imágenes de ejemplo en /public/mock).
export const MOCK = false;

// AdMob — IDs de PRUEBA de Google (seguros para desarrollo).
// TODO: reemplazar por los IDs reales cuando haya cuenta de AdMob.
export const ADMOB = {
  appId: "ca-app-pub-3940256099942544~3347511713",
  interstitialId: "ca-app-pub-3940256099942544/1033173712",
  testing: true,
};
