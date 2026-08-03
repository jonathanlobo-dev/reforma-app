import { el, render, toast } from "../ui";
import { resolverMedia, votarTrabajo, crearProceso, crearAnimacion, pedirFormatoVideo, type Trabajo, type FormatoVideo } from "../api";
import { mostrarIntersticial } from "../ads";
import { raiz, irA, desdeRaiz, setNavVisible } from "../nav";
import { pantallaHome } from "./home";
import { pantallaForm } from "./form";
import { pantallaAsesor } from "./asesor";
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

  // Formatos de video: el servidor genera el MASTER una sola vez (llamada a
  // Replicate o crossfade ffmpeg) y re-encuadra cada formato bajo demanda
  // ($0, sin volver a llamar a Replicate). "vertical" es el que llega listo
  // de entrada; cuadrado/horizontal se piden aquí y quedan cacheados por
  // trabajo en el servidor (y en memoria local, para no repetir el pedido).
  const cacheFormatos: Partial<Record<FormatoVideo, string>> = {};
  if (video) cacheFormatos.vertical = video;
  if (t.resultados.video_cuadrado) cacheFormatos.cuadrado = t.resultados.video_cuadrado;
  if (t.resultados.video_horizontal) cacheFormatos.horizontal = t.resultados.video_horizontal;
  let formatoActual: FormatoVideo = "vertical";
  let videoEl: HTMLVideoElement | null = null;
  let chipsFormato: HTMLElement | null = null;

  const objetivoActual = () => cacheFormatos[formatoActual] || video;

  const FORMATOS: { slug: FormatoVideo; label: string }[] = [
    { slug: "vertical", label: tr("result.video.formato.vertical") },
    { slug: "cuadrado", label: tr("result.video.formato.cuadrado") },
    { slug: "horizontal", label: tr("result.video.formato.horizontal") },
  ];

  async function elegirFormato(slug: FormatoVideo) {
    if (formatoActual === slug) return;
    formatoActual = slug;
    actualizarChips();
    const cacheado = cacheFormatos[slug];
    if (cacheado) {
      if (videoEl) videoEl.src = cacheado;
      return;
    }
    try {
      const deviceId = await getDeviceId();
      toast(tr("result.video.formato.generando"));
      const { video: url } = await pedirFormatoVideo(deviceId, t.id, slug);
      cacheFormatos[slug] = url;
      if (formatoActual === slug && videoEl) videoEl.src = url;
    } catch (e) {
      toast((e as Error).message);
    }
  }

  function actualizarChips() {
    chipsFormato?.querySelectorAll(".chip-formato").forEach((b) => {
      b.classList.toggle("sel", (b as HTMLElement).dataset.slug === formatoActual);
    });
  }

  const media: Node[] = [];
  if (video) {
    videoEl = el("video", {
      class: "resultado-media", src: video,
      controls: true, autoplay: true, loop: true, muted: true, playsinline: true,
    }) as HTMLVideoElement;
    media.push(videoEl);
    // Los chips de formato solo tienen sentido si el video tiene "master" (los
    // formatos se derivan de él con ffmpeg). Videos viejos, generados antes de
    // esta función, no lo tienen: mostrar los chips solo llevaría al error
    // "no tiene master". Sin master → sin chips.
    if (t.resultados.master) {
      chipsFormato = el("div", { class: "chips-formato" },
        FORMATOS.map((f) => el("button", {
          class: "chip-formato" + (f.slug === formatoActual ? " sel" : ""),
          "data-slug": f.slug,
          onClick: () => elegirFormato(f.slug),
        }, [f.label]))
      );
      media.push(chipsFormato);
    }
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
  // el video, en el formato que esté elegido) — no un link de Supabase, que
  // en WhatsApp se veía como texto.
  const compartir = async () => {
    const objetivoCompartir = (video ? objetivoActual() : null) || comp || despues;
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

  // Se guarda el RESULTADO (video, en el formato elegido, o foto
  // transformada), no la comparación.
  const guardar = async () => {
    const objetivoGuardar = (video ? objetivoActual() : null) || despues || comp;
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
      // Tras "Vaciar", seguir editando debe llevar a Diseñar/Remodelar (amueblar
      // el cuarto ya vacío), no reabrir Vaciar, que no tendría sentido.
      const destino = t.categoria === "vaciar" ? "interior" : t.categoria;
      if (destino && state.categorias[destino]) {
        desdeRaiz(() => pantallaForm(destino));
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
      desdeRaiz(() => pantallaForm("pincel"));
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

  // ── Video, con DOS opciones muy distintas ───────────────────────────────────
  //  · Animado: Seedance interpola el antes→después. Es el que se ve vivo, y
  //    cuesta una llamada a Replicate (consume cuota de video).
  //  · Diapositivas: ffmpeg funde imágenes con transiciones (costo $0). Con 2+
  //    ediciones encadenadas recorre toda la cadena; con un solo resultado hace
  //    el antes→después de esa transformación. Siempre disponible en imagen.
  const puedeAnimar = state.config.video && t.tipo === "imagen";
  const puedeProceso = t.tipo === "imagen";  // el resumen no depende de VIDEO_ON (es gratis)
  const puedeVideo = puedeAnimar || puedeProceso;
  // Ids que alimentan el resumen: la cadena COMPLETA (desde la foto original)
  // solo si termina en este resultado; si no, este solo. Así el video siempre
  // arranca en la primera foto que subió el usuario.
  const cadenaValida = state.cadena.length >= 2 &&
    state.cadena[state.cadena.length - 1] === t.id;
  const idsProceso = cadenaValida ? state.cadena : [t.id];
  // Origen del animado: la foto original (primer eslabón), para animar desde el
  // principio y no solo desde el último paso "seguir editando".
  const origenAnimado = cadenaValida ? state.cadena[0] : undefined;

  const videoProceso = async () => {
    try {
      const deviceId = await getDeviceId();
      const { id } = await crearProceso(deviceId, idsProceso);
      irA(() => pantallaEsperarTrabajo(id, "video", { pasos: pasosProceso(), reintentar: videoProceso }));
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const videoAnimado = async () => {
    try {
      const deviceId = await getDeviceId();
      const { id } = await crearAnimacion(deviceId, t.id, origenAnimado);
      irA(() => pantallaEsperarTrabajo(id, "video", { reintentar: videoAnimado }));
    } catch (e) {
      toast((e as Error).message);
    }
  };

  /** Hoja de selección: deja claro cuál anima de verdad y cuál es un resumen. */
  const elegirVideo = () => {
    const overlay = el("div", { class: "sheet-overlay", onClick: () => overlay.remove() });
    const opcion = (titulo: string, sub: string, onClick: () => void) =>
      el("div", { class: "sheet-opt opt-video", onClick: () => { overlay.remove(); onClick(); } }, [
        el("div", {}, [
          el("div", { class: "opt-video-tit" }, [titulo]),
          el("div", { class: "opt-video-sub" }, [sub]),
        ]),
      ]);
    const sheet = el("div", { class: "sheet", onClick: (e: Event) => e.stopPropagation() }, [
      el("div", { class: "sheet-tit" }, [tr("result.video.elegir")]),
      ...(puedeAnimar ? [opcion(tr("result.video.animado"), tr("result.video.animado_sub"), videoAnimado)] : []),
      ...(puedeProceso
        ? [opcion(
            state.cadena.length >= 2 ? tr("result.video.slides", { n: state.cadena.length }) : tr("result.video.reveal"),
            tr("result.video.slides_sub"), videoProceso)]
        : []),
    ]);
    overlay.append(sheet);
    document.body.append(overlay);
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
        ...(puedeVideo
          ? [el("button", { class: "btn-secundario btn-ico btn-proceso", onClick: elegirVideo },
              [icon("sparkles", 16), tr("result.generar_video")])]
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
