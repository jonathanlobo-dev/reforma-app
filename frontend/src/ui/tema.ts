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
}
