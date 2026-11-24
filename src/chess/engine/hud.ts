import { ACTS, WIN, type EvalValue } from '../data/acts';
import { POS, type PosKey } from '../data/positions';
import { E, seg } from './easing';

/** Eval bar fill 0..1 (centre = equal). Mate scores fill the bar. */
export const evalFill = (v: EvalValue): number => (typeof v === 'string' ? (v === 'M1' ? 1 : 0.985) : 0.5 + 0.5 * Math.tanh(v / 4));
export const evalText = (v: EvalValue): string => (typeof v === 'string' ? v : (v >= 0 ? '+' : '') + v.toFixed(2));

/** Evaluation [fill, text] for the act at local progress lp. */
export function actEval(ai: number, lp: number): [number, string] {
  const a = ACTS[ai];
  const P = POS[a.k as PosKey] as (typeof POS)[PosKey] | undefined;
  const [b, f] = P ? P.ev : (a.ev ?? [0, 0]);
  if (!P) return [evalFill(f), evalText(f)];
  const t = E(seg(lp, WIN.evalSwing[0], WIN.evalSwing[1]));
  if (typeof f === 'string') return t < 0.5 ? [evalFill(b), evalText(b)] : [evalFill(f), f];
  const v = (b as number) + (f - (b as number)) * t;
  return [evalFill(v), evalText(v)];
}
