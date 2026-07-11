// Cliente de la API + modo MOCK para desarrollar sin gastar crédito.
import { API_BASE, MOCK } from "./config";

export interface Campo { clave: string; label: string; ejemplo: string; }
export interface Categoria {
  titulo: string; emoji: string; tipo_default: "imagen" | "video";
  campos: Campo[]; engine: string;
}
export type Categorias = Record<string, Categoria>;

export interface Resultados {
  antes?: string; despues?: string; comparacion?: string; video?: string;
  limpio?: string; // resultado sin marca de agua (para encadenar ediciones)
}
export interface Trabajo {
  id: string; status: "pending" | "processing" | "done" | "error";
  tipo: "imagen" | "video"; categoria: string; detalle?: string;
  proyecto?: string | null;
  error: string | null; resultados: Resultados; creado?: string | number;
}

export function mediaUrl(rel?: string): string | undefined {
  if (!rel) return undefined;
  return rel.startsWith("http") ? rel : API_BASE + rel;
}

// ─── MOCK ─────────────────────────────────────────────────────────────────────
const MOCK_CATEGORIAS: Categorias = {
  pintar: {
    titulo: "Pintar / color", emoji: "🎨", tipo_default: "imagen", engine: "editar",
    campos: [
      { clave: "superficie", label: "Superficie", ejemplo: "pared del fondo" },
      { clave: "color", label: "Color", ejemplo: "verde esmeralda mate" },
    ],
  },
  interior: {
    titulo: "Diseño interior", emoji: "🛋️", tipo_default: "imagen", engine: "editar",
    campos: [{ clave: "estilo", label: "Estilo", ejemplo: "moderno minimalista" }],
  },
  exterior: {
    titulo: "Diseño exterior", emoji: "🏡", tipo_default: "imagen", engine: "editar",
    campos: [{ clave: "estilo", label: "Estilo", ejemplo: "contemporáneo con jardín" }],
  },
  muebles: {
    titulo: "Cambiar muebles", emoji: "🪑", tipo_default: "imagen", engine: "editar",
    campos: [{ clave: "accion", label: "¿Qué quieres?", ejemplo: "sofás modernos grises" }],
  },
  suelo: {
    titulo: "Suelo nuevo", emoji: "🪵", tipo_default: "imagen", engine: "editar",
    campos: [{ clave: "material", label: "Material", ejemplo: "porcelanato blanco" }],
  },
  paredes: {
    titulo: "Paredes nuevas", emoji: "🧱", tipo_default: "imagen", engine: "editar",
    campos: [{ clave: "acabado", label: "Acabado", ejemplo: "ladrillo visto industrial" }],
  },
  eliminar: {
    titulo: "Eliminar objetos", emoji: "🗑️", tipo_default: "imagen", engine: "editar",
    campos: [{ clave: "objeto", label: "¿Qué quitar?", ejemplo: "los muebles viejos" }],
  },
  restaurar: {
    titulo: "Restaurar", emoji: "✨", tipo_default: "video", engine: "editar",
    campos: [
      { clave: "objeto", label: "¿Qué restaurar?", ejemplo: "los sofás de cuero" },
      { clave: "estilo", label: "Resultado esperado", ejemplo: "como nuevos, cuero liso" },
    ],
  },
  remodelar: {
    titulo: "Remodelar", emoji: "🏠", tipo_default: "video", engine: "editar",
    campos: [{ clave: "estilo", label: "Estilo", ejemplo: "cocina moderna minimalista blanca" }],
  },
  pincel: {
    titulo: "Pincel mágico", emoji: "🖌️", tipo_default: "imagen", engine: "inpaint",
    campos: [{ clave: "cambio", label: "¿Qué hacer en la zona pintada?", ejemplo: "pintar de azul marino" }],
  },
  estilo: {
    titulo: "Estilo de referencia", emoji: "🖼️", tipo_default: "imagen", engine: "estilo",
    campos: [],
  },
  plano: {
    titulo: "Plano 2D → 3D", emoji: "📐", tipo_default: "imagen", engine: "plano",
    campos: [],
  },
};

const mockJobs = new Map<string, { creado: number; tipo: "imagen" | "video"; categoria: string; detalle: string }>();

const MOCK_HISTORIAL: Trabajo[] = [
  {
    id: "hist-1", tipo: "imagen", categoria: "pintar", status: "done", error: null,
    proyecto: "Casa de mamá",
    detalle: "Pared terracota, intensidad media",
    creado: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    resultados: { antes: "/mock/antes.jpg", despues: "/mock/despues.png", comparacion: "/mock/comparacion.png" },
  },
  {
    id: "hist-2", tipo: "video", categoria: "remodelar", status: "done", error: null,
    detalle: "Cocina moderna minimalista blanca",
    creado: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    resultados: { antes: "/mock/antes.jpg", despues: "/mock/despues.png", video: "/mock/final.mp4" },
  },
];

