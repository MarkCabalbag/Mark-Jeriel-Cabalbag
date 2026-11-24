export type V3 = [number, number, number];
export type Shot = { name: string; pos: V3; target: V3 };

/** 13 named camera shots. Board: a1 = (-3.5, 0, +3.5), White at +z. */
export const SHOTS: Shot[] = [
  { name: 'Establishing, rank level', pos: [-0.6, 0.36, 5.7], target: [0.7, 0.55, 2.0] },
  { name: 'Overhead pull-back', pos: [0, 11.5, 7.0], target: [0, 0, 0.4] },
  { name: 'Lateral dolly, start', pos: [5.0, 1.3, 3.6], target: [-0.2, 0.35, 2.3] },
  { name: 'Lateral dolly, end', pos: [5.0, 1.3, 0.9], target: [-0.2, 0.35, -0.3] },
  { name: "Over the knight's shoulder", pos: [0.9, 1.05, 1.9], target: [-0.9, 0.45, -2.1] },
  { name: 'Orbit, flipping sides', pos: [7.2, 4.2, -0.6], target: [0, 0.2, -0.8] },
  { name: "Down the diagonal from Black's side", pos: [3.7, 1.35, -5.7], target: [-0.6, 0.35, 1.2] },
  { name: 'Orbit back', pos: [7.4, 4.4, 1.8], target: [0, 0.2, 0.8] },
  { name: 'Behind the rook, up the e-file', pos: [1.35, 1.0, 5.5], target: [0.3, 0.4, -1.0] },
  { name: 'Along the first rank', pos: [-5.9, 0.85, 4.9], target: [0.6, 0.4, 3.0] },
  { name: 'Following the sweep', pos: [-5.4, 1.0, 4.6], target: [2.4, 0.4, 3.2] },
  // -0.01 z keeps lookAt stable when looking straight down
  { name: 'Top-down, high', pos: [0.2, 19, -0.01], target: [0.2, 0, 0] },
  { name: 'Top-down, settled', pos: [0.2, 13.5, -0.01], target: [0.2, 0, 0] },
];

export const CAMERA_FOV = 32;
