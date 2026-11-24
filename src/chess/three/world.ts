import * as THREE from 'three';
import { buildPieceGeometries, type PieceType } from './geometry';

export const sq2xz = (s: string): [number, number] => ['abcdefgh'.indexOf(s[0]) - 3.5, 3.5 - (Number(s[1]) - 1)];

export interface Piece {
  id: number;
  type: PieceType;
  c: 'w' | 'b';
  inst: THREE.InstancedMesh;
  idx: number;
  rotY: number;
  x0: number;
  z0: number;
  x: number;
  y: number;
  z: number;
  s: number;
  grave?: [number, number];
  // hover-card state, written by applyProgress (pure in scroll progress)
  startSq: string;
  state: 'board' | 'moving' | 'off';
  sq: string | null;
  moveFrom: string | null;
  moveTo: string | null;
  moveSan: string | null;
  moveKind: 'move' | 'setup' | null;
  moveLabel: string | null;
  clearedFor: string | null;
  role: string | null;
  /** rendered y and uniform scale (includes the load-in drop), written by writeInstances; used for picking */
  ry: number;
  rs: number;
}

export interface World {
  lights: { hemi: THREE.HemisphereLight; key: THREE.DirectionalLight; rim: THREE.DirectionalLight; spot: THREE.SpotLight };
  groundMat: THREE.ShadowMaterial;
  pieces: Piece[];
  insts: THREE.InstancedMesh[];
  startSquares: Map<number, string>;
  overlays: { dots: THREE.InstancedMesh; hlMat: THREE.MeshBasicMaterial; hlA: THREE.Mesh; hlB: THREE.Mesh; rings: THREE.Mesh[]; hoverTile: THREE.Mesh };
  dispose(): void;
}

const BG = 0x0a0a0a;
const BACK: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
const COUNT: Record<PieceType, number> = { pawn: 8, rook: 2, knight: 2, bishop: 2, queen: 1, king: 1 };

