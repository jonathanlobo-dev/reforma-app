import { toast } from "./ui";

type Pantalla = () => void;

const stack: Pantalla[] = [];
let ultimoBack = 0;

/** Reinicia el historial dejando `p` como raíz (ej. la Home). */
export function raiz(p: Pantalla) {
  stack.length = 0;
  stack.push(p);
  p();
}

/** Navega a una nueva pantalla (se puede volver con atrás). */
export function irA(p: Pantalla) {
  stack.push(p);
  p();
}

/** Sustituye la pantalla actual (no deja rastro en el historial). */
export function reemplazar(p: Pantalla) {
  stack[stack.length - 1] = p;
  p();
}

/** Vuelve atrás; en la raíz pide doble toque para salir. */
export function atras() {
  if (stack.length > 1) {
    stack.pop();
    stack[stack.length - 1]();
  } else {
    const ahora = Date.now();
    if (ahora - ultimoBack < 2000) {
      salir();
    } else {
      ultimoBack = ahora;
      toast("Presiona atrás otra vez para salir");
    }
  }
}

async function salir() {
  try {
    const { App } = await import("@capacitor/app");
    await App.exitApp();
  } catch {
    /* en web no se puede cerrar; se ignora */
  }
}

/** Muestra u oculta la barra de navegación inferior. */
export function setNavVisible(visible: boolean) {
  const nav = document.getElementById("bottom-nav");
  if (!nav) return;
  if (visible) nav.classList.remove("hidden");
  else nav.classList.add("hidden");
}

/** Marca el tab activo en la barra inferior. */
export function setNavTab(tab: string) {
  const nav = document.getElementById("bottom-nav");
  if (!nav) return;
  nav.querySelectorAll(".nav-tab").forEach((t) => {
    (t as HTMLElement).classList.toggle("activo", (t as HTMLElement).dataset.tab === tab);
  });
}

/** Conecta el botón/gesto atrás de Android a nuestra navegación. */
export async function initBack() {
  try {
    const { App } = await import("@capacitor/app");
    await App.addListener("backButton", () => atras());
  } catch {
    /* en web no hay backButton nativo */
  }
}
