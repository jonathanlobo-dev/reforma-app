import { el, render, toast } from "../ui";
import { getHistorial, resolverMedia, type Trabajo } from "../api";
import { getDeviceId } from "../device";
import { irA, setNavVisible, setNavTab } from "../nav";
import { pantallaResult } from "./result";

function formatFecha(v?: string | number): string {
  if (v === undefined || v === null || v === "") return "";
  // El backend manda epoch en SEGUNDOS (time.time()); Date espera ms.
  // Sin esto salía "Hace 20619 días" (interpretaba los segundos como ms → 1970).
  const n = typeof v === "number" ? v : Number(v);
  const d = !isNaN(n) && n > 1e6 ? new Date(n * 1000) : new Date(v);
  if (isNaN(d.getTime())) return "";
  const ahora = new Date();
  const diff = (ahora.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "Ahora mismo";
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  const dias = Math.floor(diff / 86400);
  return dias === 1 ? "Hace 1 día" : `Hace ${dias} días`;
}

export async function pantallaRecientes() {
  setNavVisible(true);
  setNavTab("recientes");

  render(
    el("div", { class: "screen centro" }, [
      el("div", { class: "spinner" }),
      el("p", { class: "loader-msg" }, ["Cargando recientes…"]),
    ])
  );

  let trabajos: Trabajo[] = [];
  try {
    const deviceId = await getDeviceId();
    trabajos = await getHistorial(deviceId);
  } catch {
    toast("No se pudo cargar el historial.");
  }

  if (!trabajos.length) {
    render(
      el("div", { class: "screen" }, [
        el("div", { class: "hist-header" }, [
          el("h2", {}, ["Recientes"]),
          el("p", { class: "sub" }, ["Tus transformaciones anteriores"]),
        ]),
        el("div", { class: "hist-empty" }, [
          el("div", { class: "hist-empty-ico" }, ["🕐"]),
          el("p", {}, ["Aún no has generado ninguna transformación."]),
        ]),
      ])
    );
    return;
  }

  const cards = trabajos.map((t) => {
    const thumb = resolverMedia(t.resultados.comparacion ?? t.resultados.despues);
    const imgEl = thumb
      ? el("img", { class: "hist-thumb", src: thumb })
      : el("div", { class: "hist-thumb", style: "display:flex;align-items:center;justify-content:center;font-size:32px" }, ["✨"]);

    return el("div", {
      class: "hist-card",
      onClick: () => irA(() => pantallaResult(t)),
    }, [
      imgEl,
      el("div", { class: "hist-info" }, [
        el("div", { class: "hist-cat" }, [t.categoria ?? "Transformación"]),
        el("div", { class: "hist-fecha" }, [formatFecha(t.creado)]),
      ]),
    ]);
  });

  render(
    el("div", { class: "screen" }, [
      el("div", { class: "hist-header" }, [
        el("h2", {}, ["Recientes"]),
        el("p", { class: "sub" }, ["Tus transformaciones anteriores"]),
      ]),
      el("div", { class: "hist-grid" }, cards),
    ])
  );
}
