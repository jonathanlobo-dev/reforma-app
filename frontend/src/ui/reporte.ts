// Reporte PDF de un proyecto (feature B2B para remodeladores/pintores):
// portada + una página por transformación con antes/después.
// Se genera en el dispositivo con jsPDF y se comparte/guarda como archivo.
import { toast } from "../ui";
import { resolverMedia, type Trabajo } from "../api";

// Descarga una imagen y la devuelve como dataURL JPEG reescalada (PDF liviano)
async function imgADataUrl(url: string, maxW = 900): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob);
    const esc = Math.min(1, maxW / bmp.width);
    const w = Math.round(bmp.width * esc), h = Math.round(bmp.height * esc);
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    cv.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    return { data: cv.toDataURL("image/jpeg", 0.82), w, h };
  } catch {
    return null;
  }
}

export async function generarReporte(proyecto: string, trabajos: Trabajo[]): Promise<void> {
  toast("Generando reporte PDF…");
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 15, ancho = W - M * 2;

  // ── Portada ────────────────────────────────────────────────────────────
  pdf.setFillColor(12, 12, 16);
  pdf.rect(0, 0, 210, 297, "F");
  pdf.setTextColor(109, 94, 252);
  pdf.setFontSize(30);
  pdf.setFont("helvetica", "bold");
  pdf.text("RenovAI", W / 2, 120, { align: "center" });
  pdf.setTextColor(244, 244, 247);
  pdf.setFontSize(20);
  pdf.text(`Proyecto: ${proyecto}`, W / 2, 140, { align: "center" });
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(154, 155, 171);
  pdf.text(new Date().toLocaleDateString("es-VE", { day: "numeric", month: "long", year: "numeric" }),
    W / 2, 152, { align: "center" });
  pdf.text(`${trabajos.length} transformación(es)`, W / 2, 160, { align: "center" });

  // ── Una página por transformación ──────────────────────────────────────
  for (let i = 0; i < trabajos.length; i++) {
    const t = trabajos[i];
    pdf.addPage();
    pdf.setTextColor(20, 20, 30);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.text(`${i + 1}. ${t.categoria ?? "Transformación"}`, M, 20);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(90, 90, 100);
    if (t.detalle) pdf.text(pdf.splitTextToSize(t.detalle, ancho), M, 27);

    let y = 38;
    const antes = resolverMedia(t.resultados.antes);
    const despues = resolverMedia(t.resultados.despues);
    for (const [etiqueta, url] of [["ANTES", antes], ["DESPUÉS", despues]] as const) {
      if (!url) continue;
      const img = await imgADataUrl(url);
      if (!img) continue;
      const h = Math.min((img.h / img.w) * ancho, 100);
      const wReal = (img.w / img.h) * h;
      pdf.setFontSize(9);
      pdf.setTextColor(109, 94, 252);
      pdf.text(etiqueta, M, y);
      pdf.addImage(img.data, "JPEG", M, y + 2, Math.min(wReal, ancho), h);
      y += h + 12;
    }

    pdf.setFontSize(8);
    pdf.setTextColor(160, 160, 170);
    pdf.text("Generado con RenovAI — visualización conceptual, no plano técnico.", M, 288);
  }

  // ── Guardar / compartir ────────────────────────────────────────────────
  const nombre = `renovai_${proyecto.replace(/[^\w\-]+/g, "_")}.pdf`;
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const { Share } = await import("@capacitor/share");
      const b64 = (pdf.output("datauristring") as string).split(",")[1];
      const escrito = await Filesystem.writeFile({ path: nombre, data: b64, directory: Directory.Cache });
      await Share.share({ title: `Proyecto ${proyecto}`, files: [escrito.uri] });
      return;
    }
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return;
    console.error(e);
  }
  pdf.save(nombre); // web
}
