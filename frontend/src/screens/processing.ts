import { el, render, toast } from "../ui";
import { crearTrabajo, getTrabajo } from "../api";
import { getDeviceId } from "../device";
import { reemplazar } from "../nav";
import { pantallaResult } from "./result";
import { pantallaForm } from "./form";
import { state } from "../state";
import { pedirPermisoNotif, notificarListo } from "../notif";

interface Args {
  categoria: string; detalle: string; tipo: "imagen" | "video"; foto: Blob;
  mask?: Blob; referencia?: Blob; proyecto?: string;
}

// Mensajes rotativos: la espera percibida baja cuando el texto avanza.
const PASOS_IMAGEN = [
  "Analizando tu espacio…",
  "Entendiendo lo que pediste…",
  "Aplicando la transformación…",
  "Puliendo los detalles…",
  "Casi listo…",
];
const PASOS_VIDEO = [
  "Analizando tu espacio…",
  "Generando la transformación…",
  "Creando los fotogramas del video…",
  "Animando la transición…",
  "Montando el video final…",
  "Casi listo, esto vale la pena…",
];
const PASOS_PROCESO = [
  "Reuniendo tus ediciones…",
  "Ordenando el antes y el después…",
  "Montando las transiciones…",
  "Renderizando tu video del proceso…",
];

// Token de la generación en curso: si el usuario navega a otra pantalla (o
// lanza otra generación), el polling viejo deja de tener derecho a navegar.
let generacionActual = 0;

/** Espera un trabajo ya creado en el backend y muestra el resultado. */
export function pantallaEsperarTrabajo(
  id: string,
  tipo: "imagen" | "video",
  pasos: string[] = tipo === "video" ? PASOS_VIDEO : PASOS_IMAGEN,
) {
  const miGeneracion = ++generacionActual;
  const sigoActivo = () => generacionActual === miGeneracion && !!document.querySelector(".proc-screen");

  let paso = 0;
  const msg = el("p", { class: "loader-msg" }, [pasos[0]]);
  const sub = el("p", { class: "loader-sub" }, [
    tipo === "video" ? "Puede tardar 1–2 minutos. Te avisamos cuando esté." : "Unos segundos…",
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
        }, ["Reintentar"]),
      ])
    );
  };

  const inicio = Date.now();
  const timer = setInterval(async () => {
    if (generacionActual !== miGeneracion) { clearInterval(timer); terminar(); return; }
    if (Date.now() - inicio > 5 * 60 * 1000) {
      clearInterval(timer);
      mostrarError("Está tardando demasiado. Intenta de nuevo en un momento.");
      return;
    }
    try {
      const t = await getTrabajo(id);
      if (t.status === "done") {
        clearInterval(timer);
        terminar();
        // La cadena de ediciones (para el video del proceso) crece con cada
        // imagen generada de la misma foto.
        if (t.tipo === "imagen") state.cadena.push(t.id);
        if (document.hidden) notificarListo(id, t.tipo); // app en background
        if (sigoActivo()) {
          reemplazar(() => pantallaResult(t));
        } else {
          notificarListo(id, t.tipo);
          toast("Tu transformación está lista ✨ — mírala en Recientes.");
        }
      } else if (t.status === "error") {
        clearInterval(timer);
        mostrarError(t.error || "Algo salió mal generando tu transformación.");
      }
    } catch (e) {
      clearInterval(timer);
      mostrarError((e as Error).message);
    }
  }, 3000);
}

export { PASOS_PROCESO };

export async function pantallaProcessing(args: Args) {
  // Pantalla de espera inmediata (mientras sube la foto)
  render(
    el("div", { class: "screen centro proc-screen" }, [
      el("div", { class: "spinner" }),
      el("p", { class: "loader-msg" }, ["Enviando tu foto…"]),
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
        }, ["Reintentar"]),
      ])
    );
  }
}
