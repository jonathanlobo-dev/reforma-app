// ─── Configuración del frontend ──────────────────────────────────────────────

// URL del backend. En web/dev: localhost. En el teléfono real, cambiar por la IP
// LAN del PC (ej. "http://192.168.1.50:8077") — localhost en el móvil NO es el PC.
export const API_BASE = "http://localhost:8077";

// MOCK = true → NO llama al backend real (no gasta crédito Replicate); simula el
// flujo con imágenes de ejemplo en /public/mock. Úsalo para desarrollar la UI.
// Ponlo en false solo para una prueba real de imagen al final.
export const MOCK = true;

// AdMob — IDs de PRUEBA de Google (seguros para desarrollo).
// TODO: reemplazar por los IDs reales cuando haya cuenta de AdMob.
export const ADMOB = {
  appId: "ca-app-pub-3940256099942544~3347511713",
  interstitialId: "ca-app-pub-3940256099942544/1033173712",
  testing: true,
};
