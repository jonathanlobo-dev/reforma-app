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

// Token de la generación en curso: si el usuario navega a otra pantalla (o
// lanza otra generación), el polling viejo deja de tener derecho a navegar.
let generacionActual = 0;

export async function pantallaProcessing(args: Args) {
  const miGeneracion = ++generacionActual;
  const sigoActivo = () => generacionActual === miGeneracion && !!document.querySelector(".proc-screen");

  const pasos = args.tipo === "video" ? PASOS_VIDEO : PASOS_IMAGEN;
  let paso = 0;
  const msg = el("p", { class: "loader-msg" }, [pasos[0]]);
  const sub = el("p", { class: "loader-sub" }, [
    args.tipo === "video" ? "Puede tardar 1–2 minutos. Te avisamos cuando esté." : "Unos segundos…",
  ]);

  render(
    el("div", { class: "screen centro proc-screen" }, [
      el("div", { class: "spinner" }),
      msg, sub,
    ])
  );

  // Rotar mensajes cada 6 s (sin pasarse del último)
  const timerMsgs = setInterval(() => {
    if (generacionActual !== miGeneracion) { clearInterval(timerMsgs); return; }
    if (paso < pasos.length - 1) {
      paso++;
      msg.textContent = pasos[paso];
    }
  }, 6000);

  // Pedir permiso de notificación (una vez, mientras espera no molesta)
  pedirPermisoNotif();

  const terminar = () => clearInterval(timerMsgs);

  const mostrarError = (texto: string) => {
    terminar();
    if (!sigoActivo()) { toast(texto); return; }
    render(
      el("div", { class: "screen centro proc-screen" }, [
        el("p", { class: "error-msg" }, [texto]),
        el("button", { class: "btn-primario", onClick: () => reemplazar(() => pantallaForm(state.categoriaSel!)) }, ["Reintentar"]),
      ])
    );
  };

  try {
    const deviceId = await getDeviceId();
    const { id } = await crearTrabajo({ deviceId, ...args });

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
          if (document.hidden) notificarListo(id, t.tipo); // app en background
          if (sigoActivo()) {
            // Sigue en esta pantalla (aunque la app esté de fondo): al volver
            // encuentra el resultado, no el spinner congelado.
            reemplazar(() => pantallaResult(t));
          } else {
            // Navegó a otra pantalla: avisar sin secuestrarle la vista
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
  } catch (e) {
    mostrarError((e as Error).message);
  }
}
