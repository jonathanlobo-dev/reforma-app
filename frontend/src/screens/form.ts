import { el, render, toast } from "../ui";
import { state } from "../state";
import { elegirFoto } from "../foto";
import { irA, atras, setNavVisible } from "../nav";
import { pantallaProcessing } from "./processing";
import { pantallaMask } from "./mask";
import { estiloCarrusel, colorSelector, superficieSelector, dropdown } from "../ui/controls";

const HABITACIONES = ["Sala de estar", "Cocina", "Dormitorio", "Baño", "Comedor", "Exterior"];
const INTENSIDADES = ["Sutil", "Media", "Fuerte"];
const MATERIALES_SUELO = ["Porcelanato blanco", "Madera clara", "Madera oscura", "Mármol", "Cemento", "Cerámica"];
const ACABADOS_PARED = ["Pintura lisa", "Ladrillo visto", "Piedra natural", "Madera", "Estuco", "Panel decorativo"];

const MUESTRAS = ["/mock/antes.jpg", "/mock/despues.png"];

const HINTS: Record<string, string> = {
  pincel: "Elige tu foto y luego pinta con el dedo la zona exacta a cambiar.",
  estilo: "Sube tu espacio y una foto de inspiración: copiamos su estilo a tu foto.",
  plano: "Sube la foto de un plano 2D y lo convertimos en un render 3D amueblado.",
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
  const refrescarFoto = () => {
    fotoZone.innerHTML = "";
    if (state.foto) {
      fotoZone.append(el("img", { src: state.foto.url }));
      fotoZone.append(el("div", { class: "foto-overlay" }, ["Cambiar foto"]));
      if (engine === "inpaint" && state.mask) {
        fotoZone.append(el("div", { class: "mask-badge" }, ["✓ Zona pintada"]));
      }
    } else {
      fotoZone.append(
        el("div", { class: "foto-placeholder" }, [
          el("span", {}, [engine === "plano" ? "📐" : "📷"]),
          el("span", {}, [engine === "plano" ? "Toca para subir tu plano" : "Toca para elegir una foto"]),
        ])
      );
    }
  };

  async function elegirYActualizar(e?: Event) {
    e?.stopPropagation();
    const f = await elegirFoto();
    if (f) {
      state.foto = f; state.mask = undefined; selMuestra = -1;
      refrescarFoto(); refrescarMuestras();
      if (engine === "inpaint") abrirPincel();
    }
  }

  function abrirPincel() {
    if (!state.foto) { toast("Primero elige una foto."); return; }
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
        state.foto = { blob, url: URL.createObjectURL(blob) };
        state.mask = undefined;
        refrescarFoto();
        if (engine === "inpaint") abrirPincel();
      } catch { toast("No se pudo cargar la muestra."); }
    });
    return img;
  });
  const refrescarMuestras = () =>
    muestraThumbs.forEach((t, i) => t.classList.toggle("selec", i === selMuestra));

  const muestrasWrap = engine === "plano"
    ? el("span", {})
    : el("div", { class: "muestras-wrap" }, [
        el("div", { class: "muestras-label" }, ["O prueba con una muestra"]),
        el("div", { class: "muestras-row" }, muestraThumbs),
      ]);

  // ── Referencia (engine estilo) ────────────────────────────────────────────
  const refZone = el("div", { class: "foto-zone ref", onClick: elegirRef });
  const refrescarRef = () => {
    refZone.innerHTML = "";
    if (state.referencia) {
      refZone.append(el("img", { src: state.referencia.url }));
      refZone.append(el("div", { class: "foto-overlay" }, ["Cambiar referencia"]));
    } else {
      refZone.append(
        el("div", { class: "foto-placeholder" }, [
          el("span", {}, ["🖼️"]),
          el("span", {}, ["Foto de inspiración (el estilo que quieres)"]),
        ])
      );
    }
  };
  async function elegirRef(e?: Event) {
    e?.stopPropagation();
    const f = await elegirFoto();
    if (f) { state.referencia = f; refrescarRef(); }
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
        }, ["Imagen · gratis"]),
        el("button", {
          class: "toggle-op" + (tipo === "video" ? " activo" : ""),
          onClick(e: Event) { tipo = "video"; marcar(e); },
        }, ["Video · premium 🔒"]),
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
    placeholder: "Proyecto (opcional) — ej. Casa de mamá",
  }) as HTMLInputElement;
  const proyDatalist = el("datalist", { id: "proyectos-list" },
    proyectosPrevios.map((p) => el("option", { value: p })));
  const proyNode = el("div", { class: "ctrl-wrap" }, [
    el("div", { class: "ctrl-label" }, ["📁 Proyecto"]),
    proyInput, proyDatalist,
  ]);
  function guardarProyecto(nombre: string) {
    if (!nombre) return;
    const lista = [nombre, ...proyectosPrevios.filter((p) => p !== nombre)].slice(0, 10);
    localStorage.setItem(PROY_KEY, JSON.stringify(lista));
  }

  // ── Enviar ────────────────────────────────────────────────────────────────
  const enviar = () => {
    if (!state.foto) { toast(engine === "plano" ? "Sube la foto de tu plano." : "Elige una foto primero."); return; }
    if (engine === "inpaint" && !state.mask) { toast("Pinta la zona a cambiar."); abrirPincel(); return; }
    if (engine === "estilo" && !state.referencia) { toast("Falta la foto de inspiración."); return; }
    const detalle = controles.getDetalle();
    if (engine !== "estilo" && engine !== "plano" && !detalle.trim()) {
      toast("Completa al menos un campo."); return;
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
      el("span", { class: "topbar-tit" }, [`${cat.emoji} ${cat.titulo}`]),
    ]),
  ];
  if (HINTS[claveCat]) hijos.push(el("p", { class: "form-hint" }, [HINTS[claveCat]]));
  hijos.push(fotoZone);
  if (engine === "inpaint") {
    hijos.push(el("button", { class: "btn-secundario", onClick: abrirPincel }, [
      state.mask ? "Editar zona pintada" : "🖌️ Pintar la zona a cambiar",
    ]));
  }
  if (engine === "estilo") hijos.push(refZone);
  hijos.push(muestrasWrap, controles.node, proyNode, toggleNode,
    el("button", { class: "btn-primario", onClick: enviar }, ["Transformar ✨"]));

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
    placeholder: "Algo más que quieras cambiar… (opcional)",
  }) as HTMLTextAreaElement;
  return {
    node: ta,
    getValue: () => {
      const v = ta.value.trim();
      return v ? ` Además, el usuario pide: ${v}.` : "";
    },
  };
}

