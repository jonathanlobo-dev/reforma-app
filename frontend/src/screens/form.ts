import { el, render, toast } from "../ui";
import { state, setFoto, setReferencia } from "../state";
import { elegirFoto } from "../foto";
import { irA, atras, setNavVisible } from "../nav";
import { pantallaProcessing } from "./processing";
import { pantallaMask } from "./mask";
import { estiloCarrusel, colorSelector, superficieSelector, dropdown, paletaSelector, chipsSelector, type OpcionDropdown } from "../ui/controls";
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
  // Espacios comerciales: un local vacío que se convierte en tienda/bodegón es
  // un caso de uso real, y sin esta opción el desplegable obligaba a decir
  // "sala de estar", que contradecía la petición.
  { slug: "local", labelKey: "habitacion.local" },
  { slug: "oficina", labelKey: "habitacion.oficina" },
];
const INTENSIDADES: OpcionDropdown[] = [
  { slug: "sutil", labelKey: "intensidad.sutil" },
  { slug: "media", labelKey: "intensidad.media" },
  { slug: "fuerte", labelKey: "intensidad.fuerte" },
];
// "Intensidad" era abstracta (¿qué es media?). El modo dice lo que de verdad
// decide el usuario: si la IA respeta la distribución actual o puede rehacerla.
const MODOS: OpcionDropdown[] = [
  { slug: "respetar", labelKey: "modo.respetar" },
  { slug: "libertad", labelKey: "modo.libertad" },
];
const MATERIALES_SUELO: OpcionDropdown[] = [
  { slug: "porcelanato_blanco", labelKey: "suelo_mat.porcelanato_blanco" },
  { slug: "madera_clara", labelKey: "suelo_mat.madera_clara" },
  { slug: "madera_oscura", labelKey: "suelo_mat.madera_oscura" },
  { slug: "marmol", labelKey: "suelo_mat.marmol" },
  { slug: "cemento", labelKey: "suelo_mat.cemento" },
  { slug: "ceramica", labelKey: "suelo_mat.ceramica" },
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
      state.cadena = []; state.origenId = undefined; // foto nueva = cadena nueva
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
        state.cadena = []; state.origenId = undefined; // muestra = foto nueva, cadena nueva
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
  // El motor "estilo" no tiene controles de texto: su única decisión es la
  // foto de referencia, así que se agrega como paso propio del asistente en
  // vez de dejarla fija encima de todos los pasos.
  if (engine === "estilo") {
    controles.pasos = [{ tituloKey: "paso.referencia", node: refZone }];
  }

  // ── Toggle imagen/video (solo engines que animan) ─────────────────────────
  // El flag remoto (fase test) puede apagar el video para todos; el backend
  // igual lo rechaza server-side (config.VIDEO_ON) por si acaso.
  const permiteVideo = state.config.video && (engine === "editar" || engine === "inpaint");
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
    const categoria = controles.getCategoria ? controles.getCategoria() : claveCat;
    irA(() => pantallaProcessing({
      categoria, detalle, tipo, foto: state.foto!.blob,
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
  // Si "estilo" quedó sin pasos por alguna razón (no debería), refZone igual
  // debe estar visible en algún lado: fallback al render plano.
  if (engine === "estilo" && !(controles.pasos && controles.pasos.length)) hijos.push(refZone);

  const botonGenerar = el("button", { class: "btn-primario btn-ico", onClick: enviar },
    [icon("sparkles", 18), t("form.transformar")]);

  if (controles.pasos && controles.pasos.length >= 1) {
    // ── Asistente por pasos ──────────────────────────────────────────────
    // La foto es el paso 1 y los controles vienen después, uno por pantalla:
    // así cada decisión se toma sola y el usuario no se enfrenta a un muro de
    // opciones ni escribe cinco peticiones de golpe.
    const pasos = controles.pasos;
    const total = pasos.length + 1;          // +1 = la foto
    let paso = 0;                            // 0 = foto
    const etiqueta = el("span", { class: "paso-chip" });
    const barras = el("div", { class: "paso-barras" },
      Array.from({ length: total }, () => el("i")));
    const titulo = el("h2", { class: "paso-titulo" });
    const cuerpo = el("div", { class: "paso-cuerpo" });
    const btnAtras = el("button", { class: "btn-secundario", onClick: () => ir(paso - 1) },
      [t("form.paso.atras")]);
    const btnSig = el("button", { class: "btn-primario", onClick: () => ir(paso + 1) },
      [t("form.paso.siguiente")]);
    const pie = el("div", { class: "paso-pie" }, [btnAtras, btnSig]);

    function ir(n: number) {
      if (n < 0) { atras(); return; }
      // Para avanzar del paso de la foto hace falta tener foto.
      if (paso === 0 && n > 0 && !state.foto) {
        toast(t(engine === "plano" ? "toast.sube_plano" : "toast.elige_foto"));
        return;
      }
      paso = Math.min(n, total - 1);
      pintar();
    }

    function pintar() {
      etiqueta.textContent = t("form.paso.n", { n: paso + 1, total });
      barras.querySelectorAll("i").forEach((b, i) => b.classList.toggle("ok", i <= paso));
      cuerpo.replaceChildren();
      if (paso === 0) {
        titulo.textContent = t("form.paso.foto");
        cuerpo.append(fotoZone, muestrasWrap);
      } else {
        const p = pasos[paso - 1];
        titulo.textContent = t(p.tituloKey);
        cuerpo.append(p.node);
        // El último paso lleva además proyecto, imagen/video y el botón final.
        if (paso === total - 1) cuerpo.append(proyNode, toggleNode);
      }
      pie.replaceChildren(btnAtras, paso === total - 1 ? botonGenerar : btnSig);
    }

    hijos.push(el("div", { class: "paso-cab" }, [etiqueta, barras]), titulo, cuerpo, pie);
    render(el("div", { class: "screen" }, hijos));
    pintar();
  } else {
    hijos.push(muestrasWrap, controles.node, proyNode, toggleNode, botonGenerar);
    render(el("div", { class: "screen" }, hijos));
  }
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
interface Controles {
  node: HTMLElement;
  getDetalle: () => string;
  // Opcional: permite que un modo del formulario envíe otra categoría (ej.
  // "Eliminar" con el toggle "vaciar todo" envía categoria="vaciar").
  getCategoria?: () => string;
  // Opcional: divide los controles en pasos (asistente 1/4, 2/4…). Las
  // categorías con varias decisiones se guían así para que el usuario elija
  // en vez de escribir un párrafo con cinco peticiones a la vez.
  pasos?: { tituloKey: string; node: HTMLElement }[];
}

function buildControles(clave: string, engine: string): Controles {
  switch (clave) {
    case "pintar": {
      const surf = superficieSelector("pared");
      const color = colorSelector("blanco");
      const intens = dropdown("ctrl.intensidad_label", INTENSIDADES, "media");
      const extra = campoExtra();
      return {
        pasos: [
          { tituloKey: "paso.superficie", node: surf.node },
          { tituloKey: "paso.color", node: color.node },
          { tituloKey: "paso.intensidad", node: el("div", { class: "ctrl-stack" }, [intens.node, extra.node]) },
        ],
        node: el("span", {}),
        getDetalle: () => `${t("ctrl.superficie_label")}: ${surf.getValue()}. ${t("ctrl.color_label")}: ${color.getValue()}. ${t("ctrl.intensidad_label")}: ${intens.getValue()}.${extra.getValue()}`,
      };
    }
    case "interior": {
      // Espacio y modo: chips de toque directo en vez de bottom-sheet (más
      // intuitivo con solo 8 y 2 opciones respectivamente — no hace falta
      // esconderlas en una hoja).
      const hab = chipsSelector("ctrl.habitacion_label", HABITACIONES, "sala");
      const estilo = estiloCarrusel("moderno");
      const paleta = paletaSelector("sorprendeme");
      const modo = chipsSelector("ctrl.modo_label", MODOS, "respetar");
      const extra = campoExtra();
      // "ninguno"/"personalizado": no se impone ningún estilo del catálogo —
      // manda solo lo que el usuario escribió en el campo de texto.
      const fraseEstilo = () =>
        ["ninguno", "personalizado"].includes(estilo.getSlug())
          ? "" : `${t("ctrl.estilo_label")}: ${estilo.getValue()}. `;
      const frasePaleta = () => {
        const v = paleta.getValue();
        if (paleta.getSlug() === "actual") return `${t("ctrl.paleta_label")}: ${t("paleta.frase_actual")}. `;
        return v ? `${t("ctrl.paleta_label")}: ${v}. ` : "";
      };
      return {
        pasos: [
          { tituloKey: "paso.espacio", node: hab.node },
          { tituloKey: "paso.estilo", node: estilo.node },
          { tituloKey: "paso.paleta", node: paleta.node },
          { tituloKey: "paso.modo", node: el("div", { class: "ctrl-stack" }, [modo.node, extra.node]) },
        ],
        // El asistente de esta categoría siempre tiene pasos, así que este
        // `node` plano nunca se pinta — pero debe existir para el tipo, y NO
        // puede reusar los mismos elementos de arriba (un nodo del DOM solo
        // tiene un padre: reusarlos aquí los saca de su paso).
        node: el("span", {}),
        getDetalle: () => `${fraseEstilo()}${t("ctrl.habitacion_label")}: ${hab.getValue()}. ${frasePaleta()}${t("ctrl.modo_label")}: ${modo.getValue()}.${extra.getValue()}`,
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
        pasos: [
          { tituloKey: "paso.estilo", node: estilo.node },
          { tituloKey: "paso.intensidad", node: el("div", { class: "ctrl-stack" }, [intens.node, extra.node]) },
        ],
        node: el("span", {}),
        getDetalle: () => `${fraseEstilo()}${t("ctrl.intensidad_label")}: ${intens.getValue()}.${extra.getValue()}`,
      };
    }
    case "suelo": {
      const mat = dropdown("ctrl.material_label", MATERIALES_SUELO, "porcelanato_blanco");
      const extra = campoExtra();
      return {
        pasos: [
          { tituloKey: "paso.material", node: el("div", { class: "ctrl-stack" }, [mat.node, extra.node]) },
        ],
        node: el("span", {}),
        getDetalle: () => `${t("form.campo.material_suelo")}: ${mat.getValue()}.${extra.getValue()}`,
      };
    }
    case "eliminar": {
      // Dos modos: quitar un objeto puntual (categoria=eliminar) o vaciar todo
      // el espacio (categoria=vaciar, motor distinto). Un toggle los alterna.
      let modo: "objeto" | "todo" = "objeto";
      const obj = el("input", { class: "field", type: "text",
        placeholder: t("elim.ejemplo") }) as HTMLInputElement;
      const campoObj = el("div", {}, [obj]);
      const botones: HTMLButtonElement[] = [];
      const setModo = (m: "objeto" | "todo") => {
        modo = m;
        botones.forEach((b) => b.classList.toggle("activo", b.dataset.modo === m));
        campoObj.style.display = m === "objeto" ? "" : "none";
      };
      const toggle = el("div", { class: "toggle" },
        (["objeto", "todo"] as const).map((m) => {
          const b = el("button", { class: "toggle-op", "data-modo": m,
            onClick: () => setModo(m) }, [t(m === "objeto" ? "elim.modo_objeto" : "elim.modo_todo")]) as HTMLButtonElement;
          botones.push(b);
          return b;
        }));
      setModo("objeto");
      return {
        pasos: [
          { tituloKey: "paso.eliminar", node: el("div", { class: "ctrl-stack" }, [toggle, campoObj]) },
        ],
        node: el("span", {}),
        // En modo "todo" el motor vaciar usa un prompt fijo e ignora el detalle,
        // pero mandamos un texto no vacío para pasar la validación del form.
        getDetalle: () => modo === "todo" ? "vaciar todo el espacio" : obj.value.trim(),
        getCategoria: () => modo === "todo" ? "vaciar" : "eliminar",
      };
    }
    case "plano": {
      // El plano no tiene foto de referencia ni texto libre: la única
      // decisión de valor es cómo se ve el render 3D (vacío/amueblado y en
      // qué estilo). Se manda como `detalle` porque el motor plano hoy no
      // usa ningún otro campo.
      const RENDER_MODOS: OpcionDropdown[] = [
        { slug: "vacio", labelKey: "render.vacio" },
        { slug: "amueblado", labelKey: "render.amueblado" },
      ];
      const RENDER_ESTILOS: OpcionDropdown[] = [
        { slug: "moderno", labelKey: "estilo.moderno" },
        { slug: "rustico", labelKey: "estilo.rustico" },
        { slug: "minimalista", labelKey: "estilo.minimalista" },
      ];
      const modo = chipsSelector("render.modo_label", RENDER_MODOS, "amueblado");
      const estiloRender = chipsSelector("ctrl.estilo_label", RENDER_ESTILOS, "moderno");
      return {
        pasos: [
          { tituloKey: "paso.render", node: el("div", { class: "ctrl-stack" }, [modo.node, estiloRender.node]) },
        ],
        node: el("span", {}),
        // Slugs estables (no texto traducido): el motor plano del backend los
        // parsea para armar el prompt del render, igual en cualquier idioma.
        getDetalle: () => `render_modo:${modo.getSlug()} render_estilo:${estiloRender.getSlug()}`,
      };
    }
    default: {
      const campos = (state.categorias[clave]?.campos ?? []) as Array<{ label: string; ejemplo: string }>;
      if (!campos.length) {
        // estilo: sin texto (la referencia se maneja aparte, en pantallaForm)
        if (engine === "estilo") {
          return { node: el("span", {}), getDetalle: () => "" };
        }
        // pincel (inpaint): se deja plano a propósito, ver pantallaForm.
        const ta = el("textarea", { class: "field", placeholder: t("form.generico.placeholder"), rows: 3 }) as HTMLTextAreaElement;
        if (engine === "inpaint") {
          return { node: ta, getDetalle: () => ta.value.trim() };
        }
        return {
          pasos: [{ tituloKey: "paso.detalle", node: ta }],
          node: el("span", {}),
          getDetalle: () => ta.value.trim(),
        };
      }
      const inputs = campos.map((c) =>
        el("input", { class: "field", placeholder: c.ejemplo, type: "text" }) as HTMLInputElement
      );
      return {
        pasos: [{ tituloKey: "paso.detalle", node: el("div", { class: "ctrl-stack" }, inputs) }],
        node: el("span", {}),
        getDetalle: () =>
          campos.map((c, i) => ({ label: c.label, val: inputs[i].value.trim() }))
            .filter((p) => p.val).map((p) => `${p.label}: ${p.val}.`).join(" "),
      };
    }
  }
}
