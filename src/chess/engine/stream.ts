import { ACTS } from '../data/acts';
import { POS, type PosKey } from '../data/positions';

const SEED = 20261124;
const MAX_LINES = 40;
const STEP = 0.09; // seconds per emitted line at rest

/**
 * Layer 1: ghosted engine log. A fixed pool of lines rewritten in place (never appended as DOM),
 * seeded RNG, speed follows scroll velocity, freezes mid-line at checkmate.
 */
export function createStream(el: HTMLElement) {
  let seed = SEED;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const lines: string[] = [];
  let acc = 0;
  let frozen = false;
  let act = -1;

  /** Returns null when the act has nothing to print (the opening acts print no move lines). */
  function line(ai: number, lp: number): string | null {
    const a = ACTS[ai];
    const P = POS[a.k as PosKey] as (typeof POS)[PosKey] | undefined;
    if (a.k === 'mate') return 'h1h8';
    if (!P) return null;
    const solved = lp > 0.64;
    const from = P.mv[0];
    const r = rnd();
    if (!solved && r < 0.3) {
      const alt = P.dots[Math.floor(rnd() * P.dots.length)];
      return `${from}${alt}`;
    }
    if (!solved && r < 0.4) return `info currmove ${from}${P.dots[Math.floor(rnd() * P.dots.length)]} currmovenumber ${1 + Math.floor(rnd() * P.dots.length)}`;
    if (solved && r < 0.08) return `bestmove ${P.pv.split(' ')[0]} ponder ${P.pv.split(' ')[1]}`;
    return `hashfull ${Math.floor(rnd() * 900)} ${P.pv}`;
  }

  function flush() {
    if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
    el.textContent = lines.join('\n');
  }

  return {
    tick(dt: number, velocity: number, ai: number, lp: number) {
      const a = ACTS[ai];
      const freezeNow = a.k === 'mate' && lp > 0.55;
      // reversibility: scrolling back above the freeze point resumes the analysis
      if (frozen && !freezeNow) frozen = false;
      if (frozen) return;
      if (ai !== act) {
        act = ai;
        lines.push('', a.k === 'establish' ? 'uci' : `position fen ${POS[a.k as PosKey]?.fen ?? 'startpos'}`, 'go infinite');
      }
      if (freezeNow) {
        lines.push('h1h');
        frozen = true;
        flush();
        return;
      }
      acc += dt * (1.2 + Math.min(Math.abs(velocity), 60) * 0.12);
      let n = 0;
      while (acc > STEP && n < 4) {
        acc -= STEP;
        const l = line(ai, lp);
        if (l !== null) {
          lines.push(l);
          n++;
        }
      }
      if (n) flush();
    },
    reset() {
      lines.length = 0;
      act = -1;
      frozen = false;
      el.textContent = '';
    },
  };
}
