import { el, render } from "../ui";
import { state } from "../state";
import { irA } from "../nav";
import { setNavVisible, setNavTab } from "../nav";
import { pantallaForm } from "./form";

const SUBTITULOS: Record<string, string> = {
  pintar: "Cambia el color de paredes y superficies",
  interior: "Rediseña tu sala, cocina o dormitorio",
  exterior: "Transforma fachadas y jardines",
  muebles: "Reemplaza o mueve los muebles",
  suelo: "Elige un nuevo piso para tu espacio",
  paredes: "Cambia el acabado de tus paredes",
  eliminar: "Quita objetos que sobran",
  restaurar: "Devuelve la vida a muebles y superficies",
  remodelar: "Remodelación completa del espacio",
};

export function pantallaHome() {
  setNavVisible(true);
  setNavTab("inicio");

  const cards = Object.entries(state.categorias).map(([clave, cat]) => {
    const card = el("div", {
      class: "mode-card",
      "data-cat": clave,
      onClick: () => irA(() => pantallaForm(clave)),
    }, [
      el("div", { class: "mode-card-bg" }),
      el("div", { class: "mode-card-grad" }),
      el("div", { class: "mode-card-body" }, [
        el("div", { class: "mode-card-emoji" }, [cat.emoji]),
        el("div", { class: "mode-card-titulo" }, [cat.titulo]),
        el("div", { class: "mode-card-sub" }, [SUBTITULOS[clave] ?? ""]),
      ]),
    ]);
    return card;
  });

  render(
    el("div", { class: "screen" }, [
      el("div", { class: "home-header" }, [
        el("h1", {}, ["Reforma AI"]),
        el("p", { class: "sub" }, ["¿Qué quieres transformar hoy?"]),
      ]),
      el("div", { class: "modes-grid" }, cards),
    ])
  );
}
