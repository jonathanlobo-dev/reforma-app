// Selector de idiomas. ES/EN completos; PT/IT re-exportan ES (Fase 1) hasta
// que la Fase 3 traduzca sus catálogos.
import { Preferences } from "@capacitor/preferences";
import { es } from "./i18n/es";
import { en } from "./i18n/en";
import { pt } from "./i18n/pt";
import { it } from "./i18n/it";

export type Idioma = "es" | "en" | "pt" | "it";

export const IDIOMAS: { codigo: Idioma; nombre: string }[] = [
  { codigo: "es", nombre: "Español" },
  { codigo: "en", nombre: "English" },
  { codigo: "pt", nombre: "Português" },
  { codigo: "it", nombre: "Italiano" },
];

const CATALOGOS: Record<Idioma, Record<string, string>> = { es, en, pt, it };
const KEY = "idioma";

let actual: Idioma = "es";

export function idioma(): Idioma {
  return actual;
}

/** Traduce `clave` al idioma actual, con fallback a ES y luego a la clave
 * cruda. `vars` reemplaza plantillas {token} en el texto. */
export function t(clave: string, vars?: Record<string, string | number>): string {
  const cat = CATALOGOS[actual] ?? es;
  let s = cat[clave] ?? es[clave] ?? clave;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

function detectarIdioma(): Idioma {
  const lang = (navigator.language || "es").toLowerCase();
  if (lang.startsWith("en")) return "en";
  if (lang.startsWith("pt")) return "pt";
  if (lang.startsWith("it")) return "it";
  return "es";
}

/** Reescribe los labels del nav inferior (viven en index.html, no en una
 * pantalla, así que no se re-renderizan solos con las demás vistas). */
export function aplicarIdiomaNav(): void {
  const nav = document.getElementById("bottom-nav");
  if (!nav) return;
  const mapa: Record<string, string> = {
    inicio: t("nav.inicio"),
    inspiracion: t("nav.inspiracion"),
    asesor: t("nav.asesor"),
    recientes: t("nav.recientes"),
  };
  nav.querySelectorAll(".nav-tab").forEach((btn) => {
    const tab = (btn as HTMLElement).dataset.tab || "";
    const label = btn.querySelector(".nav-label");
    if (label && mapa[tab]) label.textContent = mapa[tab];
  });
}

export async function initIdioma(): Promise<void> {
  let guardado: string | null = null;
  try {
    guardado = (await Preferences.get({ key: KEY })).value;
  } catch {
    guardado = localStorage.getItem(KEY);
  }
  const candidato = (guardado as Idioma) || detectarIdioma();
  actual = CATALOGOS[candidato] ? candidato : "es";
  aplicarIdiomaNav();
}

/** Cambia el idioma, lo persiste, y vuelve a Inicio ya re-renderizada.
 * Import dinámico de nav/home para no crear un ciclo de módulos (varias
 * pantallas importan `t`/`idioma` de aquí). */
export async function setIdioma(l: Idioma): Promise<void> {
  actual = l;
  try {
    await Preferences.set({ key: KEY, value: l });
  } catch {
    localStorage.setItem(KEY, l);
  }
  aplicarIdiomaNav();
  const { raiz } = await import("./nav");
  const { pantallaHome } = await import("./screens/home");
  raiz(pantallaHome);
}
