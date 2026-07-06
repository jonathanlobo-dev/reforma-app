import { el, render, toast } from "../ui";
import { crearTrabajo, getTrabajo } from "../api";
import { getDeviceId } from "../device";
import { reemplazar } from "../nav";
import { pantallaResult } from "./result";
import { pantallaForm } from "./form";
import { state } from "../state";

interface Args {
  categoria: string; detalle: string; tipo: "imagen" | "video"; foto: Blob;
  mask?: Blob; referencia?: Blob; proyecto?: string;
}

// Token de la generación en curso: si el usuario navega a otra pantalla (o
// lanza otra generación), el polling viejo deja de tener derecho a navegar.
let generacionActual = 0;

export async function pantallaProcessing(args: Args) {
  const miGeneracion = ++generacionActual;
  const sigoActivo = () => generacionActual === miGeneracion && !!document.querySelector(".proc-screen");

  const msg = el("p", { class: "loader-msg" }, [
    args.tipo === "video"
      ? "Generando tu video… puede tardar 1–2 minutos ⏳"
      : "Generando tu transformación… ✨",
  ]);
  render(
    el("div", { class: "screen centro proc-screen" }, [
      el("div", { class: "spinner" }),
      msg,
    ])
  );

  const mostrarError = (texto: string) => {
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
      if (generacionActual !== miGeneracion) { clearInterval(timer); return; }
      if (Date.now() - inicio > 5 * 60 * 1000) {
        clearInterval(timer);
        mostrarError("Está tardando demasiado. Intenta de nuevo en un momento.");
        return;
      }
      try {
        const t = await getTrabajo(id);
        if (t.status === "done") {
          clearInterval(timer);
          if (sigoActivo()) reemplazar(() => pantallaResult(t));
          else toast("Tu transformación está lista ✨ — mírala en Recientes.");
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
