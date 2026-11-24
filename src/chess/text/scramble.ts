/** Chess-notation glyphs only (never chess emoji). */
const GLYPHS = 'abcdefgh12345678NBRQKx+#=';

/** Keeps the first n characters, keeps spaces, replaces the rest with random glyphs. */
export function scramble(s: string, n: number, rnd: () => number = Math.random): string {
  let out = s.slice(0, n);
  for (let i = n; i < s.length; i++) out += s[i] === ' ' ? ' ' : GLYPHS[Math.floor(rnd() * GLYPHS.length)];
  return out;
}

export interface Solver {
  el: HTMLElement;
  scr: HTMLElement;
  txt: string;
  ai: number;
  /** null = driven by the hero timer instead of scroll */
  win: [number, number] | null;
  last: number;
}

/** Finds every .solve in root and adds the aria-hidden scramble overlay (idempotent). */
export function collectSolvers(root: HTMLElement, actIndex: (el: HTMLElement) => number): Solver[] {
  return [...root.querySelectorAll<HTMLElement>('.solve')].map((el) => {
    const real = el.querySelector<HTMLElement>('.real')!;
    let scr = el.querySelector<HTMLElement>(':scope > .scr');
    if (!scr) {
      scr = document.createElement('span');
      scr.className = 'scr';
      scr.setAttribute('aria-hidden', 'true');
      el.appendChild(scr);
    }
    const w = el.dataset.solve ?? '0,1';
    return { el, scr, txt: real.textContent ?? '', ai: actIndex(el), win: w === 'time' ? null : (w.split(',').map(Number) as [number, number]), last: -1 };
  });
}
