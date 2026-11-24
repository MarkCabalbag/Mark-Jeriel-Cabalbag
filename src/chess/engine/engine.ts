import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { ACTS, AI, WIN, type ActKey } from '../data/acts';
import { POS, type PosKey } from '../data/positions';
import { TICK } from '../data/projects';
import { buildCurves, camU, type Curves } from '../three/camera';
import { applyProgress, buildTransitions, writeInstances } from '../three/choreography';
import { disposePost, setupPost, type Post } from '../three/post';
import { createWorld, sq2xz } from '../three/world';
import { collectSolvers, scramble, type Solver } from '../text/scramble';
import { E, EXPO, clamp01, seg } from './easing';
import { actEval } from './hud';
import { createHover } from './hover';
import { createStream } from './stream';

gsap.registerPlugin(ScrollTrigger);

export type Where = 'top' | 'about' | 'work' | 'contact';
export interface EngineOpts {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  root: HTMLElement;
  /** R3F owns size and DPR; the engine asks R3F to change DPR instead of touching the renderer size. */
  setDpr: (dpr: number) => void;
}
export interface Engine {
  ready(): void;
  go(where: Where): void;
  resize(): void;
  destroy(): void;
}

const MOBILE_MAX = 760;
const SNAP_IDLE_MS = 240;
const SNAP_LOCK_MS = 1700;
const NAV_LOCK_MS = 2900;