export async function getCategorias(): Promise<Categorias> {
  if (MOCK) return MOCK_CATEGORIAS;
  const r = await fetch(`${API_BASE}/categorias`);
  if (!r.ok) throw new Error("No se pudieron cargar las categorías");
  return r.json();
}

export async function crearTrabajo(data: {
  deviceId: string; categoria: string; detalle: string;
  tipo: "imagen" | "video"; foto: Blob;
  mask?: Blob; referencia?: Blob; proyecto?: string;
}): Promise<{ id: string; status: string; tipo: string }> {
  if (MOCK) {
    const id = "mock-" + crypto.randomUUID().slice(0, 8);
    mockJobs.set(id, { creado: Date.now(), tipo: data.tipo, categoria: data.categoria, detalle: data.detalle });
    return { id, status: "pending", tipo: data.tipo };
  }
  const fd = new FormData();
  fd.append("device_id", data.deviceId);
  fd.append("categoria", data.categoria);
  fd.append("detalle", data.detalle);
  fd.append("tipo", data.tipo);
  fd.append("foto", data.foto, "foto.jpg");
  if (data.mask) fd.append("mask", data.mask, "mask.png");
  if (data.referencia) fd.append("referencia", data.referencia, "referencia.jpg");
  if (data.proyecto) fd.append("proyecto", data.proyecto);
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
    const categoria = job?.categoria ?? "pintar";
    return {
      id, tipo, categoria, error: null,
      detalle: job?.detalle ?? "",
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

export async function getHistorial(deviceId: string, limit = 30): Promise<Trabajo[]> {
  if (MOCK) return MOCK_HISTORIAL;
  const r = await fetch(`${API_BASE}/trabajos?device_id=${deviceId}&limit=${limit}`);
  if (!r.ok) return [];
  return r.json();
}

// Video del PROCESO (premium): original → ediciones → final, con fundidos.
export async function crearProceso(
  deviceId: string, trabajoIds: string[]
): Promise<{ id: string; status: string; tipo: string }> {
  if (MOCK) {
    const id = "mock-" + crypto.randomUUID().slice(0, 8);
    mockJobs.set(id, { creado: Date.now(), tipo: "video", categoria: "proceso", detalle: "" });
    return { id, status: "pending", tipo: "video" };
  }
  const fd = new FormData();
  fd.append("device_id", deviceId);
  fd.append("trabajo_ids", trabajoIds.join(","));
  const r = await fetch(`${API_BASE}/proceso`, { method: "POST", body: fd });
  if (r.status === 402) throw new Error("El video del proceso es una función Premium.");
  if (!r.ok) {
    const j = await r.json().catch(() => ({ detail: "No se pudo montar el video." }));
    throw new Error(j.detail);
  }
  return r.json();
}

export interface EstadoPremium { premium: boolean; hasta?: number | null; plan?: string | null; }

export async function getPremium(deviceId: string): Promise<EstadoPremium> {
  if (MOCK) return { premium: false };
  try {
    const r = await fetch(`${API_BASE}/premium?device_id=${deviceId}`);
    if (!r.ok) return { premium: false };
    return r.json();
  } catch {
    return { premium: false };
  }
}

export async function borrarTrabajo(id: string, deviceId: string): Promise<boolean> {
  if (MOCK) return true;
  const r = await fetch(`${API_BASE}/trabajos/${id}?device_id=${deviceId}`, { method: "DELETE" });
  return r.ok;
}

export async function votarTrabajo(id: string, voto: 1 | -1): Promise<void> {
  if (MOCK) return;
  await fetch(`${API_BASE}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trabajo_id: id, voto }),
  }).catch(() => {});
}

// ─── Asesor "El Maestro" ─────────────────────────────────────────────────────
export interface MensajeChat { role: "user" | "assistant"; content: string; }

export async function enviarAsesor(
  deviceId: string, mensajes: MensajeChat[], contexto?: string
): Promise<string> {
  if (MOCK) {
    await new Promise((r) => setTimeout(r, 900));
    return "¡Claro! Para una pared de 3×4 m (12 m²) necesitas ~1,3 L de pintura " +
      "por capa (rinde 10 m²/L + 10% de desperdicio). Cómprate 2 L y te sobra " +
      "para retoques. Rango de referencia: $15–25 el galón según marca — " +
      "confírmalo en tu ferretería. ¿Le damos una o dos manos?";
  }
  const r = await fetch(`${API_BASE}/asesor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device_id: deviceId, mensajes, contexto: contexto || null }),
  });
  if (r.status === 429) {
    const j = await r.json().catch(() => ({ detail: "Límite diario alcanzado." }));
    throw new Error(j.detail);
  }
  if (!r.ok) throw new Error("El Maestro no está disponible ahora. Intenta en un momento.");
  const j = await r.json();
  return j.respuesta;
}

export function resolverMedia(rel?: string): string | undefined {
  if (!rel) return undefined;
  if (MOCK) return rel;
  return mediaUrl(rel);
}
