import { useEffect, useState } from 'react';
import { bus } from '../engine/store';

/** Layers 1-3 (engine stream, grid + coordinates, rays, HUD) and layer 5 (cursor, grain). All decorative: aria-hidden. */
export function Chrome() {
  return (
    <>
      <pre className="engine" aria-hidden="true" />
      <div className="grid" aria-hidden="true">
        <div className="frame" /><div className="cols" /><div className="files" /><div className="ranks" />
      </div>
      <svg className="rays" aria-hidden="true"><path id="ray" d="" /><circle id="rayDot" r="3.5" cx="-20" cy="-20" /></svg>
      <div className="hud" aria-hidden="true">
        <div className="evalbar"><i /></div>
        <div className="evalval">0.00</div>
        <div className="counter"><span className="n">Move 01 / 40</span><span className="bar"><i /></span><span className="ticker"><span /></span></div>
      </div>
      <div className="piece-card" aria-hidden="true">
        <p className="pc-top"><span className="pc-eyebrow" /><span className="pc-note" /></p>
        <p className="pc-title" />
        <dl className="pc-rows">
          <div data-row="status"><dt>Status</dt><dd /></div>
          <div data-row="started"><dt>Started</dt><dd /></div>
          <div data-row="legal"><dt>Legal</dt><dd /></div>
          <div data-row="role"><dt>Role</dt><dd /></div>
        </dl>
        <p className="pc-line" />
      </div>
      <div className="cursor" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
    </>
  );
}

export function Nav() {
  const go = (w: 'top' | 'about' | 'work' | 'contact') => () => bus.engine?.go(w);
  return (
    <header className="nav">
      <button className="brand" onClick={go('top')} aria-label="Back to the start"><b>Mark Cabalbag</b><span>Full Stack Developer</span></button>
      <nav className="links" aria-label="Sections">
        <button className="lk" onClick={go('about')}>About</button>
        <button className="lk" onClick={go('work')}>Positions</button>
        <button className="lk" onClick={go('contact')}>Contact</button>
        <button className="cta" onClick={go('contact')}>Your move</button>
      </nav>
    </header>
  );
}

/** A pawn steps forward while the board assembles; fades out once fonts are ready (min 1.3s). */
export function Loader() {
  const [phase, setPhase] = useState<'wait' | 'go' | 'out' | 'gone'>('wait');

  useEffect(() => {
    const raf = requestAnimationFrame(() => setPhase((p) => (p === 'wait' ? 'go' : p)));
    const t0 = performance.now();
    let cancelled = false;
    const timers: number[] = [];
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]).then(() => {
      if (cancelled) return;
      timers.push(window.setTimeout(() => {
        if (cancelled) return;
        setPhase('out');
        bus.loaded = true;
        bus.engine?.ready();
        timers.push(window.setTimeout(() => setPhase('gone'), 1000));
      }, Math.max(0, 1300 - (performance.now() - t0))));
    });
    return () => { cancelled = true; cancelAnimationFrame(raf); timers.forEach(clearTimeout); };
  }, []);

  if (phase === 'gone') return null;
  return (
    <div id="loader" className={phase === 'go' ? 'go' : phase === 'out' ? 'go out' : ''} role="status" aria-live="polite">
      <div className="lw">
        <svg viewBox="0 0 52 104" aria-hidden="true">
          <rect className="sq" x=".5" y=".5" width="51" height="51" />
          <rect className="sq dk" x=".5" y="52.5" width="51" height="51" />
          <g className="pawn"><circle cx="26" cy="18" r="6.5" /><path d="M20.5 25.5h11l-2 3 3 12h4.5v5h-22v-5h4.5l3-12z" /></g>
        </svg>
        <p>Setting up the position</p>
      </div>
    </div>
  );
}
