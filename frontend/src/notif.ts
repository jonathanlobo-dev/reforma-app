// Notificación local "tu transformación está lista" (solo nativo; en web no-op).
// El tap abre el resultado: main.ts registra el listener con el trabajo_id.
import { t } from "./i18n";

let permisoPedido = false;

export async function pedirPermisoNotif(): Promise<void> {
  if (permisoPedido) return;
  permisoPedido = true;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.requestPermissions();
  } catch { /* web */ }
}

export async function notificarListo(tid: string, tipo: "imagen" | "video"): Promise<void> {
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.schedule({
      notifications: [{
        id: Math.floor(Date.now() % 2147483647),
        title: t("notif.titulo"),
        body: t(tipo === "video" ? "notif.video_listo" : "notif.imagen_lista"),
        extra: { tid },
      }],
    });
  } catch { /* web: el toast ya avisó */ }
}

/** Listener global: tocar la notificación abre el resultado. */
export async function initNotifTap(abrir: (tid: string) => void): Promise<void> {
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.addListener("localNotificationActionPerformed", (ev) => {
      const tid = ev.notification?.extra?.tid;
      if (tid) abrir(tid);
    });
  } catch { /* web */ }
}
