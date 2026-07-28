// "Medir espacio": mide distancias y áreas reales sobre una foto.
//
// Se mide SIEMPRE sobre la foto original del usuario, nunca sobre un resultado
// generado (la IA inventa la geometría, así que medir ahí daría números falsos).
// El método es una homografía a partir de una referencia de medida conocida
// (ver medicion.ts): solo es válido para lo que esté en el mismo plano.
import { el, render, toast } from "../ui";
import { atras, irA, setNavVisible } from "../nav";
import { icon } from "../ui/icons";
import { elegirFoto } from "../foto";
import { pantallaAsesor } from "./asesor";
import { t } from "../i18n";
import {
  homografia, distancia, area, perimetro, fmtM,
  type Homografia, type Punto,
} from "../medicion";

interface Referencia { slug: string; labelKey: string; ancho: number; alto: number; }

// Objetos de medida estándar que la gente tiene a mano. El bloque de
// construcción es la referencia más útil en obra en Venezuela.
const REFERENCIAS: Referencia[] = [
  { slug: "puerta", labelKey: "medir.ref.puerta", ancho: 0.80, alto: 2.03 },
  { slug: "bloque", labelKey: "medir.ref.bloque", ancho: 0.40, alto: 0.20 },
  { slug: "baldosa", labelKey: "medir.ref.baldosa", ancho: 0.30, alto: 0.30 },
  { slug: "carta", labelKey: "medir.ref.carta", ancho: 0.216, alto: 0.279 },
];

