// Modal de consejos de foto (estilo SnapHome): buenos/malos ejemplos.
// Se abre solo la primera vez por dispositivo; luego desde el botón "Consejos".
import { el } from "../ui";
import { t } from "../i18n";

const KEY = "reforma_consejos_visto";

export function consejosVistos(): boolean {
  return localStorage.getItem(KEY) === "1";
}

export function abrirConsejos(onCerrar?: () => void) {
  localStorage.setItem(KEY, "1");
  const overlay = el("div", { class: "sheet-overlay", onClick: cerrar });
  const sheet = el("div", { class: "sheet consejos-sheet", onClick: (e: Event) => e.stopPropagation() }, [
    el("div", { class: "sheet-tit" }, [t("consejos.titulo")]),
    el("div", { class: "consejo-txt" }, [t("consejos.texto")]),

    el("div", { class: "consejo-grupo mal" }, [t("consejos.evitar")]),
    el("div", { class: "consejo-grid" }, [
      ejemplo("/consejos/mala_primerplano.jpg", t("consejos.primer_plano"), true),
      ejemplo("/consejos/mala_oscura.jpg", t("consejos.habitacion_oscura"), true),
    ]),

    el("div", { class: "consejo-grupo bien" }, [t("consejos.asi_si")]),
    el("div", { class: "consejo-grid" }, [
      ejemplo("/consejos/buena_amplia.jpg", t("consejos.angulo_amplio"), false),
      ejemplo("/consejos/buena_iluminada.jpg", t("consejos.bien_iluminada"), false),
    ]),

    el("button", { class: "btn-primario", onClick: cerrar, style: "margin-top:14px;width:100%" }, [t("common.entendido")]),
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
