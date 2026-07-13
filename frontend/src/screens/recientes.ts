import { el, render, toast } from "../ui";
import { getHistorial, borrarTrabajo, resolverMedia, type Trabajo } from "../api";
import { getDeviceId } from "../device";
import { irA, setNavVisible, setNavTab } from "../nav";
import { pantallaResult } from "./result";
import { icon } from "../ui/icons";
import { generarReporte } from "../ui/reporte";
import { mostrarIntersticial } from "../ads";
import { t } from "../i18n";

function formatFecha(v?: string | number): string {
  if (v === undefined || v === null || v === "") return "";
  // El backend manda epoch en SEGUNDOS (time.time()); Date espera ms.
  // Sin esto salía "Hace 20619 días" (interpretaba los segundos como ms → 1970).
  const n = typeof v === "number" ? v : Number(v);
  const d = !isNaN(n) && n > 1e6 ? new Date(n * 1000) : new Date(v);
  if (isNaN(d.getTime())) return "";
  const ahora = new Date();
  const diff = (ahora.getTime() - d.getTime()) / 1000;
  if (diff < 60) return t("recientes.fecha.ahora");
  if (diff < 3600) return t("recientes.fecha.min", { n: Math.floor(diff / 60) });
  if (diff < 86400) return t("recientes.fecha.hora", { n: Math.floor(diff / 3600) });
  const dias = Math.floor(diff / 86400);
  return dias === 1 ? t("recientes.fecha.dia") : t("recientes.fecha.dias", { n: dias });
}

export async function pantallaRecientes() {
  setNavVisible(true);
  setNavTab("recientes");
  mostrarIntersticial(); // gratis: anuncio al entrar (respeta tope de 45 s y premium)

  render(
    el("div", { class: "screen centro" }, [
      el("div", { class: "spinner" }),
      el("p", { class: "loader-msg" }, [t("recientes.cargando")]),
    ])
  );

  let trabajos: Trabajo[] = [];
  let deviceId = "";
  try {
    deviceId = await getDeviceId();
    trabajos = await getHistorial(deviceId);
  } catch {
    toast(t("recientes.toast_error_historial"));
  }

  let filtro: string | null = null; // null = Todos

  function pintar() {
    const visibles = filtro
      ? trabajos.filter((w) => (w.proyecto || "") === filtro)
      : trabajos;

    // Chips de proyectos (solo si hay al menos uno con proyecto)
    const proyectos = [...new Set(trabajos.map((w) => w.proyecto).filter(Boolean))] as string[];
    const chips = proyectos.length
      ? el("div", { class: "proy-chips" }, [
          el("button", {
            class: "proy-chip" + (filtro === null ? " sel" : ""),
            onClick: () => { filtro = null; pintar(); },
          }, [t("recientes.todos")]),
          ...proyectos.map((p) =>
            el("button", {
              class: "proy-chip btn-ico" + (filtro === p ? " sel" : ""),
              onClick: () => { filtro = p; pintar(); },
            }, [icon("folder", 13), p])
          ),
        ])
      : el("span", {});

    const cuerpo = !visibles.length
      ? el("div", { class: "hist-empty" }, [
          el("div", { class: "hist-empty-ico" }, [icon("clock", 46)]),
          el("p", {}, [t(filtro ? "recientes.vacio_proyecto" : "recientes.vacio_general")]),
        ])
      : el("div", { class: "hist-grid" }, visibles.map((tr) => {
          // thumb liviano primero; trabajos viejos caen a la imagen completa
          const thumb = resolverMedia(tr.resultados.thumb ?? tr.resultados.comparacion ?? tr.resultados.despues);
          const imgEl = thumb
            ? el("img", { class: "hist-thumb", src: thumb, loading: "lazy", decoding: "async" })
            : el("div", { class: "hist-thumb", style: "display:flex;align-items:center;justify-content:center;font-size:32px" }, ["✨"]);
          const badgeVideo = tr.tipo === "video"
            ? el("span", { class: "hist-video-badge" }, ["▶"])
            : el("span", {});

          const btnBorrar = el("button", {
            class: "hist-borrar",
            onClick: async (e: Event) => {
              e.stopPropagation();
              if (!confirm(t("recientes.confirmar_borrar"))) return;
              const ok = await borrarTrabajo(tr.id, deviceId);
              if (ok) {
                trabajos = trabajos.filter((x) => x.id !== tr.id);
                pintar();
                toast(t("recientes.toast_eliminada"));
              } else {
                toast(t("recientes.toast_error_eliminar"));
              }
            },
          }, [icon("trash", 15)]);

          return el("div", {
            class: "hist-card",
            onClick: () => irA(() => pantallaResult(tr)),
          }, [
            el("div", { class: "hist-thumb-wrap" }, [imgEl, badgeVideo, btnBorrar]),
            el("div", { class: "hist-info" }, [
              el("div", { class: "hist-cat" }, [tr.categoria ?? t("recientes.categoria_generica")]),
              el("div", { class: "hist-fecha" }, [formatFecha(tr.creado)]),
            ]),
          ]);
        }));

    // Con un proyecto filtrado: botón de reporte PDF (feature para remodeladores)
    const btnReporte = filtro && visibles.length
      ? el("button", {
          class: "btn-secundario btn-ico", style: "margin-top:4px",
          onClick: async () => {
            try { await generarReporte(filtro!, visibles); }
            catch (e) { console.error(e); toast(t("recientes.toast_error_reporte")); }
          },
        }, [icon("fileText", 16), t("recientes.reporte_pdf", { p: filtro })])
      : el("span", {});

    render(
      el("div", { class: "screen" }, [
        el("div", { class: "hist-header" }, [
          el("h2", {}, [t("recientes.titulo")]),
          el("p", { class: "sub" }, [t("recientes.sub")]),
        ]),
        chips,
        btnReporte,
        cuerpo,
      ])
    );
  }

  pintar();
}
