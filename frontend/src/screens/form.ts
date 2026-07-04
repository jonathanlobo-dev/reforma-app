import { el, render, toast } from "../ui";
import { state } from "../state";
import { elegirFoto } from "../foto";
import { pantallaHome } from "./home";
import { pantallaProcessing } from "./processing";

export function pantallaForm(claveCat: string) {
  state.categoriaSel = claveCat;
  const cat = state.categorias[claveCat];
  let tipo: "imagen" | "video" = cat.tipo_default;

  const inputs = cat.campos.map((c) =>
    el("input", { class: "field", "data-clave": c.label, placeholder: c.ejemplo, type: "text" })
  );

  const miniatura = el("div", { class: "miniatura vacia" }, ["📷 Toca para elegir una foto"]);
  const refrescarMini = () => {
    if (state.foto) {
      miniatura.className = "miniatura";
      miniatura.innerHTML = "";
      miniatura.append(el("img", { src: state.foto.url }));
    }
  };
  refrescarMini();

  const btnFoto = el("button", { class: "btn-secundario", onClick: async () => {
    const f = await elegirFoto();
    if (f) { state.foto = f; refrescarMini(); }
  }}, ["Elegir foto"]);

  const toggle = el("div", { class: "toggle" }, [
    el("button", { class: "toggle-op" + (tipo === "imagen" ? " activo" : ""), onClick: (e: Event) => setTipo("imagen", e) }, ["Imagen · gratis"]),
    el("button", { class: "toggle-op" + (tipo === "video" ? " activo" : ""), onClick: (e: Event) => setTipo("video", e) }, ["Video · premium 🔒"]),
  ]);
  function setTipo(t: "imagen" | "video", e: Event) {
    tipo = t;
    toggle.querySelectorAll(".toggle-op").forEach((n) => n.classList.remove("activo"));
    (e.currentTarget as HTMLElement).classList.add("activo");
  }

  const enviar = () => {
    if (!state.foto) { toast("Primero elige una foto de tu espacio."); return; }
    const partes = inputs
      .map((i) => ({ label: i.getAttribute("data-clave")!, val: (i as HTMLInputElement).value.trim() }))
      .filter((p) => p.val);
    if (!partes.length) { toast("Escribe al menos qué quieres cambiar."); return; }
    const detalle = partes.map((p) => `${p.label}: ${p.val}.`).join(" ");
    pantallaProcessing({ categoria: claveCat, detalle, tipo, foto: state.foto.blob });
  };

  render(
    el("div", { class: "screen" }, [
      el("div", { class: "topbar" }, [
        el("button", { class: "back", onClick: pantallaHome }, ["‹ Atrás"]),
        el("span", { class: "topbar-tit" }, [`${cat.emoji} ${cat.titulo}`]),
      ]),
      miniatura,
      btnFoto,
      el("div", { class: "campos" }, inputs),
      el("label", { class: "lbl" }, ["¿Cómo lo quieres?"]),
      toggle,
      el("button", { class: "btn-primario", onClick: enviar }, ["Transformar ✨"]),
    ])
  );
}
