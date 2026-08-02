// Controles reutilizables de UI. Cada uno devuelve { node, getValue }.
// Internamente todo se rastrea por SLUG estable (no por texto traducido);
// getValue() devuelve la etiqueta YA TRADUCIDA (se manda tal cual al backend
// como parte de `detalle` — Groq entiende cualquier idioma).
import { el } from "../ui";
import { t } from "../i18n";

// ─── Carrusel de estilos (con foto de preview de cada estilo) ──────────────
const ESTILOS = [
  "moderno", "minimalista", "escandinavo", "industrial",
  "contemporaneo", "rustico", "clasico", "tradicional",
];

// Opciones especiales SIN foto: "ninguno" (no imponer ningún estilo — solo
// aplicar lo que el usuario pida en el campo de texto) y "personalizado"
// (el estilo lo describe el usuario con sus palabras). getSlug() permite al
// form omitir la frase "Estilo: X." cuando no corresponde.
const ESTILOS_ESPECIALES = [
  { slug: "ninguno", emoji: "🚫" },
  { slug: "personalizado", emoji: "✏️" },
];

export function estiloCarrusel(inicialSlug = "moderno") {
  let sel = inicialSlug;
  let cards: HTMLElement[] = [];

  const row = el("div", { class: "estilo-row" });

  function actualizar() {
    cards.forEach((c) => c.classList.toggle("sel", c.dataset.val === sel));
  }

  cards = [
    ...ESTILOS_ESPECIALES.map(({ slug, emoji }) => {
      const card = el("button", {
        class: "estilo-card especial",
        "data-val": slug,
        onClick: () => { sel = slug; actualizar(); },
      }, [
        el("span", { class: "estilo-card-emoji" }, [emoji]),
        el("span", { class: "estilo-card-nombre" }, [t(`estilo.${slug}`)]),
        el("span", { class: "estilo-card-check" }, ["✓"]),
      ]);
      row.append(card);
      return card;
    }),
    ...ESTILOS.map((slug) => {
      const card = el("button", {
        class: "estilo-card",
        "data-val": slug,
        onClick: () => { sel = slug; actualizar(); },
      }, [
        el("img", { class: "estilo-card-img", src: `/estilos/${slug}.webp`, loading: "lazy", alt: t(`estilo.${slug}`) }),
        el("span", { class: "estilo-card-nombre" }, [t(`estilo.${slug}`)]),
        el("span", { class: "estilo-card-check" }, ["✓"]),
      ]);
      row.append(card);
      return card;
    }),
  ];

  actualizar();
  return {
    node: el("div", { class: "ctrl-wrap" }, [
      el("div", { class: "ctrl-label" }, [t("ctrl.estilo_label")]),
      row,
    ]),
    getValue: () => t(`estilo.${sel}`),
    getSlug: () => sel,
  };
}

// ─── Selector de color ─────────────────────────────────────────────────────
const COLORES = [
  { slug: "blanco", hex: "#f5f5f0" },
  { slug: "crema", hex: "#f2e8d5" },
  { slug: "gris_claro", hex: "#d0ceca" },
  { slug: "gris_oscuro", hex: "#5a5a5a" },
  { slug: "negro", hex: "#1a1a1a" },
  { slug: "beige", hex: "#c8b89a" },
  { slug: "terracota", hex: "#c1522a" },
  { slug: "ladrillo", hex: "#8b2500" },
  { slug: "verde_salvia", hex: "#6b8f71" },
  { slug: "verde_oscuro", hex: "#2e5930" },
  { slug: "azul_pizarra", hex: "#5b7a99" },
  { slug: "azul_marino", hex: "#1a2e4a" },
  { slug: "amarillo_ocre", hex: "#c8a23a" },
  { slug: "mostaza", hex: "#b5860d" },
  { slug: "coral", hex: "#d95f4b" },
  { slug: "lavanda", hex: "#9b8ec4" },
];