export function pantallaMedir() {
  setNavVisible(false);

  let img: HTMLImageElement | null = null;
  let paso: "referencia" | "medir" = "referencia";
  let refPts: Punto[] = [];
  let medPts: Punto[] = [];
  let H: Homografia | null = null;
  // Metros → cm redondeando a 1 decimal: 2.03*100 da 202.99999999999997 en
  // coma flotante y eso se vería tal cual en el campo.
  const aCm = (m: number) => Math.round(m * 1000) / 10;

  let refSel = REFERENCIAS[0];
  let anchoCm = aCm(refSel.ancho);
  let altoCm = aCm(refSel.alto);

  const canvas = el("canvas", { class: "mask-canvas" }) as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  canvas.style.touchAction = "none";

  // ── Dibujo ────────────────────────────────────────────────────────────────
  function marcador(p: Punto, n: number, color: string) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n), p.x, p.y);
  }

  function polilinea(pts: Punto[], color: string, cerrar: boolean) {
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    if (cerrar) ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    if (cerrar && pts.length >= 3) {
      ctx.fillStyle = color.replace(")", ", 0.18)").replace("rgb", "rgba");
      ctx.fill();
    }
  }

  /** Etiqueta con la medida sobre el punto medio de cada segmento. */
  function etiquetasSegmentos(pts: Punto[], cerrar: boolean) {
    if (!H) return;
    const n = cerrar ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const txt = fmtM(distancia(H, a, b));
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      ctx.font = "bold 13px system-ui, sans-serif";
      const w = ctx.measureText(txt).width + 12;
      ctx.fillStyle = "rgba(12,12,16,0.85)";
      ctx.beginPath();
      // roundRect no existe en WebViews antiguos (minSdk 22): se cae a un
      // rectángulo normal en vez de romper el dibujo entero.
      if (typeof (ctx as any).roundRect === "function") {
        (ctx as any).roundRect(mx - w / 2, my - 11, w, 22, 11);
      } else {
        ctx.rect(mx - w / 2, my - 11, w, 22);
      }
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(txt, mx, my);
    }
  }

  function redibujar() {
    if (!img || !img.complete || !img.naturalWidth) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    polilinea(refPts, "rgb(139,92,246)", refPts.length === 4);
    refPts.forEach((p, i) => marcador(p, i + 1, "#8b5cf6"));
    if (paso === "medir") {
      polilinea(medPts, "rgb(55,214,122)", medPts.length >= 3);
      medPts.forEach((p, i) => marcador(p, i + 1, "#37d67a"));
      etiquetasSegmentos(medPts, medPts.length >= 3);
    }
  }

  // ── Interacción ───────────────────────────────────────────────────────────
  function coords(e: PointerEvent): Punto {
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(canvas.width, (e.clientX - r.left) * (canvas.width / r.width))),
      y: Math.max(0, Math.min(canvas.height, (e.clientY - r.top) * (canvas.height / r.height))),
    };
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (!img) return;
    const p = coords(e);
    if (paso === "referencia") {
      if (refPts.length >= 4) return;
      refPts.push(p);
      if (refPts.length === 4) calcularH();
    } else {
      medPts.push(p);
    }
    redibujar();
    refrescar();
  });

  function calcularH() {
    const a = anchoCm / 100, b = altoCm / 100;
    // Las 4 esquinas se marcan recorriendo el borde: 1→(0,0) 2→(ancho,0)
    // 3→(ancho,alto) 4→(0,alto).
    H = homografia(refPts, [{ x: 0, y: 0 }, { x: a, y: 0 }, { x: a, y: b }, { x: 0, y: b }]);
    if (!H) {
      toast(t("medir.toast.degenerado"));
      refPts = [];
      return;
    }
    paso = "medir";
  }

  function deshacer() {
    if (paso === "medir" && medPts.length) {
      medPts.pop();
    } else if (paso === "medir") {
      paso = "referencia"; H = null; refPts.pop();
    } else {
      refPts.pop();
    }
    redibujar();
    refrescar();
  }

  function reiniciar() {
    refPts = []; medPts = []; H = null; paso = "referencia";
    redibujar();
    refrescar();
  }

  // ── Foto ──────────────────────────────────────────────────────────────────
  const fotoZone = el("div", { class: "foto-zone", onClick: pedirFoto }, [
    icon("camera", 34), el("span", {}, [t("medir.elige_foto")]),
  ]);

  async function pedirFoto() {
    const f = await elegirFoto();
    if (!f) return;
    const im = new Image();
    im.onload = () => {
      img = im;
      const w = Math.min(window.innerWidth - 32, 480 - 32);
      canvas.width = w;
      canvas.height = Math.round(w * (im.naturalHeight / im.naturalWidth));
      // Con foto cargada, la zona de "elegir" pasa a ser un botón discreto y
      // aparecen el lienzo y los controles.
      fotoZone.classList.add("compacta");
      fotoZone.replaceChildren(icon("camera", 18), el("span", {}, [t("medir.otra_foto")]));
      canvas.style.display = "";
      refControles.style.display = "";
      reiniciar();
    };
    im.src = f.url;
  }

  // ── Controles de la referencia ────────────────────────────────────────────
  const selRef = el("select", { class: "field", onChange: (e: Event) => {
    const v = (e.target as HTMLSelectElement).value;
    const r = REFERENCIAS.find((x) => x.slug === v);
    if (r) { refSel = r; anchoCm = aCm(r.ancho); altoCm = aCm(r.alto); }
    if (refPts.length === 4) calcularH();   // recalcular si ya estaba medido
    redibujar(); refrescar();
  } }, REFERENCIAS.map((r) =>
    el("option", { value: r.slug }, [`${t(r.labelKey)} · ${Math.round(r.ancho * 100)}×${Math.round(r.alto * 100)} cm`])
  ).concat([el("option", { value: "custom" }, [t("medir.ref.custom")])])) as HTMLSelectElement;

  const inAncho = el("input", { class: "field", type: "number", inputmode: "decimal", min: "1",
    value: String(anchoCm), onInput: (e: Event) => {
      anchoCm = parseFloat((e.target as HTMLInputElement).value) || 0;
      if (refPts.length === 4) { calcularH(); redibujar(); refrescar(); }
    } }) as HTMLInputElement;
  const inAlto = el("input", { class: "field", type: "number", inputmode: "decimal", min: "1",
    value: String(altoCm), onInput: (e: Event) => {
      altoCm = parseFloat((e.target as HTMLInputElement).value) || 0;
      if (refPts.length === 4) { calcularH(); redibujar(); refrescar(); }
    } }) as HTMLInputElement;

  selRef.addEventListener("change", () => {
    inAncho.value = String(anchoCm);
    inAlto.value = String(altoCm);
  });

  // ── Panel de resultado ────────────────────────────────────────────────────
  const panel = el("div", { class: "medir-panel" });
  const instruccion = el("p", { class: "medir-instr" });
  const acciones = el("div", { class: "medir-acciones" });

  function resumenTexto(): string {
    if (!H || medPts.length < 2) return "";
    if (medPts.length === 2) {
      return t("medir.ctx.distancia", { v: fmtM(distancia(H, medPts[0], medPts[1])) });
    }
    return t("medir.ctx.area", {
      a: area(H, medPts).toFixed(2),
      p: fmtM(perimetro(H, medPts)),
    });
  }

  function refrescar() {
    // Instrucción según el paso
    if (!img) instruccion.textContent = "";
    else if (paso === "referencia") {
      instruccion.textContent = t("medir.instr.referencia", { n: String(refPts.length) });
    } else if (medPts.length < 2) {
      instruccion.textContent = t("medir.instr.medir");
    } else {
      instruccion.textContent = t("medir.instr.mas_puntos");
    }

    // Resultado
    panel.replaceChildren();
    if (H && medPts.length >= 2) {
      const esArea = medPts.length >= 3;
      const principal = esArea
        ? `${area(H, medPts).toFixed(2)} m²`
        : fmtM(distancia(H, medPts[0], medPts[1]));
      panel.append(
        el("div", { class: "medir-dato" }, [
          el("b", {}, [principal]),
          el("span", {}, [esArea ? t("medir.area") : t("medir.distancia")]),
        ]),
        ...(esArea ? [el("div", { class: "medir-dato sec" }, [
          el("b", {}, [fmtM(perimetro(H, medPts))]),
          el("span", {}, [t("medir.perimetro")]),
        ])] : []),
      );
    }

    // Acciones
    acciones.replaceChildren();
    if (img) {
      acciones.append(
        el("button", { class: "btn-secundario btn-ico", onClick: deshacer,
          disabled: !refPts.length && !medPts.length } as any, [icon("refresh", 15), t("medir.deshacer")]),
        el("button", { class: "btn-secundario", onClick: reiniciar }, [t("medir.reiniciar")]),
      );
      if (H && medPts.length >= 2) {
        acciones.append(el("button", { class: "btn-primario btn-ico", onClick: () => {
          irA(() => pantallaAsesor(t("medir.ctx.prefijo") + " " + resumenTexto()));
        } }, [icon("tool", 16), t("medir.preguntar")]));
      }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  // Ocultos hasta que haya foto: sin imagen no hay nada que marcar.
  canvas.style.display = "none";
  const refControles = el("div", { class: "ctrl-stack" }, [
    el("div", { class: "ctrl-label" }, [t("medir.ref.label")]),
    selRef,
    el("div", { class: "medir-medidas" }, [
      el("label", {}, [t("medir.ancho_cm"), inAncho]),
      el("label", {}, [t("medir.alto_cm"), inAlto]),
    ]),
  ]);
  refControles.style.display = "none";

  render(
    el("div", { class: "screen" }, [
      el("div", { class: "topbar" }, [
        el("button", { class: "back", onClick: atras }, ["‹"]),
        el("span", { class: "topbar-tit" }, [t("medir.titulo")]),
      ]),
      el("p", { class: "form-hint" }, [t("medir.hint")]),
      fotoZone,
      canvas,
      instruccion,
      refControles,
      panel,
      acciones,
      el("p", { class: "medir-aviso" }, [t("medir.aviso")]),
    ])
  );
  refrescar();
}
