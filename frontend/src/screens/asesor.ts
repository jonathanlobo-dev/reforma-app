// "El Maestro" — chat asesor 3-en-1 (obra + decoración + materiales).
// El historial vive en memoria durante la sesión (se pierde al cerrar la app).
import { el, render, toast } from "../ui";
import { enviarAsesor, type MensajeChat } from "../api";
import { getDeviceId } from "../device";
import { irA, setNavVisible, setNavTab } from "../nav";
import { icon } from "../ui/icons";
import { state } from "../state";
import { pantallaForm } from "./form";

const historia: MensajeChat[] = [];
let contextoActual: string | undefined;

const SALUDO =
  "¡Épale! Soy El Maestro — maestro de obras, decorador y calculista, todo en uno. " +
  "Pregúntame cuánta pintura o cerámica necesitas, qué colores pegan, cómo distribuir " +
  "tu espacio, o qué hacer primero en una reforma.";

const SUGERENCIAS = [
  "¿Cuánta pintura para una pared de 3×4 m?",
  "¿Qué color combina con muebles de madera oscura?",
  "¿En qué orden hago una remodelación de cocina?",
];

// ─── Formato defensivo: el prompt pide texto plano, pero si el modelo emite
// markdown igual, lo convertimos a algo legible en vez de mostrar ** y ``` ───
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatearBot(txt: string): string {
  let t = esc(txt.trim());
  t = t.replace(/```[a-z]*\n?([\s\S]*?)```/g, (_m, c) => `<pre>${c.trim()}</pre>`);
  const lineas = t.split("\n").map((l) => {
    const s = l.trim();
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(s)) return ""; // separadores ---
    let x = l;
    x = x.replace(/^#{1,4}\s*(.+)$/, "<b>$1</b>");
    x = x.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    x = x.replace(/`([^`]+)`/g, "<code>$1</code>");
    x = x.replace(/^\s*[-*•]\s+/, "• ");
    return x;
  });
  return lineas.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function pantallaAsesor(contexto?: string) {
  setNavVisible(true);
  setNavTab("asesor");
  if (contexto) contextoActual = contexto;

  const hilo = el("div", { class: "chat-hilo" });

  function burbuja(m: MensajeChat) {
    if (m.role === "user") return el("div", { class: "chat-msg yo" }, [m.content]);
    return el("div", { class: "chat-msg bot", html: formatearBot(m.content) });
  }

  // Puente al generador: convierte lo conversado en una generación real.
  function accionGenerar(ultimoPedido: string) {
    return el("button", { class: "chat-accion", onClick: () => {
      const ok = confirm(
        "Se abrirá el generador con tu idea precargada. Al transformar " +
        "consumirás 1 de tus generaciones gratis del día. ¿Continuar?"
      );
      if (!ok) return;
      state.prefillExtra = ultimoPedido.slice(0, 300);
      irA(() => pantallaForm("remodelar"));
    }}, [icon("sparkles", 16), "Ver esto en mi espacio"]);
  }

  function pintarHilo() {
    hilo.innerHTML = "";
    hilo.append(burbuja({ role: "assistant", content: SALUDO }));
    if (contextoActual) {
      hilo.append(el("div", { class: "chat-ctx" }, [`Sobre tu transformación: ${contextoActual}`]));
    }
    for (const m of historia) hilo.append(burbuja(m));
    // Tras una respuesta del Maestro, ofrecer llevar la idea al generador
    const ultimoUser = [...historia].reverse().find((m) => m.role === "user");
    if (historia.length && historia[historia.length - 1].role === "assistant" && ultimoUser) {
      hilo.append(accionGenerar(ultimoUser.content));
    }
    if (!historia.length) {
      hilo.append(el("div", { class: "chat-sugerencias" },
        SUGERENCIAS.map((s) => el("button", { class: "chat-chip", onClick: () => mandar(s) }, [s]))));
    }
    requestAnimationFrame(() => { hilo.scrollTop = hilo.scrollHeight; });
  }

  const input = el("textarea", {
    class: "chat-input", rows: 1, placeholder: "Pregúntale al Maestro…",
  }) as HTMLTextAreaElement;
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); mandar(input.value); }
  });

  const btnEnviar = el("button", { class: "chat-enviar", onClick: () => mandar(input.value) },
    [icon("send", 18)]) as HTMLButtonElement;

  let ocupado = false;
  async function mandar(texto: string) {
    texto = texto.trim();
    if (!texto || ocupado) return;
    ocupado = true;
    btnEnviar.disabled = true;
    input.value = "";
    historia.push({ role: "user", content: texto });
    pintarHilo();
    const escribiendo = el("div", { class: "chat-msg bot escribiendo" }, ["El Maestro está escribiendo…"]);
    hilo.append(escribiendo);
    hilo.scrollTop = hilo.scrollHeight;
    try {
      const deviceId = await getDeviceId();
      // Solo los últimos 12 turnos viajan por red (el backend recorta igual);
      // y el historial en memoria se acota para sesiones largas.
      const resp = await enviarAsesor(deviceId, historia.slice(-12), contextoActual);
      historia.push({ role: "assistant", content: resp });
      if (historia.length > 60) historia.splice(0, historia.length - 60);
    } catch (e) {
      historia.pop(); // no contar el mensaje fallido
      toast((e as Error).message);
    }
    ocupado = false;
    btnEnviar.disabled = false;
    pintarHilo();
  }

  render(
    el("div", { class: "screen chat-screen" }, [
      el("div", { class: "chat-header" }, [
        el("span", { class: "chat-avatar" }, [icon("tool", 22)]),
        el("div", {}, [
          el("div", { class: "chat-nombre" }, ["El Maestro"]),
          el("div", { class: "chat-sub" }, ["Obra · Decoración · Materiales"]),
        ]),
      ]),
      hilo,
      el("div", { class: "chat-barra" }, [input, btnEnviar]),
    ])
  );
  pintarHilo();
}
