import "./styles.css";
import { getCategorias } from "./api";
import { state } from "./state";
import { pantallaHome } from "./screens/home";
import { pantallaRecientes } from "./screens/recientes";
import { initAds } from "./ads";
import { raiz, initBack, setNavVisible } from "./nav";
import { el, render } from "./ui";

(window as any).__reforma = { state, pantallaHome };

function wireNav() {
  const nav = document.getElementById("bottom-nav");
  if (!nav) return;
  nav.querySelectorAll(".nav-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = (btn as HTMLElement).dataset.tab;
      if (tab === "inicio") raiz(pantallaHome);
      else if (tab === "generar") raiz(pantallaHome);
      else if (tab === "recientes") raiz(pantallaRecientes);
    });
  });
}

async function start() {
  render(el("div", { class: "screen centro" }, [el("div", { class: "spinner" })]));
  setNavVisible(false);
  initAds();
  initBack();
  wireNav();

  try {
    state.categorias = await getCategorias();
    raiz(pantallaHome);
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
