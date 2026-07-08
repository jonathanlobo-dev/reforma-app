// Galería de Inspiración: fotos por ambiente/estilo. Tocar una → "Usar este
// estilo" alimenta el modo Estilo de referencia con esa imagen.
// El catálogo crece soltando archivos en public/estilos|inspiracion y
// añadiéndolos aquí.
import { el, render, toast } from "../ui";
import { setNavVisible, setNavTab, irA } from "../nav";
import { setReferencia, state } from "../state";
import { pantallaForm } from "./form";
import { icon } from "../ui/icons";

interface Inspo { src: string; titulo: string; ambiente: string; }

const CATALOGO: Inspo[] = [
  // Salas (previews de estilo originales)
  { src: "/estilos/moderno.webp", titulo: "Moderno", ambiente: "Sala" },
  { src: "/estilos/minimalista.webp", titulo: "Minimalista", ambiente: "Sala" },
  { src: "/estilos/escandinavo.webp", titulo: "Escandinavo", ambiente: "Sala" },
  { src: "/estilos/industrial.webp", titulo: "Industrial", ambiente: "Sala" },
  { src: "/estilos/contemporaneo.webp", titulo: "Contemporáneo", ambiente: "Sala" },
  { src: "/estilos/rustico.webp", titulo: "Rústico", ambiente: "Sala" },
  { src: "/estilos/clasico.webp", titulo: "Clásico", ambiente: "Sala" },
  { src: "/estilos/tradicional.webp", titulo: "Tradicional", ambiente: "Sala" },
  // Cocinas
  { src: "/inspiracion/cocina_moderna.webp", titulo: "Moderna", ambiente: "Cocina" },
  { src: "/inspiracion/cocina_escandinava.webp", titulo: "Escandinava", ambiente: "Cocina" },
  { src: "/inspiracion/cocina_industrial.webp", titulo: "Industrial", ambiente: "Cocina" },
  { src: "/inspiracion/cocina_tradicional.webp", titulo: "Tradicional", ambiente: "Cocina" },
  // Dormitorios
  { src: "/inspiracion/dormitorio_moderno.webp", titulo: "Moderno", ambiente: "Dormitorio" },
  { src: "/inspiracion/dormitorio_minimalista.webp", titulo: "Minimalista", ambiente: "Dormitorio" },
  { src: "/inspiracion/dormitorio_rustico.webp", titulo: "Rústico", ambiente: "Dormitorio" },
  { src: "/inspiracion/dormitorio_contemp.webp", titulo: "Contemporáneo", ambiente: "Dormitorio" },
  // Baños
  { src: "/inspiracion/bano_moderno.webp", titulo: "Moderno", ambiente: "Baño" },
  { src: "/inspiracion/bano_minimalista.webp", titulo: "Minimalista spa", ambiente: "Baño" },
  { src: "/inspiracion/bano_clasico.webp", titulo: "Clásico", ambiente: "Baño" },
  // Exterior y jardín
  { src: "/inspiracion/fachada_moderna.webp", titulo: "Fachada moderna", ambiente: "Exterior" },
  { src: "/inspiracion/fachada_rustica.webp", titulo: "Fachada rústica", ambiente: "Exterior" },
  { src: "/inspiracion/terraza_moderna.webp", titulo: "Terraza", ambiente: "Exterior" },
  { src: "/inspiracion/jardin_paisajistico.webp", titulo: "Jardín paisajístico", ambiente: "Jardín" },
  { src: "/inspiracion/jardin_zen.webp", titulo: "Jardín zen", ambiente: "Jardín" },
];

const AMBIENTES = ["Todos", "Sala", "Cocina", "Dormitorio", "Baño", "Exterior", "Jardín"];
let ambienteActivo = "Todos";

export function pantallaInspiracion() {
  setNavVisible(true);
  setNavTab("inspiracion");

  const visibles = ambienteActivo === "Todos"
    ? CATALOGO
    : CATALOGO.filter((it) => it.ambiente === ambienteActivo);

  const chips = el("div", { class: "proy-chips" },
    AMBIENTES.map((a) =>
      el("button", {
        class: "proy-chip" + (a === ambienteActivo ? " sel" : ""),
        onClick: () => { ambienteActivo = a; pantallaInspiracion(); },
      }, [a])
    ));

  const cards = visibles.map((it) =>
    el("div", { class: "inspo-card", onClick: () => abrirDetalle(it) }, [
      el("img", { class: "inspo-img", src: it.src, loading: "lazy", alt: it.titulo }),
      el("div", { class: "inspo-info" }, [
        el("div", { class: "inspo-titulo" }, [it.titulo]),
        el("div", { class: "inspo-amb" }, [it.ambiente]),
      ]),
    ])
  );

  render(
    el("div", { class: "screen" }, [
      el("div", { class: "hist-header" }, [
        el("h2", {}, ["Inspiración"]),
        el("p", { class: "sub" }, ["Estilos para copiar a tu espacio"]),
      ]),
      chips,
      el("div", { class: "inspo-grid" }, cards),
    ])
  );
}

function abrirDetalle(it: Inspo) {
  const overlay = el("div", { class: "sheet-overlay", onClick: cerrar });
  const sheet = el("div", { class: "sheet", onClick: (e: Event) => e.stopPropagation() }, [
    el("img", { class: "inspo-detalle-img", src: it.src }),
    el("div", { class: "sheet-tit", style: "margin-top:12px" }, [`${it.titulo} · ${it.ambiente}`]),
    el("p", { class: "aj-p" }, ["Sube una foto de tu espacio y le copiamos este estilo, colores y ambiente."]),
    el("button", { class: "btn-primario btn-ico", style: "width:100%", onClick: usar },
      [icon("sparkles", 17), "Usar este estilo en mi espacio"]),
  ]);
  overlay.append(sheet);
  document.body.append(overlay);

  function cerrar() { overlay.remove(); }

  async function usar() {
    try {
      const blob = await (await fetch(it.src)).blob();
      setReferencia({ blob, url: URL.createObjectURL(blob) });
      cerrar();
      if (!state.categorias["estilo"]) { toast("El modo Estilo no está disponible."); return; }
      irA(() => pantallaForm("estilo"));
      toast("Referencia lista — ahora sube la foto de TU espacio");
    } catch {
      toast("No se pudo cargar la imagen.");
    }
  }
}
