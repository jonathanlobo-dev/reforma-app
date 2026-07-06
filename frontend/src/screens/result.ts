import { el, render, toast } from "../ui";
import { resolverMedia, votarTrabajo, type Trabajo } from "../api";
import { mostrarIntersticial } from "../ads";
import { raiz, irA, setNavVisible } from "../nav";
import { pantallaHome } from "./home";
import { pantallaAsesor } from "./asesor";
import { baSlider } from "../ui/controls";
import { state, setFoto } from "../state";

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

  // 👍/👎 — feedback simple para saber qué categorías funcionan
  let votado = false;
  const votos = el("div", { class: "votos" }, [
    el("span", { class: "votos-txt" }, ["¿Qué te pareció?"]),
    el("button", { class: "voto-btn", onClick: (e: Event) => vota(1, e) }, ["👍"]),
    el("button", { class: "voto-btn", onClick: (e: Event) => vota(-1, e) }, ["👎"]),
  ]);
  function vota(v: 1 | -1, e: Event) {
    if (votado) return;
    votado = true;
    (e.currentTarget as HTMLElement).classList.add("sel");
    votos.querySelectorAll(".voto-btn").forEach((b) => (b as HTMLButtonElement).disabled = true);
    votarTrabajo(t.id, v);
    toast(v === 1 ? "¡Gracias! 🙌" : "Gracias — nos ayuda a mejorar.");
  }

  // Seguir editando: el resultado pasa a ser la foto de partida de otro modo
  const seguirEditando = async () => {
    const src = despues || comp;
    if (!src) return;
    try {
      const r = await fetch(src);
      const blob = await r.blob();
      setFoto({ blob, url: URL.createObjectURL(blob) });
      state.mask = undefined;
      raiz(pantallaHome);
      toast("Tu resultado quedó cargado como foto — elige un modo ✏️");
    } catch {
      toast("No se pudo cargar el resultado para editar.");
    }
  };

  render(
    el("div", { class: "screen" }, [
      el("div", { class: "topbar" }, [
        el("span", { class: "topbar-tit" }, ["Tu transformación ✨"]),
      ]),
      el("div", { class: "resultado-wrap" }, media),
      votos,
      el("div", { class: "acciones" }, [
        el("button", { class: "btn-primario", onClick: guardar }, ["Guardar en el teléfono"]),
        ...(t.tipo === "imagen"
          ? [el("button", { class: "btn-secundario", onClick: seguirEditando }, ["✏️ Seguir editando este resultado"])]
          : []),
        el("button", { class: "btn-secundario", onClick: compartir }, ["Compartir"]),
        el("button", { class: "btn-secundario", onClick: () => {
          const ctx = [t.categoria, t.detalle].filter(Boolean).join(": ");
          irA(() => pantallaAsesor(ctx || undefined));
        }}, ["🧰 Preguntar al Maestro (materiales y consejos)"]),
        el("button", { class: "btn-secundario", onClick: () => raiz(pantallaHome) }, ["Hacer otra"]),
      ]),
    ])
  );

  if (t.tipo === "imagen") mostrarIntersticial();
}
