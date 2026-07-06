// "El Maestro" — chat asesor 3-en-1 (obra + decoración + materiales).
// El historial vive en memoria durante la sesión (se pierde al cerrar la app).
import { el, render, toast } from "../ui";
import { enviarAsesor, type MensajeChat } from "../api";
import { getDeviceId } from "../device";
import { setNavVisible, setNavTab } from "../nav";

const historia: MensajeChat[] = [];
let contextoActual: string | undefined;

const SALUDO =
  "¡Épale! Soy El Maestro 🧰 — maestro de obras, decorador y calculista, todo en uno. " +
  "Pregúntame cuánta pintura o cerámica necesitas, qué colores pegan, cómo distribuir " +
  "tu espacio, o qué hacer primero en una reforma.";

const SUGERENCIAS = [
  "¿Cuánta pintura para una pared de 3×4 m?",
  "¿Qué color combina con muebles de madera oscura?",
  "¿En qué orden hago una remodelación de cocina?",
];

export function pantallaAsesor(contexto?: string) {
  setNavVisible(true);
  setNavTab("asesor");
  if (contexto) contextoActual = contexto;

  const hilo = el("div", { class: "chat-hilo" });

  function burbuja(m: MensajeChat) {
    return el("div", { class: "chat-msg " + (m.role === "user" ? "yo" : "bot") }, [m.content]);
  }

  function pintarHilo() {
    hilo.innerHTML = "";
    hilo.append(burbuja({ role: "assistant", content: SALUDO }));
    if (contextoActual) {
      hilo.append(el("div", { class: "chat-ctx" }, [`📎 Sobre tu transformación: ${contextoActual}`]));
    }
    for (const m of historia) hilo.append(burbuja(m));
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

  const btnEnviar = el("button", { class: "chat-enviar", onClick: () => mandar(input.value) }, ["➤"]) as HTMLButtonElement;

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
      const resp = await enviarAsesor(deviceId, historia, contextoActual);
      historia.push({ role: "assistant", content: resp });
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
        el("span", { class: "chat-avatar" }, ["🧰"]),
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
