// device_id persistente y anónimo (sin login). Preferences en móvil, localStorage en web.
import { Preferences } from "@capacitor/preferences";

const KEY = "device_id";

export async function getDeviceId(): Promise<string> {
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
