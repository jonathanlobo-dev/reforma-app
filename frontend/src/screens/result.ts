import { el, render, toast } from "../ui";
import { resolverMedia, votarTrabajo, type Trabajo } from "../api";
import { mostrarIntersticial } from "../ads";
import { raiz, irA, setNavVisible } from "../nav";
import { pantallaHome } from "./home";
import { pantallaAsesor } from "./asesor";
import { baSlider } from "../ui/controls";
import { state, setFoto } from "../state";
import { icon } from "../ui/icons";
import { pantallaProcessing } from "./processing";

function blobABase64(blob: Blob): Promise<string> {
  // FileReader aguanta archivos grandes (btoa con spread revienta el stack)
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res((fr.result as string).split(",")[1]);
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });
}

export async function pantallaResult(t: Trabajo) {
  setNavVisible(false);

  const antes = resolverMedia(t.resultados.antes);
  const despues = resolverMedia(t.resultados.despues);
  const comp = resolverMedia(t.resultados.comparacion);
  const video = resolverMedia(t.resultados.video);

  const media: Node[] = [];
  if (video) {
    media.push(
      el("video", {
        class: "resultado-media", src: video,
        controls: true, autoplay: true, loop: true, muted: true, playsinline: true,
      })
    );
  } else if (antes && despues) {
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

  // Compartir manda el ARCHIVO (la comparación antes|después con watermark, o
  // el video) — no un link de Supabase, que en WhatsApp se veía como texto.
  const objetivoCompartir = video || comp || despues;
  const compartir = async () => {
    if (!objetivoCompartir) return;
    const nombre = video ? `renovai_${t.id}.mp4` : `renovai_${t.id}.png`;
    const texto = "Mira cómo transformé mi espacio con RenovAI";
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import("@capacitor/filesystem");
        const { Share } = await import("@capacitor/share");
        const blob = await (await fetch(objetivoCompartir)).blob();
        const escrito = await Filesystem.writeFile({
          path: nombre, data: await blobABase64(blob), directory: Directory.Cache,
        });
        await Share.share({ title: "RenovAI", text: texto, files: [escrito.uri] });
        return;
      }
      // Web: archivo si el navegador lo soporta; si no, link
      const blob = await (await fetch(objetivoCompartir)).blob();
      const file = new File([blob], nombre, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "RenovAI", text: texto, files: [file] });
      } else if (navigator.share) {
        await navigator.share({ title: "RenovAI", text: texto, url: objetivoCompartir });
      } else {
        toast("Compartir no disponible aquí.");
      }
    } catch (e) {
      // Cancelar el diálogo de compartir también cae aquí: no es error real
      if ((e as Error)?.name !== "AbortError") {
        console.error("compartir falló:", e);
        toast("No se pudo compartir.");
      }
    }
  };

  // Se guarda el RESULTADO (video o foto transformada), no la comparación.
  const objetivoGuardar = video || despues || comp;
  const guardar = async () => {
    if (!objetivoGuardar) return;
    const nombre = video ? `renovai_${t.id}.mp4` : `renovai_${t.id}.png`;

    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) {
      const a = document.createElement("a");
      a.href = objetivoGuardar; a.download = nombre; a.target = "_blank";
      document.body.append(a); a.click(); a.remove();
      toast("Descargando…");
      return;
    }

    try {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const blob = await (await fetch(objetivoGuardar)).blob();
      await Filesystem.writeFile({
        path: nombre, data: await blobABase64(blob), directory: Directory.Documents,
      });
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
    el("button", { class: "voto-btn", onClick: (e: Event) => vota(1, e) }, [icon("thumbsUp", 18)]),
    el("button", { class: "voto-btn", onClick: (e: Event) => vota(-1, e) }, [icon("thumbsDown", 18)]),
  ]);
  function vota(v: 1 | -1, e: Event) {
    if (votado) return;
    votado = true;
    (e.currentTarget as HTMLElement).classList.add("sel");
    votos.querySelectorAll(".voto-btn").forEach((b) => (b as HTMLButtonElement).disabled = true);
    votarTrabajo(t.id, v);
    toast(v === 1 ? "¡Gracias!" : "Gracias — nos ayuda a mejorar.");
  }

  // Otra versión: misma foto y mismo pedido — los modelos son no-deterministas,
  // a veces la segunda sale mejor. Solo engines sin archivos extra (mask/ref).
  const engine = state.categorias[t.categoria]?.engine ?? "editar";
  const puedeReintentar = antes && t.detalle !== undefined && (engine === "editar" || engine === "plano");
  const otraVersion = async () => {
    if (!antes) return;
    if (!confirm("Generará una nueva versión del mismo pedido (consume 1 generación del día). ¿Continuar?")) return;
    try {
      const blob = await (await fetch(antes)).blob();
      irA(() => pantallaProcessing({
        categoria: t.categoria, detalle: t.detalle || "", tipo: t.tipo,
        foto: blob, proyecto: t.proyecto || undefined,
      }));
    } catch {
      toast("No se pudo relanzar la generación.");
    }
  };

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
      toast("Tu resultado quedó cargado como foto — elige un modo");
    } catch {
      toast("No se pudo cargar el resultado para editar.");
    }
  };

  render(
    el("div", { class: "screen" }, [
      el("div", { class: "topbar" }, [
        el("span", { class: "topbar-tit" }, ["Tu transformación"]),
      ]),
      el("div", { class: "resultado-wrap" }, media),
      votos,
      el("div", { class: "acciones" }, [
        el("button", { class: "btn-primario btn-ico", onClick: guardar }, [icon("download", 18), "Guardar en el teléfono"]),
        ...(t.tipo === "imagen"
          ? [el("button", { class: "btn-secundario btn-ico", onClick: seguirEditando }, [icon("pencil", 16), "Seguir editando este resultado"])]
          : []),
        ...(puedeReintentar
          ? [el("button", { class: "btn-secundario btn-ico", onClick: otraVersion }, [icon("refresh", 16), "Otra versión"])]
          : []),
        el("button", { class: "btn-secundario btn-ico", onClick: compartir }, [icon("share", 16), "Compartir"]),
        el("button", { class: "btn-secundario btn-ico", onClick: () => {
          const ctx = [t.categoria, t.detalle].filter(Boolean).join(": ");
          irA(() => pantallaAsesor(ctx || undefined));
        }}, [icon("tool", 16), "Preguntar al Maestro"]),
        el("button", { class: "btn-secundario", onClick: () => raiz(pantallaHome) }, ["Hacer otra"]),
      ]),
    ])
  );

  if (t.tipo === "imagen") mostrarIntersticial();
}
