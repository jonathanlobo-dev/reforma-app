import "./styles.css";
import { getCategorias, getPremium } from "./api";
import { getDeviceId } from "./device";
import { state } from "./state";
import { pantallaHome } from "./screens/home";
import { pantallaRecientes } from "./screens/recientes";
import { pantallaAsesor } from "./screens/asesor";
import { pantallaInspiracion } from "./screens/inspiracion";
import { initAds } from "./ads";
import { raiz, initBack, setNavVisible } from "./nav";
import { el, render } from "./ui";
import { initNotifTap } from "./notif";
import { getTrabajo } from "./api";
import { pantallaResult } from "./screens/result";

(window as any).__reforma = { state, pantallaHome };

function wireNav() {
  const nav = document.getElementById("bottom-nav");
  if (!nav) return;
  nav.querySelectorAll(".nav-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = (btn as HTMLElement).dataset.tab;
      if (tab === "inicio") raiz(pantallaHome);
      else if (tab === "inspiracion") raiz(pantallaInspiracion);
      else if (tab === "asesor") raiz(() => pantallaAsesor());
      else if (tab === "recientes") raiz(pantallaRecientes);
    });
  });
}

async function start() {
  render(
    el("div", { class: "screen centro splash" }, [
      el("img", { class: "splash-logo", src: "/logo.png", alt: "RenovAI" }),
      el("h1", { class: "splash-nombre" }, ["RenovAI"]),
      el("p", { class: "splash-sub" }, ["Transforma tu espacio"]),
      el("div", { class: "spinner chico" }),
    ])
  );
  setNavVisible(false);
  initAds();
  initBack();
  wireNav();
  // Tocar la notificación "está lista" abre el resultado
  initNotifTap(async (tid) => {
    try {
      const t = await getTrabajo(tid);
      if (t.status === "done") raiz(() => pantallaResult(t));
    } catch { /* si falla, el usuario lo verá en Recientes */ }
  });

  try {
    state.categorias = await getCategorias();
    // Estado premium (no bloquea el arranque si falla)
    try { state.premium = (await getPremium(await getDeviceId())).premium; } catch { /* free */ }
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
