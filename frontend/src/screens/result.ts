import { el, render, toast } from "../ui";
import { resolverMedia, votarTrabajo, crearProceso, type Trabajo } from "../api";
import { mostrarIntersticial } from "../ads";
import { raiz, irA, setNavVisible } from "../nav";
import { pantallaHome } from "./home";
import { pantallaForm } from "./form";
import { pantallaAsesor } from "./asesor";
import { pantallaPaywall } from "./paywall";
import { baSlider } from "../ui/controls";
import { state, setFoto } from "../state";
import { icon } from "../ui/icons";
import { pantallaProcessing, pantallaEsperarTrabajo, pasosProceso } from "./processing";
import { getDeviceId } from "../device";
import { t as tr } from "../i18n"; // alias: el parámetro `t` de esta pantalla es el Trabajo

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
        el("span", { class: "ba-tag" }, [tr("result.antes")]),
        el("span", { class: "ba-tag dep" }, [tr("result.despues")]),
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
    const texto = tr("result.compartir_texto");
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import("@capacitor/filesystem");
        const { Share } = await import("@capacitor/share");
        const blob = await (await fetch(objetivoCompartir)).blob();
        const escrito = await Filesystem.writeFile({
          path: nombre, data: await blobABase64(blob), directory: Directory.Cache,
        });
        await Share.share({ title: "RenuevAI", text: texto, files: [escrito.uri] });
        return;
      }
      // Web: archivo si el navegador lo soporta; si no, link
      const blob = await (await fetch(objetivoCompartir)).blob();
      const file = new File([blob], nombre, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "RenuevAI", text: texto, files: [file] });
      } else if (navigator.share) {
        await navigator.share({ title: "RenuevAI", text: texto, url: objetivoCompartir });
      } else {
        toast(tr("result.toast.compartir_no_disponible"));
      }
    } catch (e) {
      // Cancelar el diálogo de compartir también cae aquí: no es error real
      if ((e as Error)?.name !== "AbortError") {
        console.error("compartir falló:", e);
        toast(tr("result.toast.error_compartir"));
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
      toast(tr("result.toast.descargando"));
      return;
    }

    try {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const blob = await (await fetch(objetivoGuardar)).blob();
      await Filesystem.writeFile({
        path: nombre, data: await blobABase64(blob), directory: Directory.Documents,
      });
      toast(tr("result.toast.guardado"));
    } catch (e) {
      console.error("guardar falló:", e);
      toast(tr("result.toast.error_guardar"));
    }
  };

  // 👍/👎 — feedback simple para saber qué categorías funcionan
  let votado = false;
  const votos = el("div", { class: "votos" }, [
    el("span", { class: "votos-txt" }, [tr("result.pregunta_voto")]),
    el("button", { class: "voto-btn", onClick: (e: Event) => vota(1, e) }, [icon("thumbsUp", 18)]),
    el("button", { class: "voto-btn", onClick: (e: Event) => vota(-1, e) }, [icon("thumbsDown", 18)]),
  ]);
  function vota(v: 1 | -1, e: Event) {
    if (votado) return;
    votado = true;
    (e.currentTarget as HTMLElement).classList.add("sel");
    votos.querySelectorAll(".voto-btn").forEach((b) => (b as HTMLButtonElement).disabled = true);
    votarTrabajo(t.id, v);
    toast(v === 1 ? tr("result.voto.gracias_positivo") : tr("result.voto.gracias_negativo"));
  }

  // Otra versión: misma foto y mismo pedido — los modelos son no-deterministas,
  // a veces la segunda sale mejor. Solo engines sin archivos extra (mask/ref).
  const engine = state.categorias[t.categoria]?.engine ?? "editar";
  const puedeReintentar = antes && t.detalle !== undefined && (engine === "editar" || engine === "plano");
  const otraVersion = async () => {
    if (!antes) return;
    if (!confirm(tr("result.otra_version_confirm"))) return;
    try {
      const blob = await (await fetch(antes)).blob();
      irA(() => pantallaProcessing({
        categoria: t.categoria, detalle: t.detalle || "", tipo: t.tipo,
        foto: blob, proyecto: t.proyecto || undefined,
      }));
    } catch {
      toast(tr("result.toast.error_relanzar"));
    }
  };

  // Seguir editando: el resultado LIMPIO (sin marca de agua, para no apilar
  // marcas) pasa a ser la foto de partida, y se abre directo el form de la
  // misma categoría con sus selectores — sin pasar por Inicio.
  const seguirEditando = async () => {
    const src = resolverMedia(t.resultados.limpio) || despues || comp;
    if (!src) return;
    try {
      const r = await fetch(src);
      const blob = await r.blob();
      setFoto({ blob, url: URL.createObjectURL(blob) });
      state.mask = undefined;
      if (t.categoria && state.categorias[t.categoria]) {
        irA(() => pantallaForm(t.categoria));
      } else {
        raiz(pantallaHome);
        toast(tr("result.toast.elige_modo"));
      }
    } catch {
      toast(tr("result.toast.error_editar"));
    }
  };

  // Retocar con pincel: el resultado limpio pasa a ser la foto y se abre el
  // modo Pincel mágico — para señalar una zona exacta del resultado y cambiar
  // SOLO eso (ej. "aquí una piscina con esta forma").
  const retocarPincel = async () => {
    const src = resolverMedia(t.resultados.limpio) || despues || comp;
    if (!src || !state.categorias["pincel"]) return;
    try {
      const blob = await (await fetch(src)).blob();
      setFoto({ blob, url: URL.createObjectURL(blob) });
      state.mask = undefined;
      irA(() => pantallaForm("pincel"));
    } catch {
      toast(tr("result.toast.error_editar"));
    }
  };

  // Explorar habitaciones (Beta): solo en resultados del plano 2D→3D — el
  // usuario encuadra una habitación del render y genera la vista interior.
  const fuenteExplorar = resolverMedia(t.resultados.limpio) || despues;
  const puedeExplorar = engine === "plano" && !!fuenteExplorar;
  const explorar = async () => {
    const { pantallaExplorar } = await import("./explorar");
    irA(() => pantallaExplorar(fuenteExplorar!, t.proyecto || undefined));
  };

  // Video del PROCESO (premium): original → cada edición → resultado final.
  // Disponible cuando hay al menos 2 ediciones encadenadas de la misma foto.
  const puedeProceso = state.config.video && t.tipo === "imagen" && state.cadena.length >= 2;
  const videoProceso = async () => {
    if (!state.premium) {
      toast(tr("result.toast.proceso_premium"));
      irA(() => pantallaPaywall());
      return;
    }
    try {
      const deviceId = await getDeviceId();
      const { id } = await crearProceso(deviceId, state.cadena);
      irA(() => pantallaEsperarTrabajo(id, "video", pasosProceso()));
    } catch (e) {
      toast((e as Error).message);
    }
  };

  render(
    el("div", { class: "screen" }, [
      el("div", { class: "topbar" }, [
        el("span", { class: "topbar-tit" }, [tr("result.titulo")]),
      ]),
      el("div", { class: "resultado-wrap" }, media),
      votos,
      el("div", { class: "acciones" }, [
        el("button", { class: "btn-primario btn-ico", onClick: guardar }, [icon("download", 18), tr("result.guardar")]),
        ...(t.tipo === "imagen"
          ? [el("button", { class: "btn-secundario btn-ico", onClick: seguirEditando }, [icon("pencil", 16), tr("result.seguir_editando")])]
          : []),
        ...(puedeReintentar
          ? [el("button", { class: "btn-secundario btn-ico", onClick: otraVersion }, [icon("refresh", 16), tr("result.otra_version")])]
          : []),
        ...(t.tipo === "imagen" && state.categorias["pincel"]
          ? [el("button", { class: "btn-secundario btn-ico", onClick: retocarPincel }, [icon("brush", 16), tr("result.retocar_pincel")])]
          : []),
        ...(puedeExplorar
          ? [el("button", { class: "btn-secundario btn-ico", onClick: explorar },
              [icon("search", 16), tr("result.explorar")])]
          : []),
        ...(puedeProceso
          ? [el("button", { class: "btn-secundario btn-ico btn-proceso", onClick: videoProceso },
              [icon("sparkles", 16), tr("result.video_proceso", { n: state.cadena.length }), ...(state.premium ? [] : [icon("lock", 13)])])]
          : []),
        el("button", { class: "btn-secundario btn-ico", onClick: compartir }, [icon("share", 16), tr("result.compartir")]),
        el("button", { class: "btn-secundario btn-ico", onClick: () => {
          const ctx = [t.categoria, t.detalle].filter(Boolean).join(": ");
          irA(() => pantallaAsesor(ctx || undefined));
        }}, [icon("tool", 16), tr("result.preguntar_maestro", { nombre: tr("asesor.nombre") })]),
        el("button", { class: "btn-secundario", onClick: () => raiz(pantallaHome) }, [tr("result.hacer_otra")]),
      ]),
    ])
  );

  // Anuncio intersticial SOLO a usuarios gratis y en resultados de imagen
  // (el premium paga justamente por no ver anuncios).
  if (t.tipo === "imagen" && !state.premium) mostrarIntersticial();
}
