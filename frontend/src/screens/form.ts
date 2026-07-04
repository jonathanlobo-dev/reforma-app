import { el, render, toast } from "../ui";
import { state } from "../state";
import { elegirFoto } from "../foto";
import { irA, atras, setNavVisible } from "../nav";
import { pantallaProcessing } from "./processing";
import { estiloCarrusel, colorSelector, superficieSelector, dropdown } from "../ui/controls";

// Opciones de habitación e intensidad
const HABITACIONES = ["Sala de estar", "Cocina", "Dormitorio", "Baño", "Comedor", "Exterior"];
const INTENSIDADES = ["Sutil", "Media", "Fuerte"];
const MATERIALES_SUELO = ["Porcelanato blanco", "Madera clara", "Madera oscura", "Mármol", "Cemento", "Cerámica"];
const ACABADOS_PARED = ["Pintura lisa", "Ladrillo visto", "Piedra natural", "Madera", "Estuco", "Panel decorativo"];

// Muestras de ejemplo (usa las imágenes mock bundleadas)
const MUESTRAS = ["/mock/antes.jpg", "/mock/despues.png", "/mock/antes.jpg", "/mock/despues.png"];

export function pantallaForm(claveCat: string) {
  setNavVisible(false);
  state.categoriaSel = claveCat;
  const cat = state.categorias[claveCat];
  let tipo: "imagen" | "video" = cat.tipo_default;

  // ── Foto ────────────────────────────────────────────────────────────────
  const fotoZone = el("div", { class: "foto-zone", onClick: elegirYActualizar });
  const refrescarFoto = () => {
    fotoZone.innerHTML = "";
    if (state.foto) {
      fotoZone.append(el("img", { src: state.foto.url }));
      fotoZone.append(el("div", { class: "foto-overlay", onClick: elegirYActualizar }, ["Cambiar foto"]));
    } else {
      fotoZone.append(
        el("div", { class: "foto-placeholder" }, [
          el("span", {}, ["📷"]),
          el("span", {}, ["Toca para elegir una foto"]),
        ])
      );
    }
  };
  refrescarFoto();

  async function elegirYActualizar(e?: Event) {
    e?.stopPropagation();
    const f = await elegirFoto();
    if (f) { state.foto = f; selMuestra = -1; refrescarFoto(); refrescarMuestras(); }
  }

  // ── Muestras ─────────────────────────────────────────────────────────────
  let selMuestra = -1;
  const muestraThumbs = MUESTRAS.map((src, i) => {
    const img = el("img", { class: "muestra-thumb", src }) as HTMLImageElement;
    img.addEventListener("click", async () => {
      selMuestra = i;
      refrescarMuestras();
      // Cargar la muestra como Blob para enviarlo al backend
      try {
        const r = await fetch(src);
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        state.foto = { blob, url };
        refrescarFoto();
      } catch { toast("No se pudo cargar la muestra."); }
    });
    return img;
  });

  const refrescarMuestras = () => {
    muestraThumbs.forEach((t, i) => t.classList.toggle("selec", i === selMuestra));
  };

  const muestrasWrap = el("div", { class: "muestras-wrap" }, [
    el("div", { class: "muestras-label" }, ["O prueba con una muestra"]),
    el("div", { class: "muestras-row" }, muestraThumbs),
  ]);

  // ── Controles por categoría ───────────────────────────────────────────────
  const controles = buildControles(claveCat);

  // ── Toggle imagen/video ───────────────────────────────────────────────────
  const toggleNode = el("div", { class: "toggle" }, [
    el("button", {
      class: "toggle-op" + (tipo === "imagen" ? " activo" : ""),
      onClick(e: Event) { tipo = "imagen"; actualizarToggle(e); },
    }, ["Imagen · gratis"]),
    el("button", {
      class: "toggle-op" + (tipo === "video" ? " activo" : ""),
      onClick(e: Event) { tipo = "video"; actualizarToggle(e); },
    }, ["Video · premium 🔒"]),
  ]);
  function actualizarToggle(e: Event) {
    toggleNode.querySelectorAll(".toggle-op").forEach((n) => n.classList.remove("activo"));
    (e.currentTarget as HTMLElement).classList.add("activo");
  }

  // ── Enviar ────────────────────────────────────────────────────────────────
  const enviar = () => {
    if (!state.foto) { toast("Elige una foto o usa una muestra."); return; }
    const detalle = controles.getDetalle();
    if (!detalle.trim()) { toast("Completa al menos un campo."); return; }
    irA(() => pantallaProcessing({ categoria: claveCat, detalle, tipo, foto: state.foto!.blob }));
  };

  render(
    el("div", { class: "screen" }, [
      el("div", { class: "topbar" }, [
        el("button", { class: "back", onClick: atras }, ["‹"]),
        el("span", { class: "topbar-tit" }, [`${cat.emoji} ${cat.titulo}`]),
      ]),
      fotoZone,
      muestrasWrap,
      controles.node,
      toggleNode,
      el("button", { class: "btn-primario", onClick: enviar }, ["Transformar ✨"]),
    ])
  );
}

