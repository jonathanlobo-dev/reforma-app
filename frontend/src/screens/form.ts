import { el, render, toast } from "../ui";
import { state, setFoto, setReferencia } from "../state";
import { elegirFoto } from "../foto";
import { irA, atras, setNavVisible } from "../nav";
import { pantallaProcessing } from "./processing";
import { pantallaMask } from "./mask";
import { estiloCarrusel, colorSelector, superficieSelector, dropdown, type OpcionDropdown } from "../ui/controls";
import { icon } from "../ui/icons";
import { abrirConsejos, consejosVistos } from "../ui/consejos";
import { t } from "../i18n";

const HABITACIONES: OpcionDropdown[] = [
  { slug: "sala", labelKey: "habitacion.sala" },
  { slug: "cocina", labelKey: "habitacion.cocina" },
  { slug: "dormitorio", labelKey: "habitacion.dormitorio" },
  { slug: "bano", labelKey: "habitacion.bano" },
  { slug: "comedor", labelKey: "habitacion.comedor" },
  { slug: "exterior", labelKey: "habitacion.exterior" },
];
const INTENSIDADES: OpcionDropdown[] = [
  { slug: "sutil", labelKey: "intensidad.sutil" },
  { slug: "media", labelKey: "intensidad.media" },
  { slug: "fuerte", labelKey: "intensidad.fuerte" },
];
const MATERIALES_SUELO: OpcionDropdown[] = [
  { slug: "porcelanato_blanco", labelKey: "suelo_mat.porcelanato_blanco" },
  { slug: "madera_clara", labelKey: "suelo_mat.madera_clara" },
  { slug: "madera_oscura", labelKey: "suelo_mat.madera_oscura" },
  { slug: "marmol", labelKey: "suelo_mat.marmol" },
  { slug: "cemento", labelKey: "suelo_mat.cemento" },
  { slug: "ceramica", labelKey: "suelo_mat.ceramica" },
];
const ACABADOS_PARED: OpcionDropdown[] = [
  { slug: "pintura_lisa", labelKey: "pared_acab.pintura_lisa" },
  { slug: "ladrillo_visto", labelKey: "pared_acab.ladrillo_visto" },
  { slug: "piedra_natural", labelKey: "pared_acab.piedra_natural" },
  { slug: "madera", labelKey: "pared_acab.madera" },
  { slug: "estuco", labelKey: "pared_acab.estuco" },
  { slug: "panel_decorativo", labelKey: "pared_acab.panel_decorativo" },
];

const MUESTRAS = ["/mock/antes.jpg", "/mock/despues.png"];

const HINT_KEYS: Record<string, string> = {
  pincel: "form.hint.pincel",
  estilo: "form.hint.estilo",
  plano: "form.hint.plano",
  vaciar: "form.hint.vaciar",
};

