// "Explorar habitaciones" (Beta): sobre el render 3D de un plano, el usuario
// encuadra una habitación arrastrando un rectángulo; el recorte se manda como
// nuevo trabajo (engine "explorar") que genera una vista interior a nivel de
// ojos. La fidelidad es aproximada — se vende como inspiración.
import { el, render, toast } from "../ui";
import { atras, irA, setNavVisible } from "../nav";
import { pantallaProcessing } from "./processing";
import { t } from "../i18n";

interface Rect { x: number; y: number; w: number; h: number; }

export async function pantallaExplorar(fotoSrc: string, proyecto?: string) {
  setNavVisible(false);

  // La imagen viene de Supabase (cross-origin): se baja como blob para que el
  // canvas no quede "tainted" y toBlob() funcione.
  let objectUrl: string;
  try {
    const blob = await (await fetch(fotoSrc)).blob();
    objectUrl = URL.createObjectURL(blob);
  } catch {
    toast(t("explorar.toast.error_cargar"));
    return;
  }

  const img = new Image();
  img.src = objectUrl;

  let rect: Rect | null = null;      // en px del canvas
  let arrastrando = false;

  const canvas = el("canvas", { class: "mask-canvas" }) as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;

  function redibujar() {
    if (!img.complete || !img.naturalWidth) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (!rect) return;
    // Oscurecer todo menos la selección + borde violeta
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
    ctx.drawImage(img,
      rect.x * (img.naturalWidth / canvas.width), rect.y * (img.naturalHeight / canvas.height),
      rect.w * (img.naturalWidth / canvas.width), rect.h * (img.naturalHeight / canvas.height),
      rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  }

  function coords(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(canvas.width, (e.clientX - r.left) * (canvas.width / r.width))),
      y: Math.max(0, Math.min(canvas.height, (e.clientY - r.top) * (canvas.height / r.height))),
    };
  }

  let origen = { x: 0, y: 0 };
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    origen = coords(e);
    rect = { x: origen.x, y: origen.y, w: 0, h: 0 };
    arrastrando = true;
    redibujar();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!arrastrando || !rect) return;
    const p = coords(e);
    rect.x = Math.min(origen.x, p.x);
    rect.y = Math.min(origen.y, p.y);
    rect.w = Math.abs(p.x - origen.x);
    rect.h = Math.abs(p.y - origen.y);
    redibujar();
    actualizarBoton();
  });
  canvas.addEventListener("pointerup", () => { arrastrando = false; });

  img.onload = () => {
    const w = Math.min(window.innerWidth - 32, 480 - 32);
    canvas.width = w;
    canvas.height = Math.round(w * (img.naturalHeight / img.naturalWidth));
    redibujar();
  };

  const btnGenerar = el("button", {
    class: "btn-primario", disabled: true, onClick: generar,
  }, [t("explorar.generar")]) as HTMLButtonElement;

  function actualizarBoton() {
    // Exigir una selección mínima razonable (evita recortes de 3px por error)
    btnGenerar.disabled = !rect || rect.w < canvas.width * 0.12 || rect.h < canvas.height * 0.12;
  }

  function generar() {
    if (!rect) return;
    if (!confirm(t("explorar.confirm"))) return;
    const escX = img.naturalWidth / canvas.width;
    const escY = img.naturalHeight / canvas.height;
    const out = document.createElement("canvas");
    out.width = Math.round(rect.w * escX);
    out.height = Math.round(rect.h * escY);
    out.getContext("2d")!.drawImage(img,
      rect.x * escX, rect.y * escY, rect.w * escX, rect.h * escY,
      0, 0, out.width, out.height);
    out.toBlob((blob) => {
      if (!blob) { toast(t("explorar.toast.error_recorte")); return; }
      URL.revokeObjectURL(objectUrl);
      irA(() => pantallaProcessing({
        categoria: "explorar", detalle: "", tipo: "imagen", foto: blob, proyecto,
      }));
    }, "image/jpeg", 0.92);
  }

  render(
    el("div", { class: "screen" }, [
      el("div", { class: "topbar" }, [
        el("button", { class: "back", onClick: atras }, ["‹"]),
        el("span", { class: "topbar-tit" }, [t("explorar.titulo")]),
        el("span", { class: "beta-tag" }, ["Beta"]),
      ]),
      el("p", { class: "mask-hint" }, [t("explorar.hint")]),
      canvas,
      el("p", { class: "explorar-nota" }, [t("explorar.nota")]),
      btnGenerar,
    ])
  );
}
