import { el, render, toast } from "../ui";
import { crearTrabajo, getTrabajo } from "../api";
import { getDeviceId } from "../device";
import { reemplazar } from "../nav";
import { pantallaResult } from "./result";
import { pantallaForm } from "./form";
import { state } from "../state";
import { pedirPermisoNotif, notificarListo } from "../notif";
import { t } from "../i18n";

interface Args {
  categoria: string; detalle: string; tipo: "imagen" | "video"; foto: Blob;
  mask?: Blob; referencia?: Blob; proyecto?: string;
}

// Mensajes rotativos: la espera percibida baja cuando el texto avanza.
function pasosImagen(): string[] {
  return [1, 2, 3, 4, 5].map((n) => t(`processing.imagen.${n}`));
}
function pasosVideo(): string[] {
  return [1, 2, 3, 4, 5, 6].map((n) => t(`processing.video.${n}`));
}
function pasosProceso(): string[] {
  return [1, 2, 3, 4].map((n) => t(`processing.proceso.${n}`));
}

// Token de la generación en curso: si el usuario navega a otra pantalla (o
// lanza otra generación), el polling viejo deja de tener derecho a navegar.
let generacionActual = 0;

/** Espera un trabajo ya creado en el backend y muestra el resultado. */
export function pantallaEsperarTrabajo(
  id: string,
  tipo: "imagen" | "video",
  pasos: string[] = tipo === "video" ? pasosVideo() : pasosImagen(),
) {
  const miGeneracion = ++generacionActual;
  const sigoActivo = () => generacionActual === miGeneracion && !!document.querySelector(".proc-screen");

  let paso = 0;
  const msg = el("p", { class: "loader-msg" }, [pasos[0]]);
  const sub = el("p", { class: "loader-sub" }, [
    t(tipo === "video" ? "processing.sub.video" : "processing.sub.imagen"),
  ]);

  render(
    el("div", { class: "screen centro proc-screen" }, [
      el("div", { class: "spinner" }),
      msg, sub,
    ])
  );

  const timerMsgs = setInterval(() => {
    if (generacionActual !== miGeneracion) { clearInterval(timerMsgs); return; }
    if (paso < pasos.length - 1) {
      paso++;
      msg.textContent = pasos[paso];
    }
  }, 6000);
  const terminar = () => clearInterval(timerMsgs);

  const mostrarError = (texto: string) => {
    terminar();
    if (!sigoActivo()) { toast(texto); return; }
    render(
      el("div", { class: "screen centro proc-screen" }, [
        el("p", { class: "error-msg" }, [texto]),
        el("button", {
          class: "btn-primario",
          onClick: () => reemplazar(() => pantallaForm(state.categoriaSel || "interior")),
        }, [t("common.reintentar")]),
      ])
    );
  };

  const inicio = Date.now();
  // Fallos de red transitorios (backend reiniciando, wifi parpadeando) NO
  // matan la espera: el trabajo sigue corriendo en el servidor. Solo se rinde
  // tras varios fallos consecutivos.
  let fallosSeguidos = 0;
  const timer = setInterval(async () => {
    if (generacionActual !== miGeneracion) { clearInterval(timer); terminar(); return; }
    if (Date.now() - inicio > 5 * 60 * 1000) {
      clearInterval(timer);
      mostrarError(t("processing.timeout"));
      return;
    }
    try {
      const t2 = await getTrabajo(id);
      fallosSeguidos = 0;
      if (t2.status === "done") {
        clearInterval(timer);
        terminar();
        // La cadena de ediciones (para el video del proceso) crece con cada
        // imagen generada de la misma foto.
        if (t2.tipo === "imagen") state.cadena.push(t2.id);
        if (document.hidden) notificarListo(id, t2.tipo); // app en background
        if (sigoActivo()) {
          reemplazar(() => pantallaResult(t2));
        } else {
          notificarListo(id, t2.tipo);
          toast(t("processing.listo_fondo"));
        }
      } else if (t2.status === "error") {
        clearInterval(timer);
        mostrarError(t2.error || t("processing.error_generico"));
      }
    } catch (e) {
      fallosSeguidos++;
      if (fallosSeguidos >= 10) { // ~30s sin poder consultar: recién ahí se rinde
        clearInterval(timer);
        mostrarError((e as Error).message);
      }
    }
  }, 3000);
}

export { pasosProceso };

export async function pantallaProcessing(args: Args) {
  // Pantalla de espera inmediata (mientras sube la foto)
  render(
    el("div", { class: "screen centro proc-screen" }, [
      el("div", { class: "spinner" }),
      el("p", { class: "loader-msg" }, [t("processing.enviando")]),
    ])
  );
  pedirPermisoNotif();

  try {
    const deviceId = await getDeviceId();
    const { id } = await crearTrabajo({ deviceId, ...args });
    pantallaEsperarTrabajo(id, args.tipo);
  } catch (e) {
    render(
      el("div", { class: "screen centro proc-screen" }, [
        el("p", { class: "error-msg" }, [(e as Error).message]),
        el("button", {
          class: "btn-primario",
          onClick: () => reemplazar(() => pantallaForm(state.categoriaSel || "interior")),
        }, [t("common.reintentar")]),
      ])
    );
  }
}
