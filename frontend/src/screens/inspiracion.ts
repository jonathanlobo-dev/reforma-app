// Galería de Inspiración: fotos por ambiente/estilo. Tocar una → "Usar este
// estilo" alimenta el modo Estilo de referencia con esa imagen.
// El catálogo crece soltando archivos en public/estilos|inspiracion y
// añadiéndolos aquí.
import { el, render, toast } from "../ui";
import { setNavVisible, setNavTab, irA } from "../nav";
import { setReferencia, state } from "../state";
import { pantallaForm } from "./form";
import { icon } from "../ui/icons";
import { t } from "../i18n";

interface Inspo { src: string; tituloKey: string; ambienteKey: string; }

const CATALOGO: Inspo[] = [
  // Salas (previews de estilo originales — reusan las claves estilo.*)
  { src: "/estilos/moderno.webp", tituloKey: "estilo.moderno", ambienteKey: "inspiracion.ambiente.sala" },
  { src: "/estilos/minimalista.webp", tituloKey: "estilo.minimalista", ambienteKey: "inspiracion.ambiente.sala" },
  { src: "/estilos/escandinavo.webp", tituloKey: "estilo.escandinavo", ambienteKey: "inspiracion.ambiente.sala" },
  { src: "/estilos/industrial.webp", tituloKey: "estilo.industrial", ambienteKey: "inspiracion.ambiente.sala" },
  { src: "/estilos/contemporaneo.webp", tituloKey: "estilo.contemporaneo", ambienteKey: "inspiracion.ambiente.sala" },
  { src: "/estilos/rustico.webp", tituloKey: "estilo.rustico", ambienteKey: "inspiracion.ambiente.sala" },
  { src: "/estilos/clasico.webp", tituloKey: "estilo.clasico", ambienteKey: "inspiracion.ambiente.sala" },
  { src: "/estilos/tradicional.webp", tituloKey: "estilo.tradicional", ambienteKey: "inspiracion.ambiente.sala" },
  // Cocinas
  { src: "/inspiracion/cocina_moderna.webp", tituloKey: "inspo.cocina_moderna", ambienteKey: "inspiracion.ambiente.cocina" },
  { src: "/inspiracion/cocina_escandinava.webp", tituloKey: "inspo.cocina_escandinava", ambienteKey: "inspiracion.ambiente.cocina" },
  { src: "/inspiracion/cocina_industrial.webp", tituloKey: "inspo.cocina_industrial", ambienteKey: "inspiracion.ambiente.cocina" },
  { src: "/inspiracion/cocina_tradicional.webp", tituloKey: "inspo.cocina_tradicional", ambienteKey: "inspiracion.ambiente.cocina" },
  // Dormitorios
  { src: "/inspiracion/dormitorio_moderno.webp", tituloKey: "inspo.dormitorio_moderno", ambienteKey: "inspiracion.ambiente.dormitorio" },
  { src: "/inspiracion/dormitorio_minimalista.webp", tituloKey: "inspo.dormitorio_minimalista", ambienteKey: "inspiracion.ambiente.dormitorio" },
  { src: "/inspiracion/dormitorio_rustico.webp", tituloKey: "inspo.dormitorio_rustico", ambienteKey: "inspiracion.ambiente.dormitorio" },
  { src: "/inspiracion/dormitorio_contemp.webp", tituloKey: "inspo.dormitorio_contemp", ambienteKey: "inspiracion.ambiente.dormitorio" },
  // Baños
  { src: "/inspiracion/bano_moderno.webp", tituloKey: "inspo.bano_moderno", ambienteKey: "inspiracion.ambiente.bano" },
  { src: "/inspiracion/bano_minimalista.webp", tituloKey: "inspo.bano_minimalista", ambienteKey: "inspiracion.ambiente.bano" },
  { src: "/inspiracion/bano_clasico.webp", tituloKey: "inspo.bano_clasico", ambienteKey: "inspiracion.ambiente.bano" },
  // Exterior y jardín
  { src: "/inspiracion/fachada_moderna.webp", tituloKey: "inspo.fachada_moderna", ambienteKey: "inspiracion.ambiente.exterior" },
  { src: "/inspiracion/fachada_rustica.webp", tituloKey: "inspo.fachada_rustica", ambienteKey: "inspiracion.ambiente.exterior" },
  { src: "/inspiracion/terraza_moderna.webp", tituloKey: "inspo.terraza_moderna", ambienteKey: "inspiracion.ambiente.exterior" },
  { src: "/inspiracion/jardin_paisajistico.webp", tituloKey: "inspo.jardin_paisajistico", ambienteKey: "inspiracion.ambiente.jardin" },
  { src: "/inspiracion/jardin_zen.webp", tituloKey: "inspo.jardin_zen", ambienteKey: "inspiracion.ambiente.jardin" },
];

