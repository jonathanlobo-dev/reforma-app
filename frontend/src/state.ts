// Estado compartido mínimo entre pantallas.
import type { Categoria, ConfigRemota } from "./api";

export interface AppState {
  categorias: Record<string, Categoria>;
  categoriaSel?: string;
  foto?: { blob: Blob; url: string };
  mask?: Blob;                              // PNG b/n del pincel (engine inpaint)
  referencia?: { blob: Blob; url: string }; // foto de inspiración (engine estilo)
  prefillExtra?: string;                    // idea que viene del chat del Maestro
  premium?: boolean;                        // suscripción activa
  cadena: string[];                         // ids de la cadena de ediciones (misma foto)
  config: ConfigRemota;                     // flags remotos (GET /config al arrancar)
}

export const state: AppState = {
  categorias: {},
  cadena: [],
  // Defaults conservadores hasta que /config responda: sin bloquear a nadie por
  // un fallo de red, y sin video (que es lo que cuesta dinero).
  config: { mode: "test", paywall_duro: false, video: false, ads: false },
};

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