export function colorSelector(inicialSlug = "blanco") {
  let sel = inicialSlug;
  const preview = el("span", { class: "color-swatch-preview" }) as HTMLElement;
  const label = el("span", {}, [t(`color.${sel}`)]);

  function actualizarPreview() {
    const c = COLORES.find((x) => x.slug === sel);
    preview.style.background = c?.hex ?? "#fff";
    label.textContent = t(`color.${sel}`);
  }
  actualizarPreview();

  const btn = el("button", {
    class: "color-btn",
    onClick: abrirModal,
  }, [preview, label, el("span", { class: "dropdown-arrow" }, ["▼"])]);

  function abrirModal() {
    const overlay = el("div", { class: "color-modal-overlay", onClick: cerrar });
    const modal = el("div", { class: "color-modal", onClick: (e: Event) => e.stopPropagation() }, [
      el("div", { class: "color-modal-tit" }, [t("ctrl.color_elegir")]),
      el("div", { class: "color-grid" }, COLORES.map((c) =>
        el("div", { class: "color-item", onClick: () => { sel = c.slug; actualizarPreview(); cerrar(); } }, [
          el("div", {
            class: "color-swatch" + (sel === c.slug ? " sel" : ""),
            style: `background: ${c.hex}`,
          }),
          el("div", { class: "color-name" }, [t(`color.${c.slug}`)]),
        ])
      )),
    ]);
    overlay.append(modal);
    document.body.append(overlay);
    function cerrar() { overlay.remove(); }
  }

  return {
    node: el("div", { class: "ctrl-wrap" }, [
      el("div", { class: "ctrl-label" }, [t("ctrl.color_label")]),
      btn,
    ]),
    getValue: () => t(`color.${sel}`),
  };
}

// ─── Selector de superficie ────────────────────────────────────────────────
const SUPERFICIES = [
  { ico: "🧱", slug: "pared" },
  { ico: "🚪", slug: "puerta" },
  { ico: "🪵", slug: "piso" },
  { ico: "🏠", slug: "gabinete" },
  { ico: "🌿", slug: "exterior" },
];

export function superficieSelector(inicialSlug = "pared") {
  let sel = inicialSlug;
  let items: HTMLElement[] = [];

  const list = el("div", { class: "radio-list" });

  function actualizar() {
    items.forEach((i) => i.classList.toggle("sel", i.dataset.val === sel));
  }

  items = SUPERFICIES.map((s) => {
    const item = el("div", {
      class: "radio-item",
      "data-val": s.slug,
      onClick: () => { sel = s.slug; actualizar(); },
    }, [
      el("span", { class: "radio-dot" }),
      el("span", { class: "radio-ico" }, [s.ico]),
      el("span", { class: "radio-txt" }, [t(`superficie.${s.slug}`)]),
    ]);
    list.append(item);
    return item;
  });

  actualizar();
  return {
    node: el("div", { class: "ctrl-wrap" }, [
      el("div", { class: "ctrl-label" }, [t("ctrl.superficie_label")]),
      list,
    ]),
    getValue: () => t(`superficie.${sel}`),
  };
}

// ─── Dropdown genérico (bottom-sheet) ─────────────────────────────────────
// `tituloKey` y cada `opciones[].labelKey` son claves de traducción; el
// valor interno (`sel`) es el slug, getValue() devuelve la etiqueta traducida.
export interface OpcionDropdown { slug: string; labelKey: string; }

