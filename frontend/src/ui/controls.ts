// Controles reutilizables de UI. Cada uno devuelve { node, getValue }.
import { el } from "../ui";

// ─── Carrusel de estilos (con foto de preview de cada estilo) ──────────────
const ESTILOS = [
  { slug: "moderno", nombre: "Moderno" },
  { slug: "minimalista", nombre: "Minimalista" },
  { slug: "escandinavo", nombre: "Escandinavo" },
  { slug: "industrial", nombre: "Industrial" },
  { slug: "contemporaneo", nombre: "Contemporáneo" },
  { slug: "rustico", nombre: "Rústico" },
  { slug: "clasico", nombre: "Clásico" },
  { slug: "tradicional", nombre: "Tradicional" },
];

export function estiloCarrusel(inicial = "Moderno") {
  let sel = inicial;
  let cards: HTMLElement[] = [];

  const row = el("div", { class: "estilo-row" });

  function actualizar() {
    cards.forEach((c) => c.classList.toggle("sel", c.dataset.val === sel));
  }

  cards = ESTILOS.map((e) => {
    const card = el("button", {
      class: "estilo-card",
      "data-val": e.nombre,
      onClick: () => { sel = e.nombre; actualizar(); },
    }, [
      el("img", { class: "estilo-card-img", src: `/estilos/${e.slug}.webp`, loading: "lazy", alt: e.nombre }),
      el("span", { class: "estilo-card-nombre" }, [e.nombre]),
      el("span", { class: "estilo-card-check" }, ["✓"]),
    ]);
    row.append(card);
    return card;
  });

  actualizar();
  return {
    node: el("div", { class: "ctrl-wrap" }, [
      el("div", { class: "ctrl-label" }, ["Estilo"]),
      row,
    ]),
    getValue: () => sel,
  };
}

// ─── Selector de color ─────────────────────────────────────────────────────
const COLORES = [
  { nombre: "Blanco", hex: "#f5f5f0" },
  { nombre: "Crema", hex: "#f2e8d5" },
  { nombre: "Gris claro", hex: "#d0ceca" },
  { nombre: "Gris oscuro", hex: "#5a5a5a" },
  { nombre: "Negro", hex: "#1a1a1a" },
  { nombre: "Beige", hex: "#c8b89a" },
  { nombre: "Terracota", hex: "#c1522a" },
  { nombre: "Ladrillo", hex: "#8b2500" },
  { nombre: "Verde salvia", hex: "#6b8f71" },
  { nombre: "Verde oscuro", hex: "#2e5930" },
  { nombre: "Azul pizarra", hex: "#5b7a99" },
  { nombre: "Azul marino", hex: "#1a2e4a" },
  { nombre: "Amarillo ocre", hex: "#c8a23a" },
  { nombre: "Mostaza", hex: "#b5860d" },
  { nombre: "Coral", hex: "#d95f4b" },
  { nombre: "Lavanda", hex: "#9b8ec4" },
];

export function colorSelector(inicial = "Blanco") {
  let sel = inicial;
  const preview = el("span", { class: "color-swatch-preview" }) as HTMLElement;
  const label = el("span", {}, [sel]);

  function actualizarPreview() {
    const c = COLORES.find((x) => x.nombre === sel);
    preview.style.background = c?.hex ?? "#fff";
    label.textContent = sel;
  }
  actualizarPreview();

  const btn = el("button", {
    class: "color-btn",
    onClick: abrirModal,
  }, [preview, label, el("span", { class: "dropdown-arrow" }, ["▼"])]);

  function abrirModal() {
    const overlay = el("div", { class: "color-modal-overlay", onClick: cerrar });
    const modal = el("div", { class: "color-modal", onClick: (e: Event) => e.stopPropagation() }, [
      el("div", { class: "color-modal-tit" }, ["Elige un color"]),
      el("div", { class: "color-grid" }, COLORES.map((c) =>
        el("div", { class: "color-item", onClick: () => { sel = c.nombre; actualizarPreview(); cerrar(); } }, [
          el("div", {
            class: "color-swatch" + (sel === c.nombre ? " sel" : ""),
            style: `background: ${c.hex}`,
          }),
          el("div", { class: "color-name" }, [c.nombre]),
        ])
      )),
    ]);
    overlay.append(modal);
    document.body.append(overlay);
    function cerrar() { overlay.remove(); }
  }

  return {
    node: el("div", { class: "ctrl-wrap" }, [
      el("div", { class: "ctrl-label" }, ["Color"]),
      btn,
    ]),
    getValue: () => sel,
  };
}

