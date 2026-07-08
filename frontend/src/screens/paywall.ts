// Pantalla de suscripción (paywall). Visual completo; el COBRO real se conecta
// después con RevenueCat + Google Play Billing (ver TODO abajo).
import { el, render, toast } from "../ui";
import { atras, setNavVisible } from "../nav";
import { icon } from "../ui/icons";
import { API_BASE } from "../config";

interface Plan {
  id: string; etiqueta: string; titulo: string; sub: string; precio: string;
  destacado?: boolean; badge?: string;
}

const PLANES: Plan[] = [
  { id: "vida", etiqueta: "PAGO ÚNICO", titulo: "De por vida", sub: "Un solo pago", precio: "USD 49,99" },
  { id: "anual", etiqueta: "MEJOR VALOR", titulo: "1 Año", sub: "USD 0,58 / semana", precio: "USD 29,99", destacado: true, badge: "Ahorra 88%" },
  { id: "semanal", etiqueta: "FLEXIBLE", titulo: "1 Semana", sub: "Prueba sin compromiso", precio: "USD 4,99" },
];

const BENEFICIOS: { ico: string; txt: string }[] = [
  { ico: "grid", txt: "Todas las funciones desbloqueadas" },
  { ico: "sparkles", txt: "10 transformaciones de imagen al día" },
  { ico: "image", txt: "Videos de transformación premium" },
  { ico: "eyeoff", txt: "Sin marca de agua en tus resultados" },
  { ico: "brush", txt: "Todos los estilos y contenidos nuevos" },
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
      ...(p.badge ? [el("div", { class: "plan-badge" }, [p.badge])] : []),
      el("div", { class: "plan-etiqueta" }, [p.etiqueta]),
      el("div", { class: "plan-titulo" }, [p.titulo]),
      el("div", { class: "plan-sub" }, [p.sub]),
      el("div", { class: "plan-precio" }, [p.precio]),
    ])
  );

  function refrescarPlanes() {
    tarjetas.forEach((t) => t.classList.toggle("sel", (t as HTMLElement).dataset.plan === planSel));
  }

  const suscribir = () => {
    // TODO(pagos): aquí se llamará a RevenueCat (Purchases.purchasePackage) con
    // el paquete correspondiente a planSel; al confirmar la compra, RevenueCat
    // valida con Google Play y el backend marca premium (db.activar_premium).
    toast("Los pagos se activan muy pronto — estamos configurando Google Play.");
  };

  render(
    el("div", { class: "screen paywall" }, [
      el("button", { class: "paywall-x", onClick: cerrar }, [icon("close", 20)]),

      el("div", { class: "paywall-hero" }, [
        el("div", { class: "paywall-hero-img" }),
        el("div", { class: "paywall-hero-grad" }),
        el("div", { class: "paywall-hero-txt" }, [
          el("div", { class: "paywall-corona" }, [icon("crown", 30)]),
          el("h1", {}, ["RenovAI Premium"]),
          el("p", {}, ["Transforma tu espacio sin límites"]),
        ]),
      ]),

      el("div", { class: "paywall-beneficios" },
        BENEFICIOS.map((b) =>
          el("div", { class: "beneficio" }, [
            el("span", { class: "beneficio-ico" }, [icon(b.ico, 20)]),
            el("span", {}, [b.txt]),
          ])
        )),

      el("div", { class: "planes" }, tarjetas),

      el("button", { class: "btn-primario paywall-cta", onClick: suscribir }, ["Continuar"]),

      el("p", { class: "paywall-fine" }, ["Renovación automática. Cancela cuando quieras."]),
      el("div", { class: "paywall-links" }, [
        el("a", { href: "#", onClick: (e: Event) => { e.preventDefault(); toast("Próximamente"); } }, ["Términos de uso"]),
        el("span", {}, ["·"]),
        el("a", {
          href: "#",
          onClick: (e: Event) => { e.preventDefault(); window.open(`${API_BASE}/privacidad`, "_blank"); },
        }, ["Política de privacidad"]),
      ]),
    ])
  );
}
