// Selección de foto: Capacitor Camera en móvil, <input file> en web.
import { t } from "./i18n";

export async function elegirFoto(): Promise<{ blob: Blob; url: string } | null> {
  // Intento nativo (móvil). Se comprueba la plataforma ANTES de cargar el
  // plugin: en navegador su implementación web abre un menú propio
  // (Foto/Cámara) que sobra, porque abajo ya está el <input type=file>.
  // Mismo criterio que device.ts.
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) throw new Error("web");
    const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
    // Etiquetas del menú nativo Android en el idioma activo de la app (por
    // defecto salían en inglés porque Camera.getPhoto no las recibía). Nota:
    // el resto del menú (fondo, tipografía) lo dibuja el sistema operativo y
    // sigue el tema del SO — no se puede tematizar por CSS desde aquí. Si se
    // quisiera control total del look, habría que reemplazarlo por una hoja
    // propia en HTML (fuera de alcance por ahora).
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
      quality: 85,
      promptLabelHeader: t("foto.nativo.header"),
      promptLabelPhoto: t("foto.nativo.galeria"),
      promptLabelPicture: t("foto.nativo.camara"),
      promptLabelCancel: t("foto.nativo.cancelar"),
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
