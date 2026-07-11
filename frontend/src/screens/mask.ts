// Pantalla de pincel: el usuario pinta sobre su foto la zona a cambiar.
// Exporta una máscara PNG blanco/negro al tamaño REAL de la foto
// (blanco = zona a cambiar, negro = conservar — convención flux-fill).
import { el, render, toast } from "../ui";
import { atras, setNavVisible } from "../nav";
import { t } from "../i18n";

interface Trazo { pts: { x: number; y: number }[]; size: number; erase: boolean; }

export function pantallaMask(fotoUrl: string, onListo: (mask: Blob) => void) {
  setNavVisible(false);

  let brushSize = 36;          // px en pantalla
  let erasing = false;
  const trazos: Trazo[] = [];
  let trazoActual: Trazo | null = null;

  const img = new Image();
  img.src = fotoUrl;

  // Canvas visible (foto + pintura roja translúcida)
  const canvas = el("canvas", { class: "mask-canvas" }) as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;

  function pintarTrazos(c: CanvasRenderingContext2D, escala: number, color: string) {
    for (const t of trazos.concat(trazoActual ? [trazoActual] : [])) {
      c.globalCompositeOperation = t.erase ? "destination-out" : "source-over";
      c.strokeStyle = color;
      c.fillStyle = color;
      c.lineWidth = t.size * escala;
      c.lineCap = "round";
      c.lineJoin = "round";
      if (t.pts.length === 1) {
        c.beginPath();
        c.arc(t.pts[0].x * escala, t.pts[0].y * escala, (t.size / 2) * escala, 0, Math.PI * 2);
        c.fill();
      } else {
        c.beginPath();
        c.moveTo(t.pts[0].x * escala, t.pts[0].y * escala);
        for (const p of t.pts.slice(1)) c.lineTo(p.x * escala, p.y * escala);
        c.stroke();
      }
    }
    c.globalCompositeOperation = "source-over";
  }

  // La pintura vive en una capa aparte para componer con alpha limpio.
  // La capa se REUTILIZA entre frames: crear un canvas por cada pointermove
  // producía lag y presión de GC en teléfonos de gama baja.
  const capa = document.createElement("canvas");
  const cctx = capa.getContext("2d")!;
  function redibujarConCapa() {
    if (!img.complete || !img.naturalWidth) return;
    if (capa.width !== canvas.width || capa.height !== canvas.height) {
      capa.width = canvas.width; capa.height = canvas.height;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    cctx.clearRect(0, 0, capa.width, capa.height);
    pintarTrazos(cctx, 1, "#ff3b5c");
    ctx.globalAlpha = 0.55;
    ctx.drawImage(capa, 0, 0);
    ctx.globalAlpha = 1;
  }

  function coords(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top) * (canvas.height / r.height),
    };
  }

  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    trazoActual = { pts: [coords(e)], size: brushSize, erase: erasing };
    redibujarConCapa();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!trazoActual) return;
    trazoActual.pts.push(coords(e));
    redibujarConCapa();
  });
  canvas.addEventListener("pointerup", () => {
    if (trazoActual) { trazos.push(trazoActual); trazoActual = null; actualizarUndo(); }
  });

  img.onload = () => {
    // Canvas al ancho disponible, respetando el aspecto de la foto
    const w = Math.min(window.innerWidth - 32, 480 - 32);
    canvas.width = w;
    canvas.height = Math.round(w * (img.naturalHeight / img.naturalWidth));
    redibujarConCapa();
  };

  // ── Toolbar ──────────────────────────────────────────────────────────────
  const btnPincel = el("button", { class: "tool-btn activo", onClick: () => setTool(false) }, [t("mask.pincel")]);
  const btnBorrar = el("button", { class: "tool-btn", onClick: () => setTool(true) }, [t("mask.borrador")]);
  const btnUndo = el("button", { class: "tool-btn", disabled: true, onClick: deshacer }, [t("mask.deshacer")]);

  function setTool(erase: boolean) {
    erasing = erase;
    btnPincel.classList.toggle("activo", !erase);
    btnBorrar.classList.toggle("activo", erase);
  }
  function deshacer() {
    trazos.pop();
    redibujarConCapa();
    actualizarUndo();
  }
  function actualizarUndo() {
    (btnUndo as HTMLButtonElement).disabled = trazos.length === 0;
  }

  const slider = el("input", {
    type: "range", min: "12", max: "80", value: String(brushSize), class: "mask-slider",
    onInput: (e: Event) => { brushSize = Number((e.target as HTMLInputElement).value); },
  });

  const continuar = () => {
    if (!trazos.length) { toast(t("mask.toast.pinta")); return; }
    // Exportar máscara B/N al tamaño REAL de la foto
    const out = document.createElement("canvas");
    out.width = img.naturalWidth; out.height = img.naturalHeight;
    const octx = out.getContext("2d")!;
    octx.fillStyle = "#000";
    octx.fillRect(0, 0, out.width, out.height);
    pintarTrazos(octx, img.naturalWidth / canvas.width, "#fff");
    out.toBlob((blob) => {
      if (blob) onListo(blob);
      else toast(t("mask.toast.error"));
    }, "image/png");
  };

  render(
    el("div", { class: "screen" }, [
      el("div", { class: "topbar" }, [
        el("button", { class: "back", onClick: atras }, ["‹"]),
        el("span", { class: "topbar-tit" }, [t("mask.titulo")]),
      ]),
      el("p", { class: "mask-hint" }, [t("mask.hint")]),
      canvas,
      el("div", { class: "mask-tools" }, [btnPincel, btnBorrar, btnUndo]),
      el("div", { class: "ctrl-wrap" }, [
        el("div", { class: "ctrl-label" }, [t("mask.tamano")]),
        slider,
      ]),
      el("button", { class: "btn-primario", onClick: continuar }, [t("mask.continuar")]),
    ])
  );
}