export function pantallaForm(claveCat: string) {
  setNavVisible(false);
  // La máscara solo se conserva al volver del pincel (misma categoría);
  // al entrar a otra categoría es de otro flujo y se descarta.
  if (state.categoriaSel !== claveCat) state.mask = undefined;
  state.categoriaSel = claveCat;
  const cat = state.categorias[claveCat];
  const engine = cat.engine ?? "editar";
  let tipo: "imagen" | "video" = cat.tipo_default;

  // ── Foto principal ────────────────────────────────────────────────────────
  const fotoZone = el("div", { class: "foto-zone", onClick: elegirYActualizar });

  // Vista previa con la máscara ENCIMA (rojo translúcido): sin esto el usuario
  // no veía qué zona había pintado al volver del pincel.
  async function previewConMascara(fotoUrl: string, mask: Blob): Promise<string> {
    const cargar = (src: string) => new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src;
    });
    const maskUrl = URL.createObjectURL(mask);
    try {
      const [foto, m] = await Promise.all([cargar(fotoUrl), cargar(maskUrl)]);
      const w = Math.min(800, foto.naturalWidth);
      const h = Math.round(w * (foto.naturalHeight / foto.naturalWidth));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(foto, 0, 0, w, h);
      // La máscara es blanco (cambiar) sobre negro OPACO → convertir la
      // luminancia en alpha para teñir de rojo solo lo pintado.
      const mc = document.createElement("canvas");
      mc.width = w; mc.height = h;
      const mctx = mc.getContext("2d")!;
      mctx.drawImage(m, 0, 0, w, h);
      const px = mctx.getImageData(0, 0, w, h);
      for (let i = 0; i < px.data.length; i += 4) {
        const lum = px.data[i];
        px.data[i] = 255; px.data[i + 1] = 59; px.data[i + 2] = 92;
        px.data[i + 3] = Math.round(lum * 0.55);
      }
      mctx.putImageData(px, 0, 0);
      ctx.drawImage(mc, 0, 0);
      return c.toDataURL("image/jpeg", 0.85);
    } finally {
      URL.revokeObjectURL(maskUrl);
    }
  }

  const refrescarFoto = () => {
    fotoZone.innerHTML = "";
    if (state.foto) {
      const img = el("img", { src: state.foto.url }) as HTMLImageElement;
      fotoZone.append(img);
      fotoZone.append(el("div", { class: "foto-overlay" }, [t("form.foto.cambiar")]));
      if (engine === "inpaint" && state.mask) {
        fotoZone.append(el("div", { class: "mask-badge" }, [t("form.foto.zona_pintada")]));
        previewConMascara(state.foto.url, state.mask)
          .then((data) => { img.src = data; })
          .catch(() => {}); // si falla, queda la foto sin overlay (no es crítico)
      }
    } else {
      fotoZone.append(
        el("div", { class: "foto-placeholder" }, [
          icon(engine === "plano" ? "layout" : "camera", 34),
          el("span", {}, [t(engine === "plano" ? "form.foto.subir_plano" : "form.foto.elegir")]),
        ])
      );
    }
  };

  async function elegirYActualizar(e?: Event) {
    e?.stopPropagation();
    const f = await elegirFoto();
    if (f) {
      setFoto(f); state.mask = undefined; selMuestra = -1;
      state.cadena = []; // foto nueva = cadena de ediciones nueva
      refrescarFoto(); refrescarMuestras();
      if (engine === "inpaint") abrirPincel();
    }
  }

  function abrirPincel() {
    if (!state.foto) { toast(t("toast.foto_primero")); return; }
    irA(() => pantallaMask(state.foto!.url, (mask) => {
      state.mask = mask;
      atras(); // volver al form con la máscara lista
      refrescarFoto();
    }));
  }

  // ── Muestras ──────────────────────────────────────────────────────────────
  let selMuestra = -1;
  const muestraThumbs = MUESTRAS.map((src, i) => {
    const img = el("img", { class: "muestra-thumb", src }) as HTMLImageElement;
    img.addEventListener("click", async () => {
      selMuestra = i; refrescarMuestras();
      try {
        const r = await fetch(src);
        const blob = await r.blob();
        setFoto({ blob, url: URL.createObjectURL(blob) });
        state.mask = undefined;
        state.cadena = []; // muestra = foto nueva, cadena nueva
        refrescarFoto();
        if (engine === "inpaint") abrirPincel();
      } catch { toast(t("toast.error_muestra")); }
    });
    return img;
  });
  const refrescarMuestras = () =>
    muestraThumbs.forEach((img, i) => img.classList.toggle("selec", i === selMuestra));

  const muestrasWrap = engine === "plano"
    ? el("span", {})
    : el("div", { class: "muestras-wrap" }, [
        el("div", { class: "muestras-label" }, [t("form.muestras.label")]),
        el("div", { class: "muestras-row" }, muestraThumbs),
      ]);

  // ── Referencia (engine estilo) ────────────────────────────────────────────
  const refZone = el("div", { class: "foto-zone ref", onClick: elegirRef });
  const refrescarRef = () => {
    refZone.innerHTML = "";
    if (state.referencia) {
      refZone.append(el("img", { src: state.referencia.url }));
      refZone.append(el("div", { class: "foto-overlay" }, [t("form.ref.cambiar")]));
    } else {
      refZone.append(
        el("div", { class: "foto-placeholder" }, [
          icon("image", 30),
          el("span", {}, [t("form.ref.placeholder")]),
        ])
      );
    }
  };
  async function elegirRef(e?: Event) {
    e?.stopPropagation();
    const f = await elegirFoto();
    if (f) { setReferencia(f); refrescarRef(); }
  }

  // ── Controles por categoría ───────────────────────────────────────────────
  const controles = buildControles(claveCat, engine);

  // ── Toggle imagen/video (solo engines que animan) ─────────────────────────
  const permiteVideo = engine === "editar" || engine === "inpaint";
  const toggleNode = permiteVideo
    ? el("div", { class: "toggle" }, [
        el("button", {
          class: "toggle-op" + (tipo === "imagen" ? " activo" : ""),
          onClick(e: Event) { tipo = "imagen"; marcar(e); },
        }, [t("form.toggle.imagen")]),
        el("button", {
          class: "toggle-op btn-ico" + (tipo === "video" ? " activo" : ""),
          onClick(e: Event) { tipo = "video"; marcar(e); },
        }, [t("form.toggle.video"), icon("lock", 13)]),
      ])
    : el("span", {});
  function marcar(e: Event) {
    toggleNode.querySelectorAll(".toggle-op").forEach((n) => n.classList.remove("activo"));
    (e.currentTarget as HTMLElement).classList.add("activo");
  }

  // ── Proyecto (opcional, para agrupar en Recientes) ────────────────────────
  const PROY_KEY = "reforma_proyectos";
  const proyectosPrevios: string[] = JSON.parse(localStorage.getItem(PROY_KEY) || "[]");
  const proyInput = el("input", {
    class: "field", type: "text", list: "proyectos-list", maxLength: 60,
    placeholder: t("form.proyecto.placeholder"),
  }) as HTMLInputElement;
  const proyDatalist = el("datalist", { id: "proyectos-list" },
    proyectosPrevios.map((p) => el("option", { value: p })));
  const proyNode = el("div", { class: "ctrl-wrap" }, [
    el("div", { class: "ctrl-label lbl-ico" }, [icon("folder", 14), t("form.proyecto.label")]),
    proyInput, proyDatalist,
  ]);
  function guardarProyecto(nombre: string) {
    if (!nombre) return;
    const lista = [nombre, ...proyectosPrevios.filter((p) => p !== nombre)].slice(0, 10);
    localStorage.setItem(PROY_KEY, JSON.stringify(lista));
  }

  // ── Enviar ────────────────────────────────────────────────────────────────
  const enviar = () => {
    if (!state.foto) { toast(t(engine === "plano" ? "toast.sube_plano" : "toast.elige_foto")); return; }
    if (engine === "inpaint" && !state.mask) { toast(t("toast.pinta_zona")); abrirPincel(); return; }
    if (engine === "estilo" && !state.referencia) { toast(t("toast.falta_referencia")); return; }
    const detalle = controles.getDetalle();
    if (engine !== "estilo" && engine !== "plano" && !detalle.trim()) {
      toast(t("toast.completa_campo")); return;
    }
    const proyecto = proyInput.value.trim();
    guardarProyecto(proyecto);
    irA(() => pantallaProcessing({
      categoria: claveCat, detalle, tipo, foto: state.foto!.blob,
      mask: state.mask, referencia: state.referencia?.blob,
      proyecto: proyecto || undefined,
    }));
  };

  const hijos: (Node | string)[] = [
    el("div", { class: "topbar" }, [
      el("button", { class: "back", onClick: atras }, ["‹"]),
      el("span", { class: "topbar-tit" }, [cat.titulo]),
    ]),
  ];
  if (HINT_KEYS[claveCat]) hijos.push(el("p", { class: "form-hint" }, [t(HINT_KEYS[claveCat])]));
  hijos.push(fotoZone);
  // Consejos de foto (no aplican al plano 2D)
  if (engine !== "plano") {
    hijos.push(el("button", { class: "btn-texto btn-ico consejos-link", onClick: () => abrirConsejos() },
      [icon("info", 15), t("form.consejos.link")]));
    if (!consejosVistos()) setTimeout(() => abrirConsejos(), 350);
  }
  if (engine === "inpaint") {
    hijos.push(el("button", { class: "btn-secundario btn-ico", onClick: abrirPincel }, [
      icon("brush", 17),
      t(state.mask ? "form.pincel.editar" : "form.pincel.pintar"),
    ]));
  }
  if (engine === "estilo") hijos.push(refZone);
  hijos.push(muestrasWrap, controles.node, proyNode, toggleNode,
    el("button", { class: "btn-primario btn-ico", onClick: enviar }, [icon("sparkles", 18), t("form.transformar")]));

  render(el("div", { class: "screen" }, hijos));
  refrescarFoto();
  refrescarRef();
}

