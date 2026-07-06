// Ajustes: cómo usar, límites/créditos, descargo de responsabilidad.
import { el, render } from "../ui";
import { atras, setNavVisible } from "../nav";

const VERSION = "2.0";

function seccion(titulo: string, contenido: (Node | string)[]) {
  const cuerpo = el("div", { class: "aj-cuerpo" }, contenido);
  cuerpo.style.display = "none";
  const cab = el("button", { class: "aj-cab", onClick: () => {
    const abierto = cuerpo.style.display !== "none";
    cuerpo.style.display = abierto ? "none" : "block";
    flecha.textContent = abierto ? "▸" : "▾";
  }}, [el("span", {}, [titulo])]);
  const flecha = el("span", { class: "aj-flecha" }, ["▸"]);
  cab.append(flecha);
  return el("div", { class: "aj-seccion" }, [cab, cuerpo]);
}

function p(texto: string) { return el("p", { class: "aj-p" }, [texto]); }
function li(items: string[]) {
  return el("ul", { class: "aj-ul" }, items.map((i) => el("li", {}, [i])));
}

export function pantallaAjustes() {
  setNavVisible(false);

  render(
    el("div", { class: "screen" }, [
      el("div", { class: "topbar" }, [
        el("button", { class: "back", onClick: atras }, ["‹"]),
        el("span", { class: "topbar-tit" }, ["Ajustes"]),
      ]),

      seccion("Cómo usar la app", [
        p("1. Elige un modo en Inicio (pintar, remodelar, pincel mágico…)."),
        p("2. Sube una foto clara y bien iluminada de tu espacio. Mientras mejor la foto, mejor el resultado."),
        p("3. Sé específico: di QUÉ cambiar y QUÉ conservar. La IA no adivina."),
        li([
          "✅ \"Pared perimetral de bloques donde está la cerca de alambre, quitar el monte, poner grama y una piscina. No tocar las casas vecinas.\"",
          "❌ \"una piscina\" (la IA inventará todo lo demás)",
        ]),
        p("4. Con el Pincel mágico, pinta con el dedo SOLO la zona que quieres cambiar."),
        p("5. ¿Dudas de materiales o colores? Pregúntale a El Maestro en la pestaña central."),
      ]),

      seccion("Límites diarios (gratis)", [
        p("Cada generación usa modelos de IA que tienen costo real. El plan gratuito incluye por día:"),
        li([
          "5 transformaciones de imagen",
          "1 video de transformación",
          "30 mensajes con El Maestro",
        ]),
        p("Los límites se reinician cada día. Pronto habrá un plan Pro con más generaciones, videos y sin marca de agua."),
      ]),

      seccion("Descargo de responsabilidad", [
        p("Las imágenes y videos de esta app son generados por inteligencia artificial y son VISUALIZACIONES CONCEPTUALES, no diseños técnicos ni planos de construcción."),
        li([
          "No sustituyen la asesoría de arquitectos, ingenieros o profesionales certificados.",
          "Las proporciones, materiales y estructuras mostradas pueden no ser exactas ni viables técnicamente.",
          "Los cálculos y precios de El Maestro son estimados de referencia: confirma siempre cantidades y costos con tu ferretería y tu contratista.",
          "Para trabajos eléctricos, de gas o estructurales, contrata siempre un profesional certificado.",
        ]),
        p("Al usar la app aceptas que las decisiones de construcción o remodelación son tu responsabilidad."),
      ]),

      seccion("Acerca de", [
        p(`Reforma AI v${VERSION}`),
        p("Transforma fotos de tus espacios reales con inteligencia artificial: pintar, remodelar, restaurar, y míralo en video."),
        p("Hecho con cariño en Venezuela."),
      ]),
    ])
  );
}
