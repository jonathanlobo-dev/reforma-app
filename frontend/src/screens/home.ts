import { el, render } from "../ui";
import { state } from "../state";
import { irA, setNavVisible, setNavTab } from "../nav";
import { pantallaForm } from "./form";

const SUBTITULOS: Record<string, string> = {
  pintar: "Recolorea cualquier superficie",
  interior: "Rediseña tu sala, cocina o dormitorio",
  exterior: "Transforma fachadas y jardines",
  muebles: "Cambia el mobiliario con un toque",
  suelo: "Prueba cualquier material en tu suelo",
  paredes: "Rediseña las paredes con un toque",
  eliminar: "Elimina fácilmente elementos no deseados",
  restaurar: "Devuelve la vida a muebles y superficies",
  remodelar: "Remodelación completa del espacio",
};

export function pantallaHome() {
  setNavVisible(true);
  setNavTab("inicio");

  const cards = Object.entries(state.categorias).map(([clave, cat]) =>
    el("div", {
      class: "mode-card",
      "data-cat": clave,
      onClick: () => irA(() => pantallaForm(clave)),
    }, [
      // Fondo dividido: mitad antes | mitad después (estilo referencia)
      el("div", { class: "mode-card-split" }, [
        el("div", { class: "mode-card-half antes" }),
        el("div", { class: "mode-card-half despues" }),
        el("div", { class: "mode-card-divline" }),
      ]),
      el("div", { class: "mode-card-grad" }),
      el("div", { class: "mode-card-body" }, [
        el("div", { class: "mode-card-txt" }, [
          el("div", { class: "mode-card-titulo" }, [cat.titulo]),
          el("div", { class: "mode-card-sub" }, [SUBTITULOS[clave] ?? ""]),
        ]),
        el("button", { class: "mode-card-probar" }, ["Probar ›"]),
      ]),
    ])
  );

  render(
    el("div", { class: "screen" }, [
      el("div", { class: "home-header" }, [
        el("h1", {}, ["Inicio"]),
      ]),
      el("div", { class: "modes-list" }, cards),
    ])
  );
}
