// Estado compartido mínimo entre pantallas.
import type { Categoria } from "./api";

export interface AppState {
  categorias: Record<string, Categoria>;
  categoriaSel?: string;
  foto?: { blob: Blob; url: string };
  mask?: Blob;                              // PNG b/n del pincel (engine inpaint)
  referencia?: { blob: Blob; url: string }; // foto de inspiración (engine estilo)
}

export const state: AppState = { categorias: {} };
