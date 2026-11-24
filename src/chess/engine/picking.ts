import * as THREE from 'three';
import type { Piece } from '../three/world';

/**
 * Analytic picking. The pieces are InstancedMeshes whose bounding spheres go stale as instances move,
 * so Raycaster.intersectObject is not used. Each piece is tested as one invisible upright cylinder instead.
 */

/** Pick-cylinder heights per piece type (board units, before the piece's scale). */
export const PICK_H = { pawn: 0.76, rook: 0.91, knight: 1.06, bishop: 1.15, queen: 1.28, king: 1.38 } as const;
/** Slightly inside the base radius (0.345). */
export const PICK_R = 0.32;

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

/** Nearest positive t where the ray meets the side wall or top cap of a vertical cylinder, or null. */
export function rayCylinder(o: THREE.Vector3, d: THREE.Vector3, cx: number, cz: number, r: number, y0: number, y1: number): number | null {
  let best = Infinity;
  const ox = o.x - cx;
  const oz = o.z - cz;
  const a = d.x * d.x + d.z * d.z;
  if (a > 1e-9) {
    const b = 2 * (ox * d.x + oz * d.z);
    const c = ox * ox + oz * oz - r * r;
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const s = Math.sqrt(disc);
      const t1 = (-b - s) / (2 * a);
      const t2 = (-b + s) / (2 * a);
      for (const t of [t1, t2]) {
        if (t > 0 && t < best) {
          const y = o.y + d.y * t;
          if (y >= y0 && y <= y1) best = t;
        }
      }
    }
  }
  if (Math.abs(d.y) > 1e-9) {
    // top cap (the camera is always above the board)
    const t = (y1 - o.y) / d.y;
    if (t > 0 && t < best) {
      const x = o.x + d.x * t - cx;
      const z = o.z + d.z * t - cz;
      if (x * x + z * z <= r * r) best = t;
    }
  }
  return best === Infinity ? null : best;
}

/** Id of the closest piece under the pointer (CSS px), or -1. The projection already contains setViewOffset. */
export function pickPiece(camera: THREE.PerspectiveCamera, pieces: Piece[], clientX: number, clientY: number): number {
  ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const o = raycaster.ray.origin;
  const d = raycaster.ray.direction;
  let best = Infinity;
  let id = -1;
  for (const p of pieces) {
    const t = rayCylinder(o, d, p.x, p.z, PICK_R * p.rs, p.ry, p.ry + PICK_H[p.type] * p.rs);
    if (t !== null && t < best) {
      best = t;
      id = p.id;
    }
  }
  return id;
}
