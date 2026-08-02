import { el, render } from "../ui";
import { state } from "../state";
import { irA, setNavVisible, setNavTab } from "../nav";
import { pantallaForm } from "./form";
import { pantallaAjustes } from "./ajustes";
import { pantallaPaywall } from "./paywall";
import { icon } from "../ui/icons";
import { t } from "../i18n";

// Pestañas de sección (estilo referencia): filtran la grilla de modos.
// Claves internas estables (no traducidas); la etiqueta visible sale de t().
const SECCIONES: { clave: string; labelKey: string; filtro: string[] | null }[] = [
  { clave: "todos", labelKey: "home.seccion.todos", filtro: null },
  { clave: "interior", labelKey: "home.seccion.interior", filtro: ["interior", "pintar", "suelo", "muebles", "eliminar", "iluminacion", "restaurar"] },
  { clave: "exterior", labelKey: "home.seccion.exterior", filtro: ["exterior", "plano"] },
  { clave: "herramientas", labelKey: "home.seccion.herramientas", filtro: ["pincel", "estilo", "plano"] },
];
let seccionActiva = "todos";

// Orden de las cards en la home (las estrella primero)
const ORDEN = ["interior", "pincel", "estilo", "pintar", "suelo",
               "muebles", "eliminar", "iluminacion",
               "restaurar", "exterior", "plano"];

// Portadas antes|después por categoría (pares generados en /covers con
// tools/gen_assets.py: <cat>_a.webp = antes, <cat>_d.webp = después).
const PARES = ["pintar", "interior", "exterior", "muebles", "suelo",
               "eliminar", "restaurar", "pincel", "estilo", "plano"];

export function pantallaHome() {
  setNavVisible(true);
  setNavTab("inicio");

  const seccion = SECCIONES.find((s) => s.clave === seccionActiva) ?? SECCIONES[0];
  const claves = ORDEN.filter((c) => state.categorias[c])
    .concat(Object.keys(state.categorias).filter((c) => !ORDEN.includes(c)))
    .filter((c) => !state.categorias[c].oculta)
    .filter((c) => !seccion.filtro || seccion.filtro.includes(c));

  const tabs = el("div", { class: "proy-chips" },
    SECCIONES.map((s) =>
      el("button", {
        class: "proy-chip" + (s.clave === seccionActiva ? " sel" : ""),
        onClick: () => { seccionActiva = s.clave; pantallaHome(); },
      }, [t(s.labelKey)])
    ));

  const cards = claves.map((clave) => [clave, state.categorias[clave]] as const).map(([clave, cat], i) => {
    const compacto = i > 0; // la primera va destacada a lo ancho
    // Fondo: split antes|después propio de la categoría, o el genérico de /mock
    const fondo = PARES.includes(clave)
      ? el("div", { class: "mode-card-split" }, [
          el("div", { class: "mode-card-img antes", style: `background-image:url('/covers/${clave}_a.webp')` }),
          el("div", { class: "mode-card-img despues", style: `background-image:url('/covers/${clave}_d.webp')` }),
          el("div", { class: "mode-card-divline" }),
        ])
      : el("div", { class: "mode-card-split" }, [
          el("div", { class: "mode-card-img antes generico" }),
          el("div", { class: "mode-card-img despues generico" }),
          el("div", { class: "mode-card-divline" }),
        ]);
    return el("div", {
      class: "mode-card" + (compacto ? " compacto" : ""),
      "data-cat": clave,
      onClick: () => irA(() => pantallaForm(clave)),
    }, [
      fondo,
      el("div", { class: "mode-card-grad" }),
      el("div", { class: "mode-card-body" }, [
        el("div", { class: "mode-card-txt" }, [
          el("div", { class: "mode-card-titulo" }, [cat.titulo]),
          el("div", { class: "mode-card-sub" }, [t(`modo.sub.${clave}`) || ""]),
        ]),
        el("button", { class: "mode-card-probar" }, [t("home.probar")]),
      ]),
    ]);
  });

  render(
    el("div", { class: "screen" }, [
      el("div", { class: "home-header" }, [
        // Marca (constante en todos los idiomas), no "Inicio": es lo primero que
        // ve el usuario al abrir y las apps del rubro muestran aquí su nombre.
        el("h1", { class: "home-marca" }, ["Renuev", el("span", { class: "marca-ai" }, ["AI"])]),
        el("div", { class: "home-acciones" }, [
          state.premium
            ? el("span", { class: "pro-activo" }, [icon("crown", 14), t("home.pro")])
            : el("button", { class: "pro-btn", onClick: () => irA(pantallaPaywall) },
                 [icon("crown", 14), t("home.pro")]),
          el("button", {
            class: "home-gear", "aria-label": "Ajustes",
            onClick: () => irA(pantallaAjustes),
          }, [icon("gear", 21)]),
        ]),
      ]),
      tabs,
      // Destacada + rejilla de dos columnas (con 15 modos, una sola columna
      // hacía el scroll interminable).
      el("div", { class: "modes-list" }, cards.slice(0, 1)),
      cards.length > 1 ? el("div", { class: "modes-grid" }, cards.slice(1)) : el("div", {}, []),
    ])
  );
  animarVisibles();
}

/** Activa el barrido antes/después solo en las cards que están en pantalla, y
 *  lo escalona para que no barran todas al unísono (se ve mecánico). */
function animarVisibles() {
  const cards = [...document.querySelectorAll<HTMLElement>(".mode-card")];
  if (!("IntersectionObserver" in window)) {
    cards.forEach((c) => c.classList.add("animar"));
    return;
  }
  const obs = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => {
      const c = e.target as HTMLElement;
      if (e.isIntersecting) {
        c.style.animationDelay = "";
        const i = cards.indexOf(c);
        c.querySelectorAll<HTMLElement>(".mode-card-img.despues, .mode-card-divline")
          .forEach((n) => { n.style.animationDelay = `${(i % 4) * 0.45}s`; });
        c.classList.add("animar");
      } else {
        c.classList.remove("animar");
      }
    });
  }, { threshold: 0.35 });
  cards.forEach((c) => obs.observe(c));
}
