// Pantalla de suscripción (paywall). Visual completo; el COBRO real se conecta
// después con RevenueCat + Google Play Billing (ver TODO abajo).
import { el, render, toast } from "../ui";
import { atras, setNavVisible } from "../nav";
import { icon } from "../ui/icons";
import { API_BASE } from "../config";
import { t } from "../i18n";

interface Plan {
  id: string; etiquetaKey: string; tituloKey: string; subKey: string; precio: string;
  destacado?: boolean; badgeKey?: string;
}

const PLANES: Plan[] = [
  { id: "vida", etiquetaKey: "paywall.plan.vida.etiqueta", tituloKey: "paywall.plan.vida.titulo", subKey: "paywall.plan.vida.sub", precio: "USD 49,99" },
  { id: "anual", etiquetaKey: "paywall.plan.anual.etiqueta", tituloKey: "paywall.plan.anual.titulo", subKey: "paywall.plan.anual.sub", precio: "USD 29,99", destacado: true, badgeKey: "paywall.plan.anual.badge" },
  { id: "semanal", etiquetaKey: "paywall.plan.semanal.etiqueta", tituloKey: "paywall.plan.semanal.titulo", subKey: "paywall.plan.semanal.sub", precio: "USD 4,99" },
];

const BENEFICIOS: { ico: string; key: string }[] = [
  { ico: "grid", key: "paywall.beneficio.1" },
  { ico: "sparkles", key: "paywall.beneficio.2" },
  { ico: "image", key: "paywall.beneficio.3" },
  { ico: "eyeoff", key: "paywall.beneficio.4" },
  { ico: "brush", key: "paywall.beneficio.5" },
];

// `alCerrar` se usa cuando el paywall sale al abrir la app: la X debe llevar a
// Inicio (y mostrar un anuncio), no intentar salir de la app.
export function pantallaPaywall(opciones: { alCerrar?: () => void } = {}) {
  setNavVisible(false);
  const cerrar = opciones.alCerrar ?? atras;
  let planSel = "anual";

  const tarjetas = PLANES.map((p) =>
    el("button", {
      class: "plan-card" + (p.id === planSel ? " sel" : "") + (p.destacado ? " destacado" : ""),
      "data-plan": p.id,
      onClick: () => { planSel = p.id; refrescarPlanes(); },
    }, [
      ...(p.badgeKey ? [el("div", { class: "plan-badge" }, [t(p.badgeKey)])] : []),
      el("div", { class: "plan-etiqueta" }, [t(p.etiquetaKey)]),
      el("div", { class: "plan-titulo" }, [t(p.tituloKey)]),
      el("div", { class: "plan-sub" }, [t(p.subKey)]),
      el("div", { class: "plan-precio" }, [p.precio]),
    ])
  );

  function refrescarPlanes() {
    tarjetas.forEach((c) => c.classList.toggle("sel", (c as HTMLElement).dataset.plan === planSel));
  }

  const suscribir = () => {
    // TODO(pagos): aquí se llamará a RevenueCat (Purchases.purchasePackage) con
    // el paquete correspondiente a planSel; al confirmar la compra, RevenueCat
    // valida con Google Play y el backend marca premium (db.activar_premium).
    toast(t("paywall.toast_pagos"));
  };

  render(
    el("div", { class: "screen paywall" }, [
      el("button", { class: "paywall-x", onClick: cerrar }, [icon("close", 20)]),

      el("div", { class: "paywall-hero" }, [
        el("div", { class: "paywall-hero-img" }),
        el("div", { class: "paywall-hero-grad" }),
        el("div", { class: "paywall-hero-txt" }, [
          el("div", { class: "paywall-corona" }, [icon("crown", 30)]),
          el("h1", {}, [t("paywall.titulo")]),
          el("p", {}, [t("paywall.sub")]),
        ]),
      ]),

      el("div", { class: "paywall-beneficios" },
        BENEFICIOS.map((b) =>
          el("div", { class: "beneficio" }, [
            el("span", { class: "beneficio-ico" }, [icon(b.ico, 20)]),
            el("span", {}, [t(b.key)]),
          ])
        )),

      el("div", { class: "planes" }, tarjetas),

      el("button", { class: "btn-primario paywall-cta", onClick: suscribir }, [t("paywall.continuar")]),

      el("p", { class: "paywall-fine" }, [t("paywall.letra_chica")]),
      el("div", { class: "paywall-links" }, [
        el("a", { href: "#", onClick: (e: Event) => { e.preventDefault(); toast(t("paywall.toast_proximamente")); } }, [t("paywall.terminos")]),
        el("span", {}, ["·"]),
        el("a", {
          href: "#",
          onClick: (e: Event) => { e.preventDefault(); window.open(`${API_BASE}/privacidad`, "_blank"); },
        }, [t("paywall.privacidad")]),
      ]),
    ])
  );
}
