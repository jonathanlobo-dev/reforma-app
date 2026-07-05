import { el, render, toast } from "../ui";
import { resolverMedia, type Trabajo } from "../api";
import { mostrarIntersticial } from "../ads";
import { raiz, setNavVisible } from "../nav";
import { pantallaHome } from "./home";
import { baSlider } from "../ui/controls";

export async function pantallaResult(t: Trabajo) {
  setNavVisible(false);

  const antes = resolverMedia(t.resultados.antes);
  const despues = resolverMedia(t.resultados.despues);
  const comp = resolverMedia(t.resultados.comparacion);
  const video = resolverMedia(t.resultados.video);

  const principal = video || comp || despues;

  const media: Node[] = [];
  if (video) {
    media.push(
      el("video", {
        class: "resultado-media", src: video,
        controls: true, autoplay: true, loop: true, muted: true, playsinline: true,
      })
    );
  } else if (antes && despues) {
    // Slider interactivo antes/después
    const slider = baSlider(antes, despues);
    media.push(
      slider,
      el("div", { class: "ba-tags" }, [
        el("span", { class: "ba-tag" }, ["Antes"]),
        el("span", { class: "ba-tag dep" }, ["Después"]),
      ])
    );
  } else if (comp) {
    media.push(el("img", { class: "resultado-media", src: comp }));
  }

  const compartir = async () => {
    if (!principal) return;
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({
        title: "Reforma AI",
        text: "Mira cómo transformé mi espacio con Reforma AI 👀",
        url: principal,
      });
    } catch {
      if (navigator.share) {
        try { await navigator.share({ title: "Reforma AI", url: principal }); return; } catch {}
      }
      toast("Compartir no disponible aquí.");
    }
  };

  // Se guarda el RESULTADO (video o foto transformada), no la comparación —
  // esa es para compartir.
  const objetivoGuardar = video || despues || comp;

  const guardar = async () => {
    if (!objetivoGuardar) return;
    const nombre = video ? `reforma_${t.id}.mp4` : `reforma_${t.id}.png`;

    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) {
      // Web/dev: descarga del navegador
      const a = document.createElement("a");
      a.href = objetivoGuardar; a.download = nombre; a.target = "_blank";
      document.body.append(a); a.click(); a.remove();
      toast("Descargando…");
      return;
    }

    try {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const resp = await fetch(objetivoGuardar);
      const blob = await resp.blob();
      // FileReader aguanta archivos grandes (btoa con spread revienta el stack)
      const b64 = await new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res((fr.result as string).split(",")[1]);
        fr.onerror = () => rej(fr.error);
        fr.readAsDataURL(blob);
      });
      await Filesystem.writeFile({ path: nombre, data: b64, directory: Directory.Documents });
      toast("✓ Guardado en Documentos");
    } catch (e) {
      console.error("guardar falló:", e);
      toast("No se pudo guardar. Intenta con Compartir.");
    }
  };

  render(
    el("div", { class: "screen" }, [
      el("div", { class: "topbar" }, [
        el("span", { class: "topbar-tit" }, ["Tu transformación ✨"]),
      ]),
      el("div", { class: "resultado-wrap" }, media),
      el("div", { class: "acciones" }, [
        el("button", { class: "btn-primario", onClick: guardar }, ["Guardar en el teléfono"]),
        el("button", { class: "btn-secundario", onClick: compartir }, ["Compartir"]),
        el("button", { class: "btn-secundario", onClick: () => raiz(pantallaHome) }, ["Hacer otra"]),
      ]),
    ])
  );

  if (t.tipo === "imagen") mostrarIntersticial();
}
