// AdMob envuelto para que NUNCA rompa en web (donde el plugin nativo no existe).
import { ADMOB } from "./config";
import { state } from "./state";

// Tope de frecuencia: máximo un intersticial cada 45 s. Evita spamear al
// usuario (mala experiencia) y que AdMob banee la cuenta por exceso.
const MIN_MS = 45_000;
let ultimoAd = 0;

export async function mostrarIntersticial(): Promise<void> {
  if (!state.config.ads) return;                   // ads apagados (fase test)
  if (state.premium) return;                       // premium no ve anuncios
  if (Date.now() - ultimoAd < MIN_MS) return;      // tope de frecuencia
  ultimoAd = Date.now();
  try {
    const { AdMob } = await import("@capacitor-community/admob");
    await AdMob.prepareInterstitial({
      adId: ADMOB.interstitialId,
      isTesting: ADMOB.testing,
    });
    await AdMob.showInterstitial();
  } catch (e) {
    // En web o si falla el plugin: no hacemos nada (no bloquea el resultado).
    console.debug("AdMob no disponible (ok en web):", e);
  }
}

export async function initAds(): Promise<void> {
  try {
    const { AdMob } = await import("@capacitor-community/admob");
    await AdMob.initialize({ initializeForTesting: ADMOB.testing });
  } catch (e) {
    console.debug("AdMob init omitido (ok en web):", e);
  }
}
