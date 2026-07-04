import { el, render } from "../ui";
import { state } from "../state";
import { pantallaForm } from "./form";

export function pantallaHome() {
  const cards = Object.entries(state.categorias).map(([clave, cat]) =>
    el("button", { class: "card", onClick: () => pantallaForm(clave) }, [
      el("div", { class: "card-emoji" }, [cat.emoji]),
      el("div", { class: "card-titulo" }, [cat.titulo]),
    ])
  );

  render(
    el("div", { class: "screen" }, [
      el("header", { class: "hero" }, [
        el("h1", {}, ["Reforma AI"]),
        el("p", { class: "sub" }, ["Sube una foto de tu espacio y míralo transformarse ✨"]),
      ]),
      el("div", { class: "grid" }, cards),
    ])
  );
}
