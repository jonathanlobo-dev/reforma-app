// Estado compartido mínimo entre pantallas.
import type { Categoria } from "./api";

export interface AppState {
  categorias: Record<string, Categoria>;
  categoriaSel?: string;
  foto?: { blob: Blob; url: string };
}

export const state: AppState = { categorias: {} };