export function createEngine(o: EngineOpts): Engine {
  const { gl, scene, camera, root, setDpr } = o;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COARSE = matchMedia('(pointer: coarse)').matches;
  const mobile = () => innerWidth <= MOBILE_MAX;
  const q = <T extends HTMLElement | SVGElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;

  // ---- renderer settings owned by the engine (R3F must not override these) ----
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFSoftShadowMap;
  gl.shadowMap.autoUpdate = false; // baked: refreshed only when something moves
  gl.toneMapping = THREE.NoToneMapping;
  gl.outputColorSpace = THREE.SRGBColorSpace;

  const world = createWorld(scene, mobile());
  const { key, hemi, rim, spot } = world.lights;
  const { dots, hlMat, hlA, hlB, rings } = world.overlays;
  const TR = buildTransitions(world.pieces, world.startSquares);
  let curves: Curves = buildCurves(mobile());
  let wasMobile = mobile();
  const baseDpr = () => Math.min(devicePixelRatio, mobile() ? 1.25 : 1.5);

  // ---- DOM collected ONCE (file 01 section 4) ----
  const actEl = (el: HTMLElement) => AI[el.closest<HTMLElement>('.act')!.dataset.act as ActKey];
  const actEls: HTMLElement[] = [];
  root.querySelectorAll<HTMLElement>('.act').forEach((el) => (actEls[AI[el.dataset.act as ActKey]] = el));
  actEls.forEach((el, i) => (el.style.height = `calc(${ACTS[i].budget}vh + 100vh)`));

  const ui = {
    stages: [...root.querySelectorAll<HTMLElement>('.stage')].map((el) => ({
      el, ai: actEl(el),
      in: el.dataset.in?.split(',').map(Number) as [number, number] | undefined,
      out: el.dataset.out?.split(',').map(Number) as [number, number] | undefined,
    })),
    steps: [...root.querySelectorAll<HTMLElement>('.step')].map((el) => ({ el, ai: actEl(el), at: Number(el.dataset.show) })),
    panels: [...root.querySelectorAll<HTMLElement>('.panel')].map((el) => ({ el, ai: actEl(el) })),
    counts: [...root.querySelectorAll<HTMLElement>('.count')].map((el) => {
      const m = el.dataset.v!.match(/^([^\d]*)([\d,]*\.?\d+)(.*)$/)!;
      return { el, ai: actEl(el), pre: m[1], val: parseFloat(m[2].replace(/,/g, '')), dec: (m[2].split('.')[1] ?? '').length, comma: m[2].includes(','), post: m[3], last: '' };
    }),
    solvers: collectSolvers(root, actEl) as Solver[],
  };
  const hud = {
    bar: q('.evalbar i'), val: q('.evalval'), n: q('.counter .n'), pbar: q('.counter .bar i'), tick: q('.ticker span'),
    ray: q<SVGPathElement & HTMLElement>('#ray') as unknown as SVGPathElement, rayDot: q<SVGCircleElement & HTMLElement>('#rayDot') as unknown as SVGCircleElement,
    files: q('.grid .files'), ranks: q('.grid .ranks'), grid: q('.grid'), engine: q('.engine'), cursor: q('.cursor'),
  };
  const stream = createStream(hud.engine);
  const hover = createHover({ camera, pieces: world.pieces, card: q('.piece-card'), hoverTile: world.overlays.hoverTile, cursor: hud.cursor, reducedMotion: RM });

  // ---- state ----
  const S = { asm: RM ? 1 : 0, heroT: RM ? 1 : 0, ready: false, flipped: null as boolean | null, lastKey: '', lastSig: '', quality: 0 };
  const P = new Array<number>(ACTS.length).fill(0);
  let triggers: ScrollTrigger[] = [];
  let lenis: Lenis | null = null;
  let post: Post | null = null;
  let disposed = false;
  let paused = false;
  let frameNo = 0;
  let lastT = performance.now();
  let ftAvg = 16;
  let lastMove = 0;
  let snapping = false;
  let navLock = false;
  let lastScroll = 0;
  const timers: number[] = [];
  const cleanups: (() => void)[] = [];
  const later = (fn: () => void, ms: number) => void timers.push(window.setTimeout(fn, ms));
  const tmpP = new THREE.Vector3();
  const vP = new THREE.Vector3();
  const vT = new THREE.Vector3();
  const tmpM = new THREE.Matrix4();

  // ---- sizing / quality ----
  function applyQuality() {
    const levels = [baseDpr(), Math.min(baseDpr(), 1.25), 1, 1];
    const d = levels[S.quality];
    setDpr(d);
    gl.setPixelRatio(d);
    post?.composer.setPixelRatio(d);
    if (post) {
      post.bloom.enabled = S.quality < 3;
      post.bokeh.enabled = S.quality < 3;
    }
    S.lastKey = '';
  }
  function resize() {
    const w = innerWidth;
    const h = innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const ms = mobile() ? 1024 : 2048;
    if (key.shadow.mapSize.x !== ms) {
      key.shadow.mapSize.set(ms, ms);
      key.shadow.map?.dispose();
      key.shadow.map = null;
    }
    if (mobile() !== wasMobile) {
      wasMobile = mobile();
      curves = buildCurves(wasMobile);
      if (wasMobile && post) {
        disposePost(post);
        post = null;
      }
    }
    applyQuality();
    post?.composer.setSize(w, h);
    S.lastKey = '';
    S.lastSig = '';
    if (!RM) ScrollTrigger.refresh();
  }

  // ---- snap ----
  const restPx = () => ACTS.map((a, i) => actEls[i].offsetTop + a.rest * (actEls[i].offsetHeight - innerHeight));
  function maybeSnap(now: number) {
    if (RM || COARSE || snapping || navLock || !S.ready || now - lastScroll < SNAP_IDLE_MS) return;
    if (lenis && Math.abs(lenis.velocity) > 0.05) return;
    const y = lenis ? lenis.scroll : scrollY;
    const target = restPx().reduce((b, r) => (Math.abs(r - y) < Math.abs(b - y) ? r : b), 0);
    if (Math.abs(target - y) < 2) return;
    snapping = true;
    later(() => { snapping = false; lastScroll = performance.now(); }, SNAP_LOCK_MS);
    if (lenis) lenis.scrollTo(target, { duration: 1.25, easing: EXPO });
    else scrollTo({ top: target, behavior: 'smooth' });
  }
  const touchScroll = () => { if (!snapping) lastScroll = performance.now(); };

  function go(where: Where) {
    const r = restPx();
    const y = where === 'top' ? 0 : where === 'about' ? r[AI.opening] : where === 'work' ? r[AI.knight] : r[AI.mate];
    navLock = true;
    later(() => { navLock = false; lastScroll = performance.now(); }, NAV_LOCK_MS);
    if (lenis) lenis.scrollTo(y, { duration: 2.6, easing: EXPO });
    else scrollTo({ top: y, behavior: RM ? 'auto' : 'smooth' });
  }

  // ---- the per-frame function ----
  function frame() {
    if (disposed || paused || document.hidden) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastT) / 1000);
    ftAvg = ftAvg * 0.9 + (now - lastT) * 0.1;
    lastT = now;
    frameNo++;
    const mob = mobile();

    // progress of every act, and the active one
    for (let i = 0; i < ACTS.length; i++) P[i] = RM ? 0 : triggers[i] ? triggers[i].progress : 0;
    let ai = 0;
    P.forEach((p, i) => { if (p > 0) ai = i; });
    const lp = P[ai];
    const act = ACTS[ai];
    const pos = POS[act.k as PosKey] as (typeof POS)[PosKey] | undefined;
    const vel = lenis ? lenis.velocity : 0;

    // layout read first, before any style writes (no forced reflow)
    const decisionRect = pos && !RM && !mob ? actEls[ai].querySelector<HTMLElement>('.decision')?.getBoundingClientRect() : undefined;

    // adaptive quality only while moving; resting frames always render at full quality
    const moving = Math.abs(vel) > 0.01 || snapping || navLock;
    if (moving) lastMove = now;
    if (!RM && moving && ftAvg > 20 && S.quality < 3 && frameNo % 20 === 0) { S.quality++; applyQuality(); }
    if (S.quality > 0 && now - lastMove > 150) { S.quality = 0; ftAvg = 16; applyQuality(); }

    // camera on the spline
    const u = RM ? 1 : camU(ai, lp);
    curves.pos.getPoint(u / 12, vP);
    curves.tgt.getPoint(u / 12, vT);
    if (!RM) vP.sub(vT).multiplyScalar(1 - 0.22 * (1 - E(S.asm))).add(vT);
    camera.position.copy(vP);
    camera.lookAt(vT);

    // panel shutters
    let pa = 0;
    if (!RM)
      for (const pn of ui.panels) {
        const l = P[pn.ai];
        const v = E(seg(l, WIN.panelOpen[0], WIN.panelOpen[1])) * (1 - E(seg(l, WIN.panelClose[0], WIN.panelClose[1])));
        if (pn.ai === ai) pa = v;
        const x = (1 - v) * 100;
        pn.el.style.clipPath = mob ? `inset(${x}% 0 0 0)` : `inset(0 0 ${x}% 0)`;
        pn.el.style.visibility = v > 0.002 ? 'visible' : 'hidden';
      }
    const sh: [number, number] = mob ? [0, 0.2] : act.k === 'mate' ? [0.15, 0] : [0.2, 0];
    const sa = act.k === 'mate' ? E(seg(lp, WIN.mateSlab[0], WIN.mateSlab[1])) : pa;
    camera.setViewOffset(innerWidth, innerHeight, sh[0] * sa * innerWidth, sh[1] * sa * innerHeight, innerWidth, innerHeight);

    // DOM stages, steps, counts, scramble
    if (!RM) {
      for (const st of ui.stages) {
        const l = P[st.ai];
        let o = 1;
        if (st.in) o *= E(seg(l, st.in[0], st.in[1]));
        if (st.out) o *= 1 - E(seg(l, st.out[0], st.out[1]));
        if (st.ai === 0 && !S.ready) o = 0;
        st.el.style.opacity = String(o);
        st.el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
      }
      for (const s of ui.steps) {
        const o = E(seg(P[s.ai], s.at, s.at + 0.07));
        s.el.style.opacity = String(o);
        s.el.style.transform = `translate3d(0,${(1 - o) * 14}px,0)`;
      }
      for (const c of ui.counts) {
        const t = E(seg(P[c.ai], WIN.count[0], WIN.count[1]));
        let v = (c.val * t).toFixed(c.dec);
        if (c.comma) v = Number(v).toLocaleString('en-US', { minimumFractionDigits: c.dec, maximumFractionDigits: c.dec });
        const s = c.pre + v + c.post;
        if (s !== c.last) { c.el.textContent = s; c.last = s; }
      }
      if (frameNo % 2 === 0)
        for (const s of ui.solvers) {
          const r = !s.win ? S.heroT : s.ai === ai || P[s.ai] >= 1 ? seg(P[s.ai], s.win[0], s.win[1]) : P[s.ai] > 0 ? 1 : 0;
          if (r >= 1) {
            if (s.last !== 1) { s.el.classList.remove('solving'); s.last = 1; }
            continue;
          }
          s.el.classList.add('solving');
          s.last = r;
          s.scr.textContent = scramble(s.txt, Math.floor(r * s.txt.length));
        }
    }

    // pieces
    let sig = applyProgress(world.pieces, TR, P) + writeInstances(world.pieces, world.insts, S.asm, RM);

    // overlays on the board
    let dotO = 0;
    let hlO = 0;
    let rip = 0;
    if (pos && !RM) {
      dotO = E(seg(lp, WIN.dotsIn[0], WIN.dotsIn[1])) * (1 - E(seg(lp, WIN.dotsOut[0], WIN.dotsOut[1])));
      hlO = E(seg(lp, WIN.hlIn[0], WIN.hlIn[1])) * (1 - E(seg(lp, WIN.hlOut[0], WIN.hlOut[1])));
      rip = seg(lp, WIN.ripple[0], WIN.ripple[1]);
      if (dotO > 0) {
        pos.dots.forEach((sq, i) => { const [x, z] = sq2xz(sq); tmpM.makeTranslation(x, 0, z); dots.setMatrixAt(i, tmpM); });
        dots.count = pos.dots.length;
        dots.instanceMatrix.needsUpdate = true;
      }
      const [ax, az] = sq2xz(pos.mv[0]);
      const [bx, bz] = sq2xz(pos.mv[1]);
      hlA.position.set(ax, 0.005, az);
      hlB.position.set(bx, 0.005, bz);
      rings.forEach((r, i) => {
        const t = seg(rip, i * 0.18, i * 0.18 + 0.64);
        r.position.set(bx, 0.007, bz);
        r.scale.setScalar(0.6 + t * 4.2);
        (r.material as THREE.MeshBasicMaterial).opacity = Math.sin(Math.PI * t) * 0.55;
      });
    } else rings.forEach((r) => ((r.material as THREE.MeshBasicMaterial).opacity = 0));
    (dots.material as THREE.MeshBasicMaterial).opacity = dotO * 0.55;
    dots.visible = dotO > 0;
    hlMat.opacity = hlO * 0.26;
    hlA.visible = hlB.visible = hlO > 0;

    // checkmate: one light on the lone king
    const sp = act.k === 'mate' && !RM ? E(seg(lp, WIN.spot[0], WIN.spot[1])) : 0;
    spot.intensity = sp * 70;
    key.intensity = 1.9 * (1 - 0.6 * sp);
    hemi.intensity = 0.38 * (1 - 0.5 * sp);
    rim.intensity = 0.55 * (1 - 0.7 * sp);

    // rack focus
    let ap = 0;
    if (post) {
      ap = (ai === 0 ? 0.0009 : 0.00035) + pa * 0.0042;
      (post.bokeh.uniforms as Record<string, { value: number }>).focus.value = vP.distanceTo(vT);
      (post.bokeh.uniforms as Record<string, { value: number }>).aperture.value = ap;
    }

    // HUD
    const [ef, et] = RM ? [0.5, '0.00'] : actEval(ai, lp);
    hud.bar.style.transform = mob ? `scaleX(${ef})` : `scaleY(${ef})`;
    if (hud.val.textContent !== et) hud.val.textContent = et;
    const total = document.documentElement.scrollHeight - innerHeight;
    const gp = total > 0 ? clamp01((lenis ? lenis.scroll : scrollY) / total) : 0;
    const mv = `Move ${String(1 + Math.round(gp * 39)).padStart(2, '0')} / 40`;
    if (hud.n.textContent !== mv) hud.n.textContent = mv;
    hud.pbar.style.transform = `scaleX(${gp})`;
    const played = TICK.filter(([, k, t]) => P[AI[k as ActKey]] >= t);
    const tk = played.map(([s], i) => (i === played.length - 1 ? `<b>${s}</b>` : s)).join('  ');
    if (hud.tick.innerHTML !== tk) hud.tick.innerHTML = tk;

    // coordinates follow the side the camera is on
    const flipped = vP.z - vT.z < -0.5;
    if (flipped !== S.flipped) {
      const first = S.flipped === null;
      S.flipped = flipped;
      hud.grid.classList.add('flipping');
      later(() => {
        const f = 'abcdefgh'.split('');
        const r = '87654321'.split('');
        if (flipped) { f.reverse(); r.reverse(); }
        hud.files.innerHTML = f.map((x) => `<span>${x}</span>`).join('');
        hud.ranks.innerHTML = r.map((x) => `<span>${x}</span>`).join('');
        hud.grid.classList.remove('flipping');
      }, first ? 0 : 380);
    }

    // cause -> effect ray (decision line to the landed square)
    const draw = decisionRect && pos ? E(seg(lp, WIN.rayIn[0], WIN.rayIn[1])) * (1 - E(seg(lp, WIN.rayOut[0], WIN.rayOut[1]))) : 0;
    if (draw > 0 && decisionRect && pos) {
      const [bx, bz] = sq2xz(pos.mv[1]);
      tmpP.set(bx, 0.55, bz).project(camera); // includes the view offset
      const px = ((tmpP.x + 1) / 2) * innerWidth;
      const py = ((1 - tmpP.y) / 2) * innerHeight;
      hud.ray.setAttribute('d', `M${decisionRect.left - 8},${decisionRect.top + decisionRect.height / 2} H${px} V${py}`);
      const L = hud.ray.getTotalLength();
      hud.ray.style.strokeDasharray = String(L);
      hud.ray.style.strokeDashoffset = String(L * (1 - draw));
      hud.rayDot.setAttribute('cx', String(draw > 0.96 ? px : -20));
      hud.rayDot.setAttribute('cy', String(draw > 0.96 ? py : -20));
      hud.ray.style.opacity = '1';
    } else {
      hud.ray.style.opacity = '0';
      hud.rayDot.setAttribute('cx', '-20');
    }

    if (!RM && !mob) stream.tick(dt, vel, ai, lp);
    maybeSnap(now);

    // piece hover card + square highlight (hidden while the page is scrolling, snapping or loading)
    const hoverSig = hover.update({ active: S.ready && Math.abs(vel) <= 0.05 && !snapping && !navLock, ai, lp, dt });

    // render on demand: only when something in the 3D scene changed
    sig += sp * 100;
    const k = [vP.x, vP.y, vP.z, vT.x, vT.y, vT.z, sa, sig, dotO, hlO, rip, sp, ap, hoverSig, innerWidth, innerHeight, S.quality].map((n) => n.toFixed(4)).join();
    if (k !== S.lastKey) {
      const sg = sig.toFixed(3);
      if (sg !== S.lastSig || sp > 0) { gl.shadowMap.needsUpdate = true; S.lastSig = sg; }
      S.lastKey = k;
      if (post) post.composer.render();
      else gl.render(scene, camera);
    }
  }

  // ---- context loss ----
  const canvas = gl.domElement;
  const onLost = (e: Event) => {
    e.preventDefault();
    paused = true;
    later(() => { if (paused) { root.classList.add('gl-failed'); document.documentElement.classList.add('rm'); } }, 3000);
  };
  const onRestored = () => {
    paused = false;
    root.classList.remove('gl-failed');
    disposePost(post);
    post = null;
    S.lastKey = '';
    S.lastSig = '';
    void startPost();
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  async function startPost() {
    if (RM || mobile()) return;
    const p = await setupPost(gl, scene, camera, innerWidth, innerHeight, baseDpr());
    if (disposed) return disposePost(p);
    post = p;
    applyQuality();
  }

  // ---- cursor: a square that snaps to the 12-column grid ----
  const onMouse = (e: MouseEvent) => {
    const gl0 = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gl')) || 32;
    const cell = (innerWidth - gl0 * 2) / (mobile() ? 4 : 12);
    const x = gl0 + Math.floor((e.clientX - gl0) / cell) * cell;
    const y = Math.floor(e.clientY / cell) * cell;
    hud.cursor.style.width = hud.cursor.style.height = cell + 'px';
    hud.cursor.style.transform = `translate3d(${x}px,${y}px,0)`;
  };
  if (!COARSE && !RM) addEventListener('mousemove', onMouse, { passive: true });

  // ---- scroll setup ----
  if (!RM) {
    ACTS.forEach((_, i) => triggers.push(ScrollTrigger.create({ trigger: actEls[i], start: 'top top', end: 'bottom bottom' })));
    lenis = new Lenis({ duration: 1.5, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true });
    lenis.on('scroll', () => { ScrollTrigger.update(); touchScroll(); });
    gsap.ticker.add(lenisRaf);
    gsap.ticker.lagSmoothing(0);
    addEventListener('scroll', touchScroll, { passive: true });
    ScrollTrigger.refresh();
  } else {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('seen')), { threshold: 0.12 });
    root.querySelectorAll('.fade').forEach((el) => io.observe(el));
    cleanups.push(() => io.disconnect());
  }
  function lenisRaf(t: number) { lenis?.raf(t * 1000); }

  resize();
  gsap.ticker.add(frame);
  void startPost();
  const onResize = () => resize();
  addEventListener('resize', onResize);

  return {
    resize,
    go,
    ready() {
      S.ready = true;
      if (RM) return;
      gsap.to(S, { asm: 1, duration: 1.8, ease: 'power3.out' });
      gsap.to(S, { heroT: 1, duration: 0.85, ease: 'none', delay: 0.35 });
    },
    destroy() {
      disposed = true;
      gsap.ticker.remove(frame);
      gsap.ticker.remove(lenisRaf);
      gsap.killTweensOf(S);
      triggers.forEach((t) => t.kill());
      triggers = [];
      lenis?.destroy();
      removeEventListener('resize', onResize);
      removeEventListener('scroll', touchScroll);
      removeEventListener('mousemove', onMouse);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      timers.forEach(clearTimeout);
      cleanups.forEach((c) => c());
      ui.solvers.forEach((s) => s.scr.remove());
      hover.destroy();
      disposePost(post);
      world.dispose();
      camera.clearViewOffset();
    },
  };
}
