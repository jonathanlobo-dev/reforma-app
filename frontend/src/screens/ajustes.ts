// Ajustes: idioma, cómo usar, límites/créditos, descargo de responsabilidad, cuenta.
import { el, render, toast } from "../ui";
import { atras, setNavVisible } from "../nav";
import { getDeviceId } from "../device";
import { state } from "../state";
import { API_BASE } from "../config";
import { t, idioma, setIdioma, IDIOMAS, type Idioma } from "../i18n";

const VERSION = "2.0";

function seccion(titulo: string, contenido: (Node | string)[]) {
  const cuerpo = el("div", { class: "aj-cuerpo" }, contenido);
  cuerpo.style.display = "none";
  const cab = el("button", { class: "aj-cab", onClick: () => {
    const abierto = cuerpo.style.display !== "none";
    cuerpo.style.display = abierto ? "none" : "block";
    flecha.textContent = abierto ? "▸" : "▾";
  }}, [el("span", {}, [titulo])]);
  const flecha = el("span", { class: "aj-flecha" }, ["▸"]);
  cab.append(flecha);
  return el("div", { class: "aj-seccion" }, [cab, cuerpo]);
}

function p(texto: string) { return el("p", { class: "aj-p" }, [texto]); }
function li(items: string[]) {
  return el("ul", { class: "aj-ul" }, items.map((i) => el("li", {}, [i])));
}

function selectorIdioma(): HTMLElement {
  const items: HTMLElement[] = [];
  const list = el("div", { class: "radio-list" });

  function actualizar() {
    items.forEach((i) => i.classList.toggle("sel", i.dataset.val === idioma()));
  }

  IDIOMAS.forEach((idi) => {
    const item = el("div", {
      class: "radio-item",
      "data-val": idi.codigo,
      onClick: async () => {
        if (idi.codigo === idioma()) return;
        await setIdioma(idi.codigo as Idioma);
        toast(t("ajustes.idioma.cambiado"));
      },
    }, [
      el("span", { class: "radio-dot" }),
      el("span", { class: "radio-txt" }, [idi.nombre]),
    ]);
    list.append(item);
    items.push(item);
  });

  actualizar();
  return list;
}

export function pantallaAjustes() {
  setNavVisible(false);

  const idValor = el("span", { class: "id-valor" }, ["…"]);
  const idBox = el("div", { class: "id-box" }, [
    idValor,
    el("button", { class: "id-copiar" }, [t("common.copiar")]),
  ]);

  render(
    el("div", { class: "screen" }, [
      el("div", { class: "topbar" }, [
        el("button", { class: "back", onClick: atras }, ["‹"]),
        el("span", { class: "topbar-tit" }, [t("ajustes.titulo")]),
      ]),

      seccion(t("ajustes.idioma.titulo"), [selectorIdioma()]),

      seccion(t("ajustes.sec.uso.titulo"), [
        p(t("ajustes.sec.uso.p1")),
        p(t("ajustes.sec.uso.p2")),
        p(t("ajustes.sec.uso.p3")),
        li([t("ajustes.sec.uso.li1"), t("ajustes.sec.uso.li2")]),
        p(t("ajustes.sec.uso.p4")),
        p(t("ajustes.sec.uso.p5", { nombre: t("asesor.nombre") })),
      ]),

      seccion(t("ajustes.sec.limites.titulo"), [
        p(t("ajustes.sec.limites.p1")),
        li([t("ajustes.sec.limites.li1"), t("ajustes.sec.limites.li2"), t("ajustes.sec.limites.li3")]),
        p(t("ajustes.sec.limites.p2")),
      ]),

      seccion(t("ajustes.sec.descargo.titulo"), [
        p(t("ajustes.sec.descargo.p1")),
        li([
          t("ajustes.sec.descargo.li1"),
          t("ajustes.sec.descargo.li2"),
          t("ajustes.sec.descargo.li3"),
          t("ajustes.sec.descargo.li4"),
        ]),
        p(t("ajustes.sec.descargo.p2")),
      ]),

      seccion(t("ajustes.sec.cuenta.titulo"), [
        p(state.premium ? t("ajustes.sec.cuenta.premium") : t("ajustes.sec.cuenta.gratis")),
        p(t("ajustes.sec.cuenta.id_texto")),
        idBox,
      ]),

      seccion(t("ajustes.sec.acerca.titulo"), [
        p(t("ajustes.sec.acerca.version", { v: VERSION })),
        p(t("ajustes.sec.acerca.desc")),
        p(t("ajustes.sec.acerca.hecho")),
        el("a", {
          class: "aj-link", href: "#",
          onClick: (e: Event) => { e.preventDefault(); window.open(`${API_BASE}/privacidad`, "_blank"); },
        }, [t("ajustes.sec.acerca.privacidad")]),
      ]),
    ])
  );

  // Rellenar el ID de dispositivo (async) y cablear el botón copiar
  getDeviceId().then((id) => {
    idValor.textContent = id;
    (idBox.querySelector(".id-copiar") as HTMLElement).onclick = async () => {
      try {
        await navigator.clipboard.writeText(id);
        toast(t("ajustes.id_copiado"));
      } catch {
        toast(id);
      }
    };
  });
}