// Campo opcional de texto libre para las categorías guiadas: permite pedidos
// extra ("cambiar la ventana por una panorámica") sin perder los selectores.
// Pasa por el mismo filtro de contenido del backend que todo lo demás.
function campoExtra() {
  const ta = el("textarea", {
    class: "field", rows: 2,
    placeholder: t("form.extra.placeholder"),
  }) as HTMLTextAreaElement;
  // Idea precargada desde el chat del Maestro ("Ver esto en mi espacio")
  if (state.prefillExtra) {
    ta.value = state.prefillExtra;
    state.prefillExtra = undefined;
  }
  return {
    node: ta,
    getValue: () => {
      const v = ta.value.trim();
      return v ? t("form.extra.prefix", { v }) : "";
    },
  };
}

// ── Controles específicos por categoría ─────────────────────────────────────
function buildControles(clave: string, engine: string): { node: HTMLElement; getDetalle: () => string } {
  switch (clave) {
    case "pintar": {
      const surf = superficieSelector("pared");
      const color = colorSelector("blanco");
      const intens = dropdown("ctrl.intensidad_label", INTENSIDADES, "media");
      const extra = campoExtra();
      return {
        node: el("div", { class: "ctrl-stack" }, [surf.node, color.node, intens.node, extra.node]),
        getDetalle: () => `${t("ctrl.superficie_label")}: ${surf.getValue()}. ${t("ctrl.color_label")}: ${color.getValue()}. ${t("ctrl.intensidad_label")}: ${intens.getValue()}.${extra.getValue()}`,
      };
    }
    case "interior":
    case "remodelar": {
      const estilo = estiloCarrusel("moderno");
      const hab = dropdown("ctrl.habitacion_label", HABITACIONES, "sala");
      const intens = dropdown("ctrl.intensidad_label", INTENSIDADES, "media");
      const extra = campoExtra();
      // "ninguno"/"personalizado": no se impone ningún estilo del catálogo —
      // manda solo lo que el usuario escribió en el campo de texto.
      const fraseEstilo = () =>
        ["ninguno", "personalizado"].includes(estilo.getSlug())
          ? "" : `${t("ctrl.estilo_label")}: ${estilo.getValue()}. `;
      return {
        node: el("div", { class: "ctrl-stack" }, [estilo.node, hab.node, intens.node, extra.node]),
        getDetalle: () => `${fraseEstilo()}${t("ctrl.habitacion_label")}: ${hab.getValue()}. ${t("ctrl.intensidad_label")}: ${intens.getValue()}.${extra.getValue()}`,
      };
    }
    case "exterior": {
      const estilo = estiloCarrusel("contemporaneo");
      const intens = dropdown("ctrl.intensidad_label", INTENSIDADES, "media");
      const extra = campoExtra();
      const fraseEstilo = () =>
        ["ninguno", "personalizado"].includes(estilo.getSlug())
          ? "" : `${t("ctrl.estilo_label")}: ${estilo.getValue()}. `;
      return {
        node: el("div", { class: "ctrl-stack" }, [estilo.node, intens.node, extra.node]),
        getDetalle: () => `${fraseEstilo()}${t("ctrl.intensidad_label")}: ${intens.getValue()}.${extra.getValue()}`,
      };
    }
    case "suelo": {
      const mat = dropdown("ctrl.material_label", MATERIALES_SUELO, "porcelanato_blanco");
      const extra = campoExtra();
      return {
        node: el("div", { class: "ctrl-stack" }, [mat.node, extra.node]),
        getDetalle: () => `${t("form.campo.material_suelo")}: ${mat.getValue()}.${extra.getValue()}`,
      };
    }
    case "paredes": {
      const acab = dropdown("ctrl.acabado_label", ACABADOS_PARED, "pintura_lisa");
      const extra = campoExtra();
      return {
        node: el("div", { class: "ctrl-stack" }, [acab.node, extra.node]),
        getDetalle: () => `${t("form.campo.acabado_pared")}: ${acab.getValue()}.${extra.getValue()}`,
      };
    }
    default: {
      const campos = (state.categorias[clave]?.campos ?? []) as Array<{ label: string; ejemplo: string }>;
      if (!campos.length) {
        // estilo / plano: sin texto
        if (engine === "estilo" || engine === "plano") {
          return { node: el("span", {}), getDetalle: () => "" };
        }
        const ta = el("textarea", { class: "field", placeholder: t("form.generico.placeholder"), rows: 3 }) as HTMLTextAreaElement;
        return { node: ta, getDetalle: () => ta.value.trim() };
      }
      const inputs = campos.map((c) =>
        el("input", { class: "field", placeholder: c.ejemplo, type: "text" }) as HTMLInputElement
      );
      return {
        node: el("div", { class: "ctrl-stack" }, inputs),
        getDetalle: () =>
          campos.map((c, i) => ({ label: c.label, val: inputs[i].value.trim() }))
            .filter((p) => p.val).map((p) => `${p.label}: ${p.val}.`).join(" "),
      };
    }
  }
}
