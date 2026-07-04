import { el, render, toast } from "../ui";
import { resolverMedia, type Trabajo } from "../api";
import { mostrarIntersticial } from "../ads";
import { pantallaHome } from "./home";

export async function pantallaResult(t: Trabajo) {
  const antes = resolverMedia(t.resultados.antes);
  const despues = resolverMedia(t.resultados.despues);
  const comp = resolverMedia(t.resultados.comparacion);
  const video = resolverMedia(t.resultados.video);

  const media: Node[] = [];
  if (video) {
    // Video premium: la transformación animada como protagonista.
    media.push(el("video", { class: "resultado-media", src: video, controls: true, autoplay: true, loop: true, muted: true, playsinline: true }));
  } else if (antes && despues) {
    // Imagen: antes/después apilados (mejor en móvil que la tira horizontal).
    media.push(
      el("div", { class: "ba-item" }, [el("span", { class: "ba-tag" }, ["Antes"]), el("img", { class: "resultado-media", src: antes })]),
      el("div", { class: "ba-item" }, [el("span", { class: "ba-tag despues" }, ["Después"]), el("img", { class: "resultado-media", src: despues })]),
    );
  } else if (comp) {
    media.push(el("img", { class: "resultado-media", src: comp }));
  }

  const compartir = async () => {
    const url = video || comp;
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title: "Reforma AI", text: "Mira cómo transformé mi espacio 👀", url });
    } catch {
      if (navigator.share) {
        try { await navigator.share({ title: "Reforma AI", url }); return; } catch {}
      }
      toast("Compartir no disponible aquí. El archivo está listo para descargar.");
    }
  };

  render(
    el("div", { class: "screen" }, [
      el("div", { class: "topbar" }, [el("span", { class: "topbar-tit" }, ["Tu transformación ✨"])]),
      el("div", { class: "resultado-wrap" }, media),
      el("div", { class: "acciones" }, [
        el("button", { class: "btn-primario", onClick: compartir }, ["Compartir"]),
        el("button", { class: "btn-secundario", onClick: pantallaHome }, ["Hacer otra"]),
      ]),
    ])
  );

  // Tier gratis (imagen): mostrar ad al llegar al resultado.
  if (t.tipo === "imagen") mostrarIntersticial();
}
