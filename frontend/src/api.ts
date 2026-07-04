// Cliente de la API + modo MOCK para desarrollar sin gastar crédito.
import { API_BASE, MOCK } from "./config";

export interface Campo { clave: string; label: string; ejemplo: string; }
export interface Categoria {
  titulo: string; emoji: string; tipo_default: "imagen" | "video"; campos: Campo[];
}
export type Categorias = Record<string, Categoria>;

export interface Resultados {
  antes?: string; despues?: string; comparacion?: string; video?: string;
}
export interface Trabajo {
  id: string; status: "pending" | "processing" | "done" | "error";
  tipo: "imagen" | "video"; error: string | null; resultados: Resultados;
}

// Prefija URLs relativas del backend con API_BASE.
export function mediaUrl(rel?: string): string | undefined {
  if (!rel) return undefined;
  return rel.startsWith("http") ? rel : API_BASE + rel;
}

// ─── MOCK ────────────────────────────────────────────────────────────────────
const MOCK_CATEGORIAS: Categorias = {
  pintar: { titulo: "Pintar / cambiar color", emoji: "🎨", tipo_default: "imagen",
    campos: [
      { clave: "superficie", label: "¿Qué superficie?", ejemplo: "la pared del fondo" },
      { clave: "color", label: "Color y acabado", ejemplo: "verde esmeralda mate" }] },
  muebles: { titulo: "Cambiar / mover muebles", emoji: "🛋️", tipo_default: "imagen",
    campos: [{ clave: "accion", label: "¿Qué quieres?", ejemplo: "cambiar los sofás por unos modernos" }] },
  restaurar: { titulo: "Restaurar (mueble / auto / fachada)", emoji: "✨", tipo_default: "video",
    campos: [
      { clave: "objeto", label: "¿Qué restaurar?", ejemplo: "los sofás de cuero" },
      { clave: "estilo", label: "Estilo del resultado", ejemplo: "como nuevos, cuero liso" }] },
  remodelar: { titulo: "Remodelar el espacio completo", emoji: "🏠", tipo_default: "video",
    campos: [{ clave: "estilo", label: "Estilo deseado", ejemplo: "cocina moderna minimalista blanca" }] },
};

const mockJobs = new Map<string, { creado: number; tipo: "imagen" | "video" }>();

export async function getCategorias(): Promise<Categorias> {
  if (MOCK) return MOCK_CATEGORIAS;
  const r = await fetch(`${API_BASE}/categorias`);
  if (!r.ok) throw new Error("No se pudieron cargar las categorías");
  return r.json();
}

export async function crearTrabajo(data: {
  deviceId: string; categoria: string; detalle: string;
  tipo: "imagen" | "video"; foto: Blob;
}): Promise<{ id: string; status: string; tipo: string }> {
  if (MOCK) {
    const id = "mock-" + crypto.randomUUID().slice(0, 8);
    mockJobs.set(id, { creado: Date.now(), tipo: data.tipo });
    return { id, status: "pending", tipo: data.tipo };
  }
  const fd = new FormData();
  fd.append("device_id", data.deviceId);
  fd.append("categoria", data.categoria);
  fd.append("detalle", data.detalle);
  fd.append("tipo", data.tipo);
  fd.append("foto", data.foto, "foto.jpg");
  const r = await fetch(`${API_BASE}/trabajos`, { method: "POST", body: fd });
  if (r.status === 429) {
    const j = await r.json().catch(() => ({ detail: "Límite alcanzado." }));
    throw new Error(j.detail);
  }
  if (!r.ok) throw new Error("No se pudo crear el trabajo");
  return r.json();
}

export async function getTrabajo(id: string): Promise<Trabajo> {
  if (MOCK) {
    const job = mockJobs.get(id);
    const listo = job && Date.now() - job.creado > 4000;
    const tipo = job?.tipo ?? "imagen";
    return {
      id, tipo, error: null,
      status: listo ? "done" : "processing",
      resultados: listo
        ? {
            antes: "/mock/antes.jpg",
            despues: "/mock/despues.png",
            comparacion: "/mock/comparacion.png",
            ...(tipo === "video" ? { video: "/mock/final.mp4" } : {}),
          }
        : {},
    };
  }
  const r = await fetch(`${API_BASE}/trabajos/${id}`);
  if (!r.ok) throw new Error("No se pudo consultar el trabajo");
  return r.json();
}

// En MOCK las URLs son locales (public/); en real, se prefijan con API_BASE.
export function resolverMedia(rel?: string): string | undefined {
  if (!rel) return undefined;
  if (MOCK) return rel; // servido desde /public
  return mediaUrl(rel);
}
