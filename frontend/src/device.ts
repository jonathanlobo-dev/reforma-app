// device_id persistente y anónimo (sin login).
//
// Antes era un UUID aleatorio guardado en Preferences. Problema: Android borra
// los datos de la app al DESINSTALAR, así que cada reinstalación generaba un ID
// nuevo — el usuario perdía su historial y su premium, y la cuota se reiniciaba
// (o había que volver a darse admin a mano).
//
// Ahora se usa el identificador del dispositivo (en Android, ANDROID_ID), que
// sobrevive a las reinstalaciones mientras la app esté firmada con la misma
// clave. El UUID queda solo como respaldo (web, o si el plugin falla).
import { Preferences } from "@capacitor/preferences";

const KEY = "device_id";

/** ID estable del dispositivo, o "" si no está disponible (web/navegador). */
async function idNativo(): Promise<string> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return "";
    const { Device } = await import("@capacitor/device");
    const { identifier } = await Device.getId();
    // Prefijo para distinguirlo de un vistazo de los UUID antiguos.
    return identifier ? `and-${identifier}` : "";
  } catch {
    return "";
  }
}

export async function getDeviceId(): Promise<string> {
  const nativo = await idNativo();
  if (nativo) {
    // Se guarda igualmente: si algún día el plugin fallara, se sigue usando el
    // mismo ID en vez de inventar uno nuevo.
    try { await Preferences.set({ key: KEY, value: nativo }); } catch { /* sin efecto */ }
    return nativo;
  }
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (value) return value;
    const id = crypto.randomUUID();
    await Preferences.set({ key: KEY, value: id });
    return id;
  } catch {
    // Fallback web puro
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  }
}