// ── Controles específicos por categoría ─────────────────────────────────────
function buildControles(clave: string): { node: HTMLElement; getDetalle: () => string } {
  switch (clave) {
    case "pintar": {
      const surf = superficieSelector("Pared");
      const color = colorSelector("Blanco");
      const intens = dropdown("Intensidad", INTENSIDADES, "Media");
      return {
        node: el("div", { style: "display:flex;flex-direction:column;gap:14px" }, [
          surf.node, color.node, intens.node,
        ]),
        getDetalle: () => `Superficie: ${surf.getValue()}. Color: ${color.getValue()}. Intensidad: ${intens.getValue()}.`,
      };
    }
    case "interior":
    case "remodelar": {
      const estilo = estiloCarrusel("Moderno");
      const hab = dropdown("Habitación", HABITACIONES, "Sala de estar");
      const intens = dropdown("Intensidad", INTENSIDADES, "Media");
      return {
        node: el("div", { style: "display:flex;flex-direction:column;gap:14px" }, [
          estilo.node, hab.node, intens.node,
        ]),
        getDetalle: () => `Estilo: ${estilo.getValue()}. Habitación: ${hab.getValue()}. Intensidad: ${intens.getValue()}.`,
      };
    }
    case "exterior": {
      const estilo = estiloCarrusel("Contemporáneo");
      const intens = dropdown("Intensidad", INTENSIDADES, "Media");
      return {
        node: el("div", { style: "display:flex;flex-direction:column;gap:14px" }, [
          estilo.node, intens.node,
        ]),
        getDetalle: () => `Estilo: ${estilo.getValue()}. Intensidad: ${intens.getValue()}.`,
      };
    }
    case "suelo": {
      const mat = dropdown("Material", MATERIALES_SUELO, "Porcelanato blanco");
      return {
        node: mat.node,
        getDetalle: () => `Material de suelo: ${mat.getValue()}.`,
      };
    }
    case "paredes": {
      const acab = dropdown("Acabado", ACABADOS_PARED, "Pintura lisa");
      return {
        node: acab.node,
        getDetalle: () => `Acabado de pared: ${acab.getValue()}.`,
      };
    }
    default: {
      // Categorías genéricas (muebles, eliminar, restaurar, etc.): texto libre
      const campos = (state.categorias[clave]?.campos ?? []) as Array<{ label: string; ejemplo: string; clave: string }>;
      if (!campos.length) {
        const textarea = el("textarea", { class: "field", placeholder: "¿Qué quieres cambiar?", rows: 3 }) as HTMLTextAreaElement;
        return {
          node: textarea,
          getDetalle: () => textarea.value.trim(),
        };
      }
      const inputs = campos.map((c) =>
        el("input", { class: "field", placeholder: c.ejemplo, type: "text" }) as HTMLInputElement
      );
      return {
        node: el("div", { style: "display:flex;flex-direction:column;gap:10px" }, inputs),
        getDetalle: () =>
          campos
            .map((c, i) => ({ label: c.label, val: inputs[i].value.trim() }))
            .filter((p) => p.val)
            .map((p) => `${p.label}: ${p.val}.`)
            .join(" "),
      };
    }
  }
}
