// Documentos legales mostrados DENTRO de la app (no sale al navegador). El
// texto va embebido en frontend/src/legal/ para no depender de red ni del
// cold-start de Render. Se muestra en el idioma activo, con el mismo tema
// (claro/oscuro) del resto de la app. La URL pública sigue existiendo aparte
// (Google la exige en la ficha de Play Console); esta pantalla es un espejo.
import { el, render } from "../ui";
import { atras, setNavVisible } from "../nav";
import { t, idioma } from "../i18n";
import { PRIVACIDAD, type DocLegal } from "../legal/privacidad";

function pantallaDoc(doc: DocLegal) {
  setNavVisible(false);
  render(
    el("div", { class: "screen legal" }, [
      el("div", { class: "topbar" }, [
        el("button", { class: "back", onClick: atras }, ["‹"]),
        el("span", { class: "topbar-tit" }, [t("ajustes.sec.acerca.privacidad")]),
      ]),
      el("div", { class: "legal-cuerpo" }, [
        el("h1", { class: "legal-tit" }, [doc.titulo]),
        el("p", { class: "legal-fecha" }, [doc.fecha]),
        el("p", { class: "legal-p" }, [doc.intro]),
        ...doc.secciones.flatMap((s) => [
          el("h2", { class: "legal-h2" }, [s.h2]),
          ...(s.parrafos ?? []).map((p) => el("p", { class: "legal-p" }, [p])),
          ...(s.items ? [el("ul", { class: "legal-ul" }, s.items.map((i) => el("li", {}, [i])))] : []),
        ]),
      ]),
    ])
  );
}

export function pantallaPrivacidad() {
  pantallaDoc(PRIVACIDAD[idioma()] ?? PRIVACIDAD.es);
}