export function dropdown(tituloKey: string, opciones: OpcionDropdown[], inicialSlug: string) {
  let sel = inicialSlug;
  const labelEl = el("span", {}, [t(opciones.find((o) => o.slug === sel)?.labelKey ?? "")]);

  function actualizar(slug: string) {
    sel = slug;
    labelEl.textContent = t(opciones.find((o) => o.slug === sel)?.labelKey ?? "");
  }

  const btn = el("button", {
    class: "dropdown-btn",
    onClick: abrirSheet,
  }, [labelEl, el("span", { class: "dropdown-arrow" }, ["▼"])]);

  function abrirSheet() {
    const overlay = el("div", { class: "sheet-overlay", onClick: cerrar });
    const sheet = el("div", { class: "sheet", onClick: (e: Event) => e.stopPropagation() }, [
      el("div", { class: "sheet-tit" }, [t(tituloKey)]),
      ...opciones.map((o) =>
        el("div", {
          class: "sheet-opt" + (sel === o.slug ? " sel" : ""),
          onClick: () => { actualizar(o.slug); cerrar(); },
        }, [
          el("span", {}, [t(o.labelKey)]),
          ...(sel === o.slug ? [el("span", { class: "sheet-check" }, ["✓"])] : []),
        ])
      ),
    ]);
    overlay.append(sheet);
    document.body.append(overlay);
    function cerrar() { overlay.remove(); }
  }

  return {
    node: el("div", { class: "ctrl-wrap" }, [
      el("div", { class: "ctrl-label" }, [t(tituloKey)]),
      btn,
    ]),
    getValue: () => t(opciones.find((o) => o.slug === sel)?.labelKey ?? ""),
  };
}

// ─── Chips seleccionables (grilla de botones) ──────────────────────────────
// Alternativa al `dropdown` de bottom-sheet: toque directo, sin abrir hoja.
// Acepta las mismas `OpcionDropdown[]` (slug + labelKey) para poder sustituir
// un dropdown por chips sin tocar el resto del formulario.
export function chipsSelector(labelKey: string, opciones: OpcionDropdown[], inicialSlug: string) {
  let sel = inicialSlug;
  let botones: HTMLElement[] = [];

  const grid = el("div", { class: "chips-grid" });

  function actualizar() {
    botones.forEach((b) => b.classList.toggle("sel", b.dataset.slug === sel));
  }

  botones = opciones.map((o) => {
    const b = el("button", {
      class: "chip-opcion",
      "data-slug": o.slug,
      onClick: () => { sel = o.slug; actualizar(); },
    }, [t(o.labelKey)]) as HTMLElement;
    grid.append(b);
    return b;
  });

  actualizar();
  return {
    node: el("div", { class: "ctrl-wrap" }, [
      el("div", { class: "ctrl-label" }, [t(labelKey)]),
      grid,
    ]),
    getValue: () => t(opciones.find((o) => o.slug === sel)?.labelKey ?? ""),
    getSlug: () => sel,
  };
}

// ─── Slider antes/después ──────────────────────────────────────────────────
export function baSlider(urlAntes: string, urlDespues: string): HTMLElement {
  const wrap = el("div", { class: "ba-slider" }) as HTMLElement;

  // Fondo = después; clip (izquierda) = antes → convencion: izq=antes, der=después
  const imgDespues = el("img", { class: "ba-fondo", src: urlDespues, draggable: false }) as HTMLImageElement;
  const clip = el("div", { class: "ba-clip", style: "width: 50%" }) as HTMLElement;
  const imgAntes = el("img", { src: urlAntes, draggable: false }) as HTMLImageElement;
  const divider = el("div", { class: "ba-divider", style: "left: 50%" }) as HTMLElement;
  const handle = el("div", { class: "ba-handle" }, ["◁▷"]);

  clip.append(imgAntes);
  divider.append(handle);
  wrap.append(imgDespues, clip, divider);

  // El alto del wrap ya no lo define el alto natural de la imagen (eso
  // rompía el layout con fotos verticales): se fija un aspect-ratio según la
  // imagen y un tope (`max-height` en CSS) la recorta cuando hace falta.
  // Ambas mitades usan object-fit: cover sobre esa misma caja, así el corte
  // queda alineado entre antes y después.
  function syncAspectRatio() {
    const w = imgDespues.naturalWidth, h = imgDespues.naturalHeight;
    if (w && h) wrap.style.aspectRatio = `${w} / ${h}`;
  }
  // La imagen dentro del clip debe tener el ancho del wrapper (no el del
  // clip, que cambia con el arrastre) para que se vea la misma foto completa
  // recortada por la ventana del clip. ResizeObserver observa al propio
  // wrap: muere con el nodo (sin fugas).
  function syncClipImgWidth() {
    imgAntes.style.width = wrap.offsetWidth + "px";
  }
  imgDespues.addEventListener("load", () => { syncAspectRatio(); syncClipImgWidth(); });
  if (imgDespues.complete) { syncAspectRatio(); syncClipImgWidth(); }
  new ResizeObserver(syncClipImgWidth).observe(wrap);

  // Pointer Events con captura: el drag sigue fuera del elemento sin
  // necesidad de listeners en window (que quedaban vivos para siempre).
  let dragging = false;

  function setPos(pct: number) {
    const clamped = Math.max(2, Math.min(98, pct));
    clip.style.width = `${clamped}%`;
    divider.style.left = `${clamped}%`;
  }

  function fromEvent(e: PointerEvent): number {
    const rect = wrap.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * 100;
  }

  wrap.addEventListener("pointerdown", (e) => {
    dragging = true;
    try { wrap.setPointerCapture(e.pointerId); } catch { /* pointer ya inactivo */ }
    setPos(fromEvent(e));
  });
  wrap.addEventListener("pointermove", (e) => { if (dragging) setPos(fromEvent(e)); });
  wrap.addEventListener("pointerup", () => { dragging = false; });
  wrap.addEventListener("pointercancel", () => { dragging = false; });

  return wrap;
}