const AMBIENTES = [
  { clave: "todos", labelKey: "inspiracion.ambiente.todos" },
  { clave: "inspiracion.ambiente.sala", labelKey: "inspiracion.ambiente.sala" },
  { clave: "inspiracion.ambiente.cocina", labelKey: "inspiracion.ambiente.cocina" },
  { clave: "inspiracion.ambiente.dormitorio", labelKey: "inspiracion.ambiente.dormitorio" },
  { clave: "inspiracion.ambiente.bano", labelKey: "inspiracion.ambiente.bano" },
  { clave: "inspiracion.ambiente.exterior", labelKey: "inspiracion.ambiente.exterior" },
  { clave: "inspiracion.ambiente.jardin", labelKey: "inspiracion.ambiente.jardin" },
];
let ambienteActivo = "todos";

export function pantallaInspiracion() {
  setNavVisible(true);
  setNavTab("inspiracion");

  const visibles = ambienteActivo === "todos"
    ? CATALOGO
    : CATALOGO.filter((it) => it.ambienteKey === ambienteActivo);

  const chips = el("div", { class: "proy-chips" },
    AMBIENTES.map((a) =>
      el("button", {
        class: "proy-chip" + (a.clave === ambienteActivo ? " sel" : ""),
        onClick: () => { ambienteActivo = a.clave; pantallaInspiracion(); },
      }, [t(a.labelKey)])
    ));

  const cards = visibles.map((it) =>
    el("div", { class: "inspo-card", onClick: () => abrirDetalle(it) }, [
      el("img", { class: "inspo-img", src: it.src, loading: "lazy", alt: t(it.tituloKey) }),
      el("div", { class: "inspo-info" }, [
        el("div", { class: "inspo-titulo" }, [t(it.tituloKey)]),
        el("div", { class: "inspo-amb" }, [t(it.ambienteKey)]),
      ]),
    ])
  );

  render(
    el("div", { class: "screen" }, [
      el("div", { class: "hist-header" }, [
        el("h2", {}, [t("inspiracion.titulo")]),
        el("p", { class: "sub" }, [t("inspiracion.sub")]),
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
    el("div", { class: "sheet-tit", style: "margin-top:12px" }, [`${t(it.tituloKey)} · ${t(it.ambienteKey)}`]),
    el("p", { class: "aj-p" }, [t("inspiracion.detalle_texto")]),
    el("button", { class: "btn-primario btn-ico", style: "width:100%", onClick: usar },
      [icon("sparkles", 17), t("inspiracion.usar")]),
  ]);
  overlay.append(sheet);
  document.body.append(overlay);

  function cerrar() { overlay.remove(); }

  async function usar() {
    try {
      const blob = await (await fetch(it.src)).blob();
      setReferencia({ blob, url: URL.createObjectURL(blob) });
      cerrar();
      if (!state.categorias["estilo"]) { toast(t("inspiracion.toast_modo_no_disp")); return; }
      irA(() => pantallaForm("estilo"));
      toast(t("inspiracion.toast_lista"));
    } catch {
      toast(t("inspiracion.toast_error"));
    }
  }
}
