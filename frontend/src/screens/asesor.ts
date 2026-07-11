// "El Maestro" — chat asesor 3-en-1 (obra + decoración + materiales).
// El historial vive en memoria durante la sesión (se pierde al cerrar la app).
import { el, render, toast } from "../ui";
import { enviarAsesor, type MensajeChat } from "../api";
import { getDeviceId } from "../device";
import { irA, setNavVisible, setNavTab } from "../nav";
import { icon } from "../ui/icons";
import { state } from "../state";
import { pantallaForm } from "./form";
import { t } from "../i18n";

const historia: MensajeChat[] = [];
let contextoActual: string | undefined;

// ─── Formato defensivo: el prompt pide texto plano, pero si el modelo emite
// markdown igual, lo convertimos a algo legible en vez de mostrar ** y ``` ───
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatearBot(txt: string): string {
  let out = esc(txt.trim());
  out = out.replace(/```[a-z]*\n?([\s\S]*?)```/g, (_m, c) => `<pre>${c.trim()}</pre>`);
  const lineas = out.split("\n").map((l) => {
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
      const ok = confirm(t("asesor.confirm_generar"));
      if (!ok) return;
      state.prefillExtra = ultimoPedido.slice(0, 300);
      irA(() => pantallaForm("remodelar"));
    }}, [icon("sparkles", 16), t("asesor.ver_espacio")]);
  }

  function pintarHilo() {
    hilo.innerHTML = "";
    hilo.append(burbuja({ role: "assistant", content: t("asesor.saludo", { nombre: t("asesor.nombre") }) }));
    if (contextoActual) {
      hilo.append(el("div", { class: "chat-ctx" }, [t("asesor.sobre_transformacion", { c: contextoActual })]));
    }
    for (const m of historia) hilo.append(burbuja(m));
    // Tras una respuesta del Maestro, ofrecer llevar la idea al generador
    const ultimoUser = [...historia].reverse().find((m) => m.role === "user");
    if (historia.length && historia[historia.length - 1].role === "assistant" && ultimoUser) {
      hilo.append(accionGenerar(ultimoUser.content));
    }
    if (!historia.length) {
      const sugerencias = [t("asesor.sugerencia.1"), t("asesor.sugerencia.2"), t("asesor.sugerencia.3")];
      hilo.append(el("div", { class: "chat-sugerencias" },
        sugerencias.map((s) => el("button", { class: "chat-chip", onClick: () => mandar(s) }, [s]))));
    }
    requestAnimationFrame(() => { hilo.scrollTop = hilo.scrollHeight; });
  }

  const input = el("textarea", {
    class: "chat-input", rows: 1, placeholder: t("asesor.placeholder"),
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
    const escribiendo = el("div", { class: "chat-msg bot escribiendo" }, [t("asesor.escribiendo", { nombre: t("asesor.nombre") })]);
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
          el("div", { class: "chat-nombre" }, [t("asesor.nombre")]),
          el("div", { class: "chat-sub" }, [t("asesor.subtitulo")]),
        ]),
      ]),
      hilo,
      el("div", { class: "chat-barra" }, [input, btnEnviar]),
    ])
  );
  pintarHilo();
}