/** Builds the whole 3D world into the (R3F-owned) scene. Everything is created once. */
export function createWorld(scene: THREE.Scene, mobile: boolean): World {
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(o: T): T => (disposables.push(o), o);

  scene.background = new THREE.Color(BG);

  // lights (file 05 section 3)
  const hemi = new THREE.HemisphereLight(0xffffff, 0x1a1a1a, 0.38);
  const key = new THREE.DirectionalLight(0xfff8ee, 1.9);
  key.position.set(-9, 3.1, 5.4);
  key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 32 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.025;
  key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  const rim = new THREE.DirectionalLight(0xffffff, 0.55);
  rim.position.set(6, 4, -8);
  const spot = new THREE.SpotLight(0xffffff, 0, 0, 0.28, 0.85, 2);
  spot.position.set(1.2, 7.8, -2.6);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  const [kx, kz] = sq2xz('f8');
  spot.target.position.set(kx, 0, kz);
  scene.add(hemi, key, rim, spot, spot.target);

  // board
  const tileGeo = track(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  const dark = new THREE.InstancedMesh(tileGeo, track(new THREE.MeshPhysicalMaterial({ color: 0x1b3a29, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4 })), 32);
  const light = new THREE.InstancedMesh(tileGeo, track(new THREE.MeshPhysicalMaterial({ color: 0xe4e0d4, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.45 })), 32);
  {
    const m = new THREE.Matrix4();
    let d = 0;
    let l = 0;
    for (let f = 0; f < 8; f++)
      for (let r = 0; r < 8; r++) {
        m.makeTranslation(f - 3.5, 0, 3.5 - r);
        if ((f + r) % 2) light.setMatrixAt(l++, m);
        else dark.setMatrixAt(d++, m);
      }
  }
  dark.receiveShadow = light.receiveShadow = true;
  const frame = new THREE.Mesh(track(new THREE.BoxGeometry(8.7, 0.32, 8.7)), track(new THREE.MeshStandardMaterial({ color: 0x0f2219, roughness: 0.6 })));
  frame.position.y = -0.162;
  frame.castShadow = frame.receiveShadow = true;
  const groundMat = track(new THREE.ShadowMaterial({ opacity: 0.5 }));
  const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(90, 90).rotateX(-Math.PI / 2)), groundMat);
  ground.position.y = -0.32;
  ground.receiveShadow = true;
  scene.add(dark, light, frame, ground);

  // pieces: 12 InstancedMesh (type x colour)
  const geos = buildPieceGeometries();
  Object.values(geos).forEach(track);
  const mats = {
    w: track(new THREE.MeshStandardMaterial({ color: 0xe9e7e1, roughness: 0.42 })),
    b: track(new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.38 })),
  };
  const slots: Record<string, { m: THREE.InstancedMesh; n: number }> = {};
  const insts: THREE.InstancedMesh[] = [];
  for (const c of ['w', 'b'] as const)
    for (const t of Object.keys(COUNT) as PieceType[]) {
      const m = new THREE.InstancedMesh(geos[t], mats[c], COUNT[t]);
      m.castShadow = m.receiveShadow = true;
      m.frustumCulled = false;
      scene.add(m);
      slots[c + t] = { m, n: 0 };
      insts.push(m);
    }
  const pieces: Piece[] = [];
  const startSquares = new Map<number, string>();
  'abcdefgh'.split('').forEach((f, i) => {
    const specs: [PieceType, 'w' | 'b', string][] = [[BACK[i], 'w', f + '1'], ['pawn', 'w', f + '2'], ['pawn', 'b', f + '7'], [BACK[i], 'b', f + '8']];
    for (const [type, c, sq] of specs) {
      const slot = slots[c + type];
      const [x0, z0] = sq2xz(sq);
      const p: Piece = { id: pieces.length, type, c, inst: slot.m, idx: slot.n++, rotY: type === 'knight' ? (c === 'w' ? Math.PI / 2 : -Math.PI / 2) : 0, x0, z0, x: x0, y: 0, z: z0, s: 1, startSq: sq, state: 'board', sq, moveFrom: null, moveTo: null, moveSan: null, moveKind: null, moveLabel: null, clearedFor: null, role: null, ry: 0, rs: 1 };
      pieces.push(p);
      startSquares.set(p.id, sq);
    }
  });

  // overlays: legal dots, last-move highlights, ripple rings (file 05 section 6)
  const dots = new THREE.InstancedMesh(
    track(new THREE.CircleGeometry(0.12, 28).rotateX(-Math.PI / 2)),
    track(new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })),
    18,
  );
  dots.frustumCulled = false;
  dots.renderOrder = 2;
  const hlMat = track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  const hlA = new THREE.Mesh(tileGeo, hlMat);
  const hlB = new THREE.Mesh(tileGeo, hlMat);
  const ringGeo = track(new THREE.RingGeometry(0.47, 0.5, 64).rotateX(-Math.PI / 2));
  const rings = [0, 1, 2].map(() => new THREE.Mesh(ringGeo, track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }))));
  dots.position.y = 0.006;
  hlA.position.y = hlB.position.y = 0.005;
  rings.forEach((r) => (r.position.y = 0.007));
  hlA.visible = hlB.visible = false;
  dots.visible = false;
  // hover highlight: soft white tile under the hovered piece (spec 11 section 6.5)
  const hoverTile = new THREE.Mesh(tileGeo, track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })));
  hoverTile.position.y = 0.004;
  hoverTile.renderOrder = 1;
  hoverTile.visible = false;
  scene.add(dots, hlA, hlB, hoverTile, ...rings);

  return {
    lights: { hemi, key, rim, spot },
    groundMat,
    pieces,
    insts,
    startSquares,
    overlays: { dots, hlMat, hlA, hlB, rings, hoverTile },
    dispose() {
      [dark, light, frame, ground, dots, hlA, hlB, hoverTile, ...rings, ...insts].forEach((o) => scene.remove(o));
      scene.remove(hemi, key, rim, spot, spot.target);
      key.shadow.map?.dispose();
      spot.shadow.map?.dispose();
      disposables.forEach((d) => d.dispose());
      insts.forEach((m) => m.dispose());
    },
  };
}
