import { el, render } from "../ui";
import { crearTrabajo, getTrabajo } from "../api";
import { getDeviceId } from "../device";
import { pantallaResult } from "./result";
import { pantallaForm } from "./form";
import { state } from "../state";

interface Args {
  categoria: string; detalle: string; tipo: "imagen" | "video"; foto: Blob;
}

export async function pantallaProcessing(args: Args) {
  const msg = el("p", { class: "loader-msg" }, [
    args.tipo === "video"
      ? "Generando tu video… puede tardar 1–2 minutos ⏳"
      : "Generando tu transformación… ✨",
  ]);
  render(
    el("div", { class: "screen centro" }, [
      el("div", { class: "spinner" }),
      msg,
    ])
  );

  const mostrarError = (texto: string) => {
    render(
      el("div", { class: "screen centro" }, [
        el("p", { class: "error-msg" }, [texto]),
        el("button", { class: "btn-primario", onClick: () => pantallaForm(state.categoriaSel!) }, ["Reintentar"]),
      ])
    );
  };

  try {
    const deviceId = await getDeviceId();
    const { id } = await crearTrabajo({ deviceId, ...args });

    const inicio = Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - inicio > 5 * 60 * 1000) {
        clearInterval(timer);
        mostrarError("Está tardando demasiado. Intenta de nuevo en un momento.");
        return;
      }
      try {
        const t = await getTrabajo(id);
        if (t.status === "done") {
          clearInterval(timer);
          pantallaResult(t);
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