// ─── Selector de superficie ────────────────────────────────────────────────
const SUPERFICIES = [
  { ico: "🧱", nombre: "Pared" },
  { ico: "🚪", nombre: "Puerta" },
  { ico: "🪵", nombre: "Piso" },
  { ico: "🏠", nombre: "Gabinete" },
  { ico: "🌿", nombre: "Exterior" },
];

export function superficieSelector(inicial = "Pared") {
  let sel = inicial;
  let items: HTMLElement[] = [];

  const list = el("div", { class: "radio-list" });

  function actualizar() {
    items.forEach((i) => i.classList.toggle("sel", i.dataset.val === sel));
  }

  items = SUPERFICIES.map((s) => {
    const item = el("div", {
      class: "radio-item",
      "data-val": s.nombre,
      onClick: () => { sel = s.nombre; actualizar(); },
    }, [
      el("span", { class: "radio-dot" }),
      el("span", { class: "radio-ico" }, [s.ico]),
      el("span", { class: "radio-txt" }, [s.nombre]),
    ]);
    list.append(item);
    return item;
  });

  actualizar();
  return {
    node: el("div", { class: "ctrl-wrap" }, [
      el("div", { class: "ctrl-label" }, ["Superficie"]),
      list,
    ]),
    getValue: () => sel,
  };
}

// ─── Dropdown genérico (bottom-sheet) ─────────────────────────────────────
export function dropdown(titulo: string, opciones: string[], inicial: string) {
  let sel = inicial;
  const labelEl = el("span", {}, [sel]);

  function actualizar(v: string) { sel = v; labelEl.textContent = v; }

  const btn = el("button", {
    class: "dropdown-btn",
    onClick: abrirSheet,
  }, [labelEl, el("span", { class: "dropdown-arrow" }, ["▼"])]);

  function abrirSheet() {
    const overlay = el("div", { class: "sheet-overlay", onClick: cerrar });
    const sheet = el("div", { class: "sheet", onClick: (e: Event) => e.stopPropagation() }, [
      el("div", { class: "sheet-tit" }, [titulo]),
      ...opciones.map((o) =>
        el("div", {
          class: "sheet-opt" + (sel === o ? " sel" : ""),
          onClick: () => { actualizar(o); cerrar(); },
        }, [
          el("span", {}, [o]),
          ...(sel === o ? [el("span", { class: "sheet-check" }, ["✓"])] : []),
        ])
      ),
    ]);
    overlay.append(sheet);
    document.body.append(overlay);
    function cerrar() { overlay.remove(); }
  }

  return {
    node: el("div", { class: "ctrl-wrap" }, [
      el("div", { class: "ctrl-label" }, [titulo]),
      btn,
    ]),
    getValue: () => sel,
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
  function syncClipImgWidth() {
    imgAntes.style.width = wrap.offsetWidth + "px";
  }
  imgDespues.addEventListener("load", syncClipImgWidth);
  window.addEventListener("resize", syncClipImgWidth);
  setTimeout(syncClipImgWidth, 0);

  let dragging = false;

  function setPos(pct: number) {
    const clamped = Math.max(2, Math.min(98, pct));
    clip.style.width = `${clamped}%`;
    divider.style.left = `${clamped}%`;
  }

  function fromEvent(e: MouseEvent | TouchEvent): number {
    const rect = wrap.getBoundingClientRect();
    const clientX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
    return ((clientX - rect.left) / rect.width) * 100;
  }

  wrap.addEventListener("mousedown", (e) => { dragging = true; setPos(fromEvent(e)); });
  wrap.addEventListener("touchstart", (e) => { dragging = true; setPos(fromEvent(e)); }, { passive: true });
  window.addEventListener("mousemove", (e) => { if (dragging) setPos(fromEvent(e)); });
  window.addEventListener("touchmove", (e) => { if (dragging) setPos(fromEvent(e as TouchEvent)); }, { passive: true });
  window.addEventListener("mouseup", () => { dragging = false; });
  window.addEventListener("touchend", () => { dragging = false; });

  return wrap;
}