// ── Controles específicos por categoría ─────────────────────────────────────
function buildControles(clave: string, engine: string): { node: HTMLElement; getDetalle: () => string } {
  switch (clave) {
    case "pintar": {
      const surf = superficieSelector("Pared");
      const color = colorSelector("Blanco");
      const intens = dropdown("Intensidad", INTENSIDADES, "Media");
      const extra = campoExtra();
      return {
        node: el("div", { class: "ctrl-stack" }, [surf.node, color.node, intens.node, extra.node]),
        getDetalle: () => `Superficie: ${surf.getValue()}. Color: ${color.getValue()}. Intensidad: ${intens.getValue()}.${extra.getValue()}`,
      };
    }
    case "interior":
    case "remodelar": {
      const estilo = estiloCarrusel("Moderno");
      const hab = dropdown("Habitación", HABITACIONES, "Sala de estar");
      const intens = dropdown("Intensidad", INTENSIDADES, "Media");
      const extra = campoExtra();
      return {
        node: el("div", { class: "ctrl-stack" }, [estilo.node, hab.node, intens.node, extra.node]),
        getDetalle: () => `Estilo: ${estilo.getValue()}. Habitación: ${hab.getValue()}. Intensidad: ${intens.getValue()}.${extra.getValue()}`,
      };
    }
    case "exterior": {
      const estilo = estiloCarrusel("Contemporáneo");
      const intens = dropdown("Intensidad", INTENSIDADES, "Media");
      const extra = campoExtra();
      return {
        node: el("div", { class: "ctrl-stack" }, [estilo.node, intens.node, extra.node]),
        getDetalle: () => `Estilo: ${estilo.getValue()}. Intensidad: ${intens.getValue()}.${extra.getValue()}`,
      };
    }
    case "suelo": {
      const mat = dropdown("Material", MATERIALES_SUELO, "Porcelanato blanco");
      const extra = campoExtra();
      return {
        node: el("div", { class: "ctrl-stack" }, [mat.node, extra.node]),
        getDetalle: () => `Material de suelo: ${mat.getValue()}.${extra.getValue()}`,
      };
    }
    case "paredes": {
      const acab = dropdown("Acabado", ACABADOS_PARED, "Pintura lisa");
      const extra = campoExtra();
      return {
        node: el("div", { class: "ctrl-stack" }, [acab.node, extra.node]),
        getDetalle: () => `Acabado de pared: ${acab.getValue()}.${extra.getValue()}`,
      };
    }
    default: {
      const campos = (state.categorias[clave]?.campos ?? []) as Array<{ label: string; ejemplo: string }>;
      if (!campos.length) {
        // estilo / plano: sin texto
        if (engine === "estilo" || engine === "plano") {
          return { node: el("span", {}), getDetalle: () => "" };
        }
        const ta = el("textarea", { class: "field", placeholder: "¿Qué quieres cambiar?", rows: 3 }) as HTMLTextAreaElement;
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
