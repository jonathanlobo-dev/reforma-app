// Tema claro/oscuro/sistema. "sistema" no fija data-theme en <html>: manda el
// @media (prefers-color-scheme) de styles.css. "claro"/"oscuro" fijan
// data-theme, que gana sobre el @media (override manual del usuario).
export type Tema = "sistema" | "claro" | "oscuro";

const CLAVE = "tema";

export function temaActual(): Tema {
  const guardado = localStorage.getItem(CLAVE);
  if (guardado === "claro" || guardado === "oscuro" || guardado === "sistema") {
    return guardado;
  }
  return "sistema";
}

export function aplicarTema(t: Tema): void {
  const html = document.documentElement;
  if (t === "sistema") {
    html.removeAttribute("data-theme");
  } else {
    html.setAttribute("data-theme", t === "claro" ? "light" : "dark");
  }
  localStorage.setItem(CLAVE, t);
  void sincronizarBarrasSistema();
}

// ─── Barras del sistema (Android) siguen el tema ────────────────────────────
// Bug reportado: en tema CLARO la barra de estado y la de navegación se
// quedaban oscuras (fijas en el nativo, sin escuchar el tema de la app). Se
// sincronizan aquí: la de estado con @capacitor/status-bar, la de navegación
// con un plugin nativo mínimo (NavigationBar, ver android/.../MainActivity.java).
function esClaroEfectivo(): boolean {
  const t = temaActual();
  if (t === "claro") return true;
  if (t === "oscuro") return false;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ?? false;
}

// Mismos colores que --bg/--surface en styles.css. La barra de ESTADO usa
// --bg (fondo de pantalla); la de NAVEGACIÓN usa --surface (color de la
// barra de pestañas), igual que ya hacía el nativo por defecto para que no
// se note un escalón de color al pie de la pantalla.
const COLORES_BARRAS = {
  dark: { bg: "#0c0c10", surface: "#17181f" },
  light: { bg: "#f4f3f7", surface: "#ffffff" },
};

interface NavigationBarPlugin { setStyle(o: { color: string; light: boolean }): Promise<void>; }
let navBarPlugin: NavigationBarPlugin | null = null;

async function sincronizarBarrasSistema(): Promise<void> {
  try {
    const { Capacitor, registerPlugin } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    const claro = esClaroEfectivo();
    const c = claro ? COLORES_BARRAS.light : COLORES_BARRAS.dark;

    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: claro ? Style.Light : Style.Dark });
    await StatusBar.setBackgroundColor({ color: c.bg });

    if (!navBarPlugin) navBarPlugin = registerPlugin<NavigationBarPlugin>("NavigationBar");
    await navBarPlugin.setStyle({ color: c.surface, light: claro });
  } catch {
    // Sin plugin nativo compilado (ej. previsualización web) o fallo puntual:
    // no rompe el tema en pantalla, solo se queda sin sincronizar las barras.
  }
}

// "sistema" depende de prefers-color-scheme: si el SO cambia de tema con la
// app abierta, las barras deben seguirlo también, no solo al reabrir.
if (typeof window !== "undefined" && window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
    if (temaActual() === "sistema") void sincronizarBarrasSistema();
  });
}
