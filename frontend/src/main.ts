import "./styles.css";
import { getCategorias } from "./api";
import { state } from "./state";
import { pantallaHome } from "./screens/home";
import { initAds } from "./ads";
import { el, render } from "./ui";

// Hook de depuración (inofensivo en prod): permite probar el flujo sin el
// diálogo nativo de archivos. window.__reforma.state / pantallaHome.
(window as any).__reforma = { state, pantallaHome };

async function start() {
  render(el("div", { class: "screen centro" }, [el("div", { class: "spinner" })]));
  initAds();
  try {
    state.categorias = await getCategorias();
    pantallaHome();
  } catch (e) {
    render(
      el("div", { class: "screen centro" }, [
        el("p", { class: "error-msg" }, ["No se pudo conectar con el servidor."]),
        el("button", { class: "btn-primario", onClick: start }, ["Reintentar"]),
      ])
    );
    console.error(e);
  }
}

start();
