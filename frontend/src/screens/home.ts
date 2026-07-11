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
  { clave: "interior", labelKey: "home.seccion.interior", filtro: ["interior", "pintar", "suelo", "paredes", "muebles", "eliminar", "restaurar", "remodelar"] },
  { clave: "exterior", labelKey: "home.seccion.exterior", filtro: ["exterior", "plano"] },
  { clave: "herramientas", labelKey: "home.seccion.herramientas", filtro: ["pincel", "estilo", "plano"] },
];
let seccionActiva = "todos";

// Orden de las cards en la home (las estrella primero)
const ORDEN = ["interior", "pincel", "estilo", "remodelar", "pintar", "suelo",
               "paredes", "muebles", "eliminar", "restaurar", "exterior", "plano"];

// Portada única por categoría (fotos generadas en /estilos). "remodelar" no está
// aquí: usa el split antes|después real de la cocina del usuario.
// Sin repetir portada en cards adyacentes (orden: interior, pincel, estilo,
// remodelar(split), pintar, suelo, paredes, muebles, eliminar, restaurar,
// exterior, plano).
const COVERS: Record<string, string> = {
  interior: "/estilos/moderno.webp",
  pincel: "/estilos/contemporaneo.webp",
  estilo: "/estilos/industrial.webp",
  pintar: "/estilos/tradicional.webp",
  suelo: "/estilos/escandinavo.webp",
  paredes: "/estilos/clasico.webp",
  muebles: "/estilos/minimalista.webp",
  eliminar: "/estilos/rustico.webp",
  restaurar: "/estilos/tradicional.webp",
  exterior: "/estilos/escandinavo.webp",
  plano: "/estilos/moderno.webp",
};

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

  const cards = claves.map((clave) => [clave, state.categorias[clave]] as const).map(([clave, cat]) => {
    // Fondo: portada única, o split antes|después (remodelar = demo real)
    const fondo = COVERS[clave]
      ? el("div", { class: "mode-card-cover", style: `background-image:url('${COVERS[clave]}')` })
      : el("div", { class: "mode-card-split" }, [
          el("div", { class: "mode-card-half antes" }),
          el("div", { class: "mode-card-half despues" }),
          el("div", { class: "mode-card-divline" }),
        ]);
    return el("div", {
      class: "mode-card",
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
        el("h1", {}, [t("home.titulo")]),
        el("div", { class: "home-acciones" }, [
          ...(state.premium
            ? [el("span", { class: "pro-activo" }, [icon("crown", 14), t("home.pro")])]
            : [el("button", { class: "pro-btn", onClick: () => irA(pantallaPaywall) }, [icon("crown", 14), t("home.pro")])]),
          el("button", {
            class: "home-gear", "aria-label": "Ajustes",
            onClick: () => irA(pantallaAjustes),
          }, [icon("gear", 21)]),
        ]),
      ]),
      tabs,
      el("div", { class: "modes-list" }, cards),
    ])
  );
}
