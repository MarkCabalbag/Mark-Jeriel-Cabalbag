import * as THREE from 'three';

export type PieceType = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';
type Part = [THREE.BufferGeometry, [number, number, number]?, [number, number, number]?];

const lathe = (pts: number[][]) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 44);
const arc = (cy: number, r: number, a0: number, a1: number, n: number, sx = 1): number[][] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [Math.max(0, Math.cos(a) * r * sx), cy + Math.sin(a) * r];
  });
const BASE = [[0, 0], [0.34, 0], [0.345, 0.04], [0.32, 0.07], [0.3, 0.1], [0.27, 0.13], [0.23, 0.16]];
const ball = (r: number) => new THREE.SphereGeometry(r, 18, 12);

/** Merges parts into one non-indexed geometry (position + normal only). */
function merge(parts: Part[]): THREE.BufferGeometry {
  const m4 = new THREE.Matrix4();
  const geos = parts.map(([g, p, r]) => {
    const x = g.index ? g.toNonIndexed() : g.clone();
    m4.compose(
      new THREE.Vector3(...(p ?? [0, 0, 0])),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(r ?? [0, 0, 0]))),
      new THREE.Vector3(1, 1, 1),
    );
    x.applyMatrix4(m4);
    return x;
  });
  const n = geos.reduce((s, g) => s + g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    o += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.computeBoundingSphere();
  return out;
}

function knightHead(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  [[-0.2, 0], [0.2, 0], [0.16, 0.18], [0.1, 0.3], [0.14, 0.36], [0.26, 0.4], [0.32, 0.48], [0.28, 0.56], [0.14, 0.6], [0.08, 0.7], [0.02, 0.78], [-0.04, 0.7], [-0.12, 0.64], [-0.2, 0.48], [-0.24, 0.28], [-0.22, 0.1]]
    .forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.035, bevelSegments: 4, curveSegments: 8 });
  g.translate(0, 0.27, -0.09);
  g.computeVertexNormals();
  return g;
}

export function buildPieceGeometries(): Record<PieceType, THREE.BufferGeometry> {
  const rookTeeth: Part[] = [0, 1, 2, 3].map((i) => {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    return [new THREE.BoxGeometry(0.13, 0.11, 0.12), [Math.cos(a) * 0.215, 0.855, Math.sin(a) * 0.215], [0, -a, 0]];
  });
  const queenCrown: Part[] = Array.from({ length: 8 }, (_, i): Part => {
    const a = (i * Math.PI) / 4;
    return [ball(0.03), [Math.cos(a) * 0.225, 1.15, Math.sin(a) * 0.225]];
  });
  return {
    pawn: merge([[lathe([...BASE, [0.16, 0.22], [0.12, 0.36], [0.11, 0.44], [0.18, 0.46], [0.18, 0.49], [0.1, 0.51], ...arc(0.63, 0.13, -1.15, Math.PI / 2, 12)])]]),
    rook: merge([[lathe([...BASE, [0.24, 0.2], [0.2, 0.3], [0.19, 0.62], [0.26, 0.68], [0.27, 0.8], [0.2, 0.8], [0.2, 0.76], [0, 0.76]])], ...rookTeeth]),
    bishop: merge([[lathe([...BASE, [0.17, 0.2], [0.1, 0.62], [0.2, 0.66], [0.2, 0.69], [0.11, 0.72], ...arc(0.88, 0.17, -1.2, Math.PI / 2, 14, 0.85)])], [ball(0.045), [0, 1.1, 0]]]),
    queen: merge([[lathe([...BASE, [0.21, 0.2], [0.11, 0.8], [0.22, 0.86], [0.22, 0.89], [0.13, 0.92], [0.17, 1.04], [0.24, 1.13], [0.2, 1.14], [0.12, 1.12], [0.06, 1.16], [0, 1.17]])], [ball(0.055), [0, 1.22, 0]], ...queenCrown]),
    king: merge([[lathe([...BASE, [0.22, 0.2], [0.12, 0.88], [0.23, 0.93], [0.23, 0.96], [0.14, 0.99], [0.2, 1.14], [0.2, 1.18], [0, 1.2]])], [new THREE.BoxGeometry(0.06, 0.26, 0.06), [0, 1.32, 0]], [new THREE.BoxGeometry(0.19, 0.06, 0.06), [0, 1.35, 0]]]),
    knight: merge([[lathe([...BASE, [0.22, 0.2], [0.21, 0.3], [0, 0.3]])], [knightHead()]]),
  };
}
