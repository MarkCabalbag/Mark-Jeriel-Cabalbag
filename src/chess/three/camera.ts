import * as THREE from 'three';
import { ACTS } from '../data/acts';
import { SHOTS } from '../data/shots';
import { EXPO, seg } from '../engine/easing';

export interface Curves {
  pos: THREE.CatmullRomCurve3;
  tgt: THREE.CatmullRomCurve3;
}

/** Option A desktop: dist 1, h 1, fov 32 -> every shot is used exactly as written. Mobile pushes out and raises. */
export function buildCurves(mobile: boolean, fov = 32, dist = 1, h = 1): Curves {
  const fovK = Math.tan(THREE.MathUtils.degToRad(16)) / Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const pts = SHOTS.map((s, i) => {
    const P = new THREE.Vector3(...s.pos);
    const T = new THREE.Vector3(...s.target);
    const d = P.clone().sub(T);
    if (i >= 11) d.y *= fovK * (mobile ? 1.35 : 1);
    else {
      d.multiplyScalar(dist * (mobile ? 1.45 : 1));
      d.y *= h;
      if (mobile) d.y += 0.8;
    }
    return [T.clone().add(d), T] as const;
  });
  return {
    pos: new THREE.CatmullRomCurve3(pts.map((p) => p[0]), false, 'centripetal'),
    tgt: new THREE.CatmullRomCurve3(pts.map((p) => p[1]), false, 'centripetal'),
  };
}

/** Shot-space parameter u in [0, 12] for the act and its local progress. Always eased with expo.inOut. */
export function camU(ai: number, lp: number): number {
  const st = ACTS[ai].stops;
  for (let i = 1; i < st.length; i++) {
    if (lp <= st[i][0]) return st[i - 1][1] + (st[i][1] - st[i - 1][1]) * EXPO(seg(lp, st[i - 1][0], st[i][0]));
  }
  return st[st.length - 1][1];
}
