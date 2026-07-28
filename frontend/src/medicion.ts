// Medición sobre una foto por HOMOGRAFÍA.
//
// Una foto sola no contiene la escala (una habitación real y una maqueta pueden
// dar píxeles idénticos), así que el usuario aporta una referencia de medida
// conocida. Con 4 esquinas de esa referencia se calcula la transformación que
// lleva los píxeles al plano real, corrigiendo la perspectiva; a partir de ahí
// cualquier punto SOBRE ESE MISMO PLANO se puede medir.
//
// Limitación importante (se comunica en la UI): solo es válido para lo que esté
// en el plano de la referencia. Medir algo más cercano o más lejano da error.

export interface Punto { x: number; y: number; }

/** Homografía 3x3 aplanada en 9 valores (fila por fila). */
export type Homografia = number[];

/** Resuelve A·x = b por eliminación gaussiana con pivoteo parcial. */
function resolver(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((fila, i) => [...fila, b[i]]);
  for (let col = 0; col < n; col++) {
    let mejor = col;
    for (let f = col + 1; f < n; f++) {
      if (Math.abs(M[f][col]) > Math.abs(M[mejor][col])) mejor = f;
    }
    // Pivote ~0 → los puntos son degenerados (colineales o repetidos).
    if (Math.abs(M[mejor][col]) < 1e-9) return null;
    [M[col], M[mejor]] = [M[mejor], M[col]];
    for (let f = 0; f < n; f++) {
      if (f === col) continue;
      const factor = M[f][col] / M[col][col];
      for (let c = col; c <= n; c++) M[f][c] -= factor * M[col][c];
    }
  }
  return M.map((fila, i) => fila[n] / fila[i]);
}

/**
 * Homografía que mapea 4 puntos de la imagen (px) a 4 del plano real (metros).
 * Devuelve null si la selección es degenerada.
 */
export function homografia(imagen: Punto[], mundo: Punto[]): Homografia | null {
  if (imagen.length !== 4 || mundo.length !== 4) return null;
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = imagen[i];
    const { x: X, y: Y } = mundo[i];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]); b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]); b.push(Y);
  }
  const h = resolver(A, b);
  return h ? [...h, 1] : null;
}

/** Lleva un punto de la imagen al plano real. */
export function aMundo(h: Homografia, p: Punto): Punto {
  const d = h[6] * p.x + h[7] * p.y + h[8];
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / d,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / d,
  };
}

/** Distancia real (m) entre dos puntos de la imagen. */
export function distancia(h: Homografia, a: Punto, b: Punto): number {
  const A = aMundo(h, a);
  const B = aMundo(h, b);
  return Math.hypot(B.x - A.x, B.y - A.y);
}

/** Perímetro real (m) de una polilínea cerrada. */
export function perimetro(h: Homografia, pts: Punto[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    s += distancia(h, pts[i], pts[(i + 1) % pts.length]);
  }
  return s;
}

/** Área real (m²) del polígono, por la fórmula del zapato. */
export function area(h: Homografia, pts: Punto[]): number {
  if (pts.length < 3) return 0;
  const m = pts.map((p) => aMundo(h, p));
  let s = 0;
  for (let i = 0; i < m.length; i++) {
    const j = (i + 1) % m.length;
    s += m[i].x * m[j].y - m[j].x * m[i].y;
  }
  return Math.abs(s) / 2;
}

/** Formatea metros de forma legible (bajo 1 m pasa a centímetros). */
export function fmtM(m: number): string {
  if (!isFinite(m)) return "—";
  return m < 1 ? `${Math.round(m * 100)} cm` : `${m.toFixed(2)} m`;
}
