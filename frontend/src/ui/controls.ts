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

export function estiloCarrusel(inicialSlug = "moderno") {
  let sel = inicialSlug;
  let cards: HTMLElement[] = [];

  const row = el("div", { class: "estilo-row" });

  function actualizar() {
    cards.forEach((c) => c.classList.toggle("sel", c.dataset.val === sel));
  }

  cards = ESTILOS.map((slug) => {
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
  });

  actualizar();
  return {
    node: el("div", { class: "ctrl-wrap" }, [
      el("div", { class: "ctrl-label" }, [t("ctrl.estilo_label")]),
      row,
    ]),
    getValue: () => t(`estilo.${sel}`),
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

// ─── Slider antes/después ──────────────────────────────────────────────────
export function baSlider(urlAntes: string, urlDespues: string): HTMLElement {
  const wrap = el("div", { class: "ba-slider" }) as HTMLElement;

  // Fondo = después; clip (izquierda) = antes → convencion: izq=antes, der=después
  const imgDespues = el("img", { src: urlDespues, draggable: false }) as HTMLImageElement;
  const clip = el("div", { class: "ba-clip", style: "width: 50%" }) as HTMLElement;
  const imgAntes = el("img", { src: urlAntes, draggable: false }) as HTMLImageElement;
  const divider = el("div", { class: "ba-divider", style: "left: 50%" }) as HTMLElement;
  const handle = el("div", { class: "ba-handle" }, ["◁▷"]);

  clip.append(imgAntes);
  divider.append(handle);
  wrap.append(imgDespues, clip, divider);

  // La imagen dentro del clip debe tener el ancho del wrapper, no del clip.
  // ResizeObserver observa al propio wrap: muere con el nodo (sin fugas).
  function syncClipImgWidth() {
    imgAntes.style.width = wrap.offsetWidth + "px";
  }
  imgDespues.addEventListener("load", syncClipImgWidth);
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
