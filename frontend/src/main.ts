import "./styles.css";
import { getCategorias, getPremium } from "./api";
import { getDeviceId } from "./device";
import { state } from "./state";
import { pantallaHome } from "./screens/home";
import { pantallaRecientes } from "./screens/recientes";
import { pantallaAsesor } from "./screens/asesor";
import { pantallaInspiracion } from "./screens/inspiracion";
import { initAds, mostrarIntersticial } from "./ads";
import { raiz, initBack, setNavVisible } from "./nav";
import { el, render } from "./ui";
import { initNotifTap } from "./notif";
import { getTrabajo } from "./api";
import { pantallaResult } from "./screens/result";
import { pantallaPaywall } from "./screens/paywall";

(window as any).__reforma = { state, pantallaHome };

// El paywall de apertura sale 1 de cada N aperturas (no en todas, para no
// molestar). "Apertura" = cada vez que se abre la app. Cambia PAYWALL_CADA a 2
// para hacerlo más frecuente.
const PAYWALL_CADA = 3;
function tocaPaywallApertura(): boolean {
  const key = "renovai_aperturas";
  const n = (parseInt(localStorage.getItem(key) || "0", 10) || 0) + 1;
  localStorage.setItem(key, String(n));
  return n % PAYWALL_CADA === 1; // aperturas 1, 4, 7...
}

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
    // Al abrir: los usuarios gratis ven el paywall en 1 de cada 3 aperturas
    // (no en todas, para no molestar). Al cerrarlo (X) se muestra un anuncio y
    // pasa a Inicio. Premium entra directo a Inicio, siempre.
    if (!state.premium && tocaPaywallApertura()) {
      raiz(() => pantallaPaywall({
        alCerrar: () => { raiz(pantallaHome); mostrarIntersticial(); },
      }));
    } else {
      raiz(pantallaHome);
    }
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
