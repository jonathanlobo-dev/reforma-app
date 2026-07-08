// Estado compartido mínimo entre pantallas.
import type { Categoria } from "./api";

export interface AppState {
  categorias: Record<string, Categoria>;
  categoriaSel?: string;
  foto?: { blob: Blob; url: string };
  mask?: Blob;                              // PNG b/n del pincel (engine inpaint)
  referencia?: { blob: Blob; url: string }; // foto de inspiración (engine estilo)
  prefillExtra?: string;                    // idea que viene del chat del Maestro
  premium?: boolean;                        // suscripción activa
}

export const state: AppState = { categorias: {} };

// Reemplazan la foto/referencia liberando el blob URL anterior (las fotos de
// cámara pesan varios MB y sin revoke quedan retenidas toda la sesión).
export function setFoto(f?: { blob: Blob; url: string }) {
  if (state.foto?.url.startsWith("blob:") && state.foto.url !== f?.url) {
    URL.revokeObjectURL(state.foto.url);
  }
  state.foto = f;
}

export function setReferencia(f?: { blob: Blob; url: string }) {
  if (state.referencia?.url.startsWith("blob:") && state.referencia.url !== f?.url) {
    URL.revokeObjectURL(state.referencia.url);
  }
  state.referencia = f;
}