// ─── Paleta de colores ───────────────────────────────────────────────────────
// Elegir una paleta en vez de describirla por escrito. Nació de ver que los
// usuarios pedían 5 cosas en un párrafo y el modelo solo ejecutaba 2-3: cuanto
// más se elige y menos se escribe, más fiable es el resultado.
// "sorprendeme" deja que la IA decida; "actual" conserva los colores del
// espacio (útil cuando solo se quiere cambiar muebles o distribución).
export const PALETAS = [
  { slug: "sorprendeme", hexes: [] as string[] },
  { slug: "actual", hexes: [] as string[] },
  { slug: "neutros", hexes: ["#ffffff", "#e7e2da", "#c3b5a1", "#1c1a17"] },
  { slug: "calidos", hexes: ["#e8c4a0", "#c8814b", "#a85a4a", "#2e2420"] },
  { slug: "azules", hexes: ["#d9d3c7", "#a9b4c0", "#6f7f92", "#2f5070"] },
  { slug: "verdes", hexes: ["#e6e4d5", "#b6c2a5", "#7d9471", "#37452f"] },
  { slug: "tierra", hexes: ["#e5d3bd", "#b98b62", "#7d5b46", "#3b2f2a"] },
  { slug: "pastel", hexes: ["#f6e0e4", "#e9dff2", "#d8e8ef", "#f3ead6"] },
  { slug: "monocromo", hexes: ["#ffffff", "#b9b9b9", "#5e5e5e", "#141414"] },
];

export function paletaSelector(inicialSlug = "sorprendeme") {
  let sel = inicialSlug;
  let cards: HTMLElement[] = [];

  const row = el("div", { class: "paleta-row" });

  function actualizar() {
    cards.forEach((c) => c.classList.toggle("sel", c.dataset.slug === sel));
  }

  cards = PALETAS.map(({ slug, hexes }) => {
    const muestras = hexes.length
      ? el("div", { class: "paleta-puntos" },
          hexes.map((h) => el("span", { class: "paleta-punto", style: `background:${h}` })))
      : el("div", { class: "paleta-puntos ico" },
          [slug === "sorprendeme" ? "🎲" : "🎨"]);
    const card = el("button", {
      class: "paleta-card", "data-slug": slug,
      onClick: () => { sel = slug; actualizar(); },
    }, [muestras, el("span", { class: "paleta-nom" }, [t(`paleta.${slug}`)])]) as HTMLElement;
    return card;
  });
  row.append(...cards);
  actualizar();

  return {
    node: el("div", { class: "ctrl-wrap" }, [
      el("div", { class: "ctrl-label" }, [t("ctrl.paleta_label")]),
      row,
    ]),
    getSlug: () => sel,
    /** Frase para el prompt; vacía cuando el usuario no impone colores. */
    getValue: () => (sel === "sorprendeme" || sel === "actual")
      ? "" : t(`paleta.${sel}`),
  };
}
