// Modal de consejos de foto (estilo SnapHome): buenos/malos ejemplos.
// Se abre solo la primera vez por dispositivo; luego desde el botón "Consejos".
import { el } from "../ui";

const KEY = "reforma_consejos_visto";

export function consejosVistos(): boolean {
  return localStorage.getItem(KEY) === "1";
}

export function abrirConsejos(onCerrar?: () => void) {
  localStorage.setItem(KEY, "1");
  const overlay = el("div", { class: "sheet-overlay", onClick: cerrar });
  const sheet = el("div", { class: "sheet consejos-sheet", onClick: (e: Event) => e.stopPropagation() }, [
    el("div", { class: "sheet-tit" }, ["Para los mejores resultados"]),
    el("div", { class: "consejo-txt" }, [
      "Fotografía desde un ángulo amplio, con buena luz, mostrando la pared o el espacio completo.",
    ]),

    el("div", { class: "consejo-grupo mal" }, ["✗ Evita esto"]),
    el("div", { class: "consejo-grid" }, [
      ejemplo("/consejos/mala_primerplano.jpg", "Primer plano", true),
      ejemplo("/consejos/mala_oscura.jpg", "Habitación oscura", true),
    ]),

    el("div", { class: "consejo-grupo bien" }, ["✓ Así sí"]),
    el("div", { class: "consejo-grid" }, [
      ejemplo("/consejos/buena_amplia.jpg", "Ángulo amplio", false),
      ejemplo("/consejos/buena_iluminada.jpg", "Bien iluminada", false),
    ]),

    el("button", { class: "btn-primario", onClick: cerrar, style: "margin-top:14px;width:100%" }, ["Entendido"]),
  ]);
  overlay.append(sheet);
  document.body.append(overlay);

  function cerrar() {
    overlay.remove();
    onCerrar?.();
  }
}

function ejemplo(src: string, etiqueta: string, malo: boolean) {
  return el("div", { class: "consejo-item" }, [
    el("img", { src, loading: "lazy" }),
    el("span", { class: "consejo-tag " + (malo ? "mal" : "bien") }, [etiqueta]),
  ]);
}
