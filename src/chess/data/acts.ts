export type ActKey = 'establish' | 'reveal' | 'opening' | 'knight' | 'bishop' | 'rook' | 'queen' | 'mate';
export type EvalValue = number | string;

export interface Act {
  k: ActKey;
  /** scroll budget in vh; section height = budget vh + 100vh */
  budget: number;
  /** camera stops: [local progress, shot index] */
  stops: [number, number][];
  /** local progress of the composed resting frame (snap target) */
  rest: number;
  /** evaluation before/after for acts without a Position */
  ev: [EvalValue, EvalValue] | null;
}

export const ACTS: Act[] = [
  { k: 'establish', budget: 70, stops: [[0, 0], [1, 0]], rest: 0, ev: [0, 0] },
  { k: 'reveal', budget: 70, stops: [[0, 0], [0.75, 1]], rest: 0.85, ev: [0, 0] },
  { k: 'opening', budget: 120, stops: [[0, 1], [0.22, 2], [0.9, 3]], rest: 0.8, ev: [0.3, 0.3] },
  { k: 'knight', budget: 120, stops: [[0, 3], [0.24, 4]], rest: 0.8, ev: null },
  { k: 'bishop', budget: 120, stops: [[0, 4], [0.12, 5], [0.26, 6]], rest: 0.8, ev: null },
  { k: 'rook', budget: 115, stops: [[0, 6], [0.12, 7], [0.26, 8]], rest: 0.8, ev: null },
  { k: 'queen', budget: 115, stops: [[0, 8], [0.24, 9], [0.8, 10]], rest: 0.8, ev: null },
  { k: 'mate', budget: 110, stops: [[0, 10], [0.3, 11], [0.8, 12]], rest: 1, ev: ['M1', 'M1'] },
];

export const AI = Object.fromEntries(ACTS.map((a, i) => [a.k, i])) as Record<ActKey, number>;

/** Named windows inside a Position act (local progress). One place so timings are never magic numbers. */
export const WIN = {
  panelOpen: [0.16, 0.28],
  panelClose: [0.9, 0.98],
  dotsIn: [0.4, 0.48],
  dotsOut: [0.56, 0.63],
  hlIn: [0.6, 0.66],
  hlOut: [0.92, 1],
  ripple: [0.62, 0.84],
  evalSwing: [0.6, 0.7],
  count: [0.62, 0.78],
  rayIn: [0.58, 0.7],
  rayOut: [0.88, 0.92],
  spot: [0.3, 0.5],
  mateSlab: [0.42, 0.6],
} as const;
