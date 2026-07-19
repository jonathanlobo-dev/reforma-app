// Tutorial de primera apertura (tipo tarjetas): qué hace la app, los modos,
// el plano 2D→3D y los videos. Solo se muestra una vez (flag en localStorage).
import { el, render } from "../ui";
import { setNavVisible } from "../nav";
import { t } from "../i18n";

const FLAG = "renovai_onboarding_v1";

export function onboardingPendiente(): boolean {
  return !localStorage.getItem(FLAG);
}

interface Tarjeta { media: () => HTMLElement; tituloKey: string; textoKey: string; }

const TARJETAS: Tarjeta[] = [
  {
    media: () => el("img", { class: "onb-img", src: "/covers/interior_d.webp" }),
    tituloKey: "onb.1.titulo", textoKey: "onb.1.texto",
  },
  {
    media: () => el("div", { class: "onb-grid" }, [
      el("img", { src: "/covers/pintar_d.webp" }),
      el("img", { src: "/covers/muebles_d.webp" }),
      el("img", { src: "/covers/eliminar_d.webp" }),
      el("img", { src: "/covers/estilo_d.webp" }),
    ]),
    tituloKey: "onb.2.titulo", textoKey: "onb.2.texto",
  },
  {
    media: () => el("div", { class: "onb-split" }, [
      el("img", { src: "/covers/plano_a.webp" }),
      el("span", { class: "onb-flecha" }, ["→"]),
      el("img", { src: "/covers/plano_d.webp" }),
    ]),
    tituloKey: "onb.3.titulo", textoKey: "onb.3.texto",
  },
  {
    media: () => el("video", {
      class: "onb-img", src: "/mock/final.mp4",
      autoplay: true, loop: true, muted: true, playsinline: true,
    }),
    tituloKey: "onb.4.titulo", textoKey: "onb.4.texto",
  },
];

export function pantallaOnboarding(alTerminar: () => void) {
  setNavVisible(false);
  let paso = 0;

  function terminar() {
    localStorage.setItem(FLAG, "1");
    alTerminar();
  }

  function pintar() {
    const tj = TARJETAS[paso];
    const ultimo = paso === TARJETAS.length - 1;
    render(
      el("div", { class: "screen onb-screen" }, [
        el("button", { class: "onb-saltar", onClick: terminar }, [t("onb.saltar")]),
        el("div", { class: "onb-media" }, [tj.media()]),
        el("h2", { class: "onb-titulo" }, [t(tj.tituloKey)]),
        el("p", { class: "onb-texto" }, [t(tj.textoKey)]),
        el("div", { class: "onb-dots" },
          TARJETAS.map((_, i) => el("span", { class: "onb-dot" + (i === paso ? " sel" : "") }))),
        el("button", {
          class: "btn-primario onb-btn",
          onClick: () => { if (ultimo) terminar(); else { paso++; pintar(); } },
        }, [t(ultimo ? "onb.empezar" : "onb.siguiente")]),
      ])
    );
  }
  pintar();
}
