// AdMob envuelto para que NUNCA rompa en web (donde el plugin nativo no existe).
import { ADMOB } from "./config";

export async function mostrarIntersticial(): Promise<void> {
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
