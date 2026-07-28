// Selección de foto: Capacitor Camera en móvil, <input file> en web.
export async function elegirFoto(): Promise<{ blob: Blob; url: string } | null> {
  // Intento nativo (móvil). Se comprueba la plataforma ANTES de cargar el
  // plugin: en navegador su implementación web abre un menú propio
  // (Foto/Cámara) que sobra, porque abajo ya está el <input type=file>.
  // Mismo criterio que device.ts.
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) throw new Error("web");
    const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
      quality: 85,
    });
    if (photo.webPath) {
      const blob = await (await fetch(photo.webPath)).blob();
      return { blob, url: photo.webPath };
    }
  } catch (e) {
    // Cae al fallback web
    console.debug("Camera nativa no disponible, usando input file:", e);
  }

  // Fallback web
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve({ blob: file, url: URL.createObjectURL(file) });
    };
    // Sin esto, cancelar el diálogo dejaba la promesa colgada para siempre.
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}
