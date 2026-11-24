import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ACTS, WIN } from './data/acts';
import { SHOTS } from './data/shots';
import { FINALE_FEN, POS, POS_KEYS } from './data/positions';
import { applyProgress, assign, buildTransitions, parseFEN, play } from './three/choreography';
import { createWorld, sq2xz } from './three/world';
import { actEval, evalFill } from './engine/hud';
import { scramble } from './text/scramble';
import { E, seg } from './engine/easing';

const world = createWorld(new THREE.Scene(), false);
const TR = buildTransitions(world.pieces, world.startSquares);
const P0 = () => new Array(ACTS.length).fill(0);

describe('timeline tables', () => {
  it('act budgets total 840vh', () => expect(ACTS.reduce((s, a) => s + a.budget, 0)).toBe(840));
  it('camera stops are monotonic and reference real shots', () => {
    for (const a of ACTS) {
      a.stops.forEach(([lp, shot], i) => {
        expect(lp).toBeGreaterThanOrEqual(0);
        expect(lp).toBeLessThanOrEqual(1);
        expect(shot).toBeGreaterThanOrEqual(0);
        expect(shot).toBeLessThan(SHOTS.length);
        if (i) expect(lp).toBeGreaterThan(a.stops[i - 1][0]);
      });
      expect(a.rest).toBeGreaterThanOrEqual(0);
      expect(a.rest).toBeLessThanOrEqual(1);
    }
  });
  it('named windows are ordered inside [0,1]', () => {
    for (const w of Object.values(WIN)) {
      expect(w[0]).toBeGreaterThanOrEqual(0);
      expect(w[1]).toBeLessThanOrEqual(1);
      expect(w[0]).toBeLessThan(w[1]);
    }
  });
  it('easing never overshoots', () => {
    for (let t = 0; t <= 1; t += 0.01) {
      expect(E(t)).toBeGreaterThanOrEqual(0);
      expect(E(t)).toBeLessThanOrEqual(1);
    }
    expect(seg(5, 0, 1)).toBe(1);
  });
});

describe('chess arrangement chain', () => {
  it('starts with 32 pieces and every position only removes pieces', () => {
    let A = new Map(world.startSquares) as Map<number, string | null>;
    let prev = 32;
    for (const k of POS_KEYS) {
      A = assign(world.pieces, A, POS[k].fen);
      const n = [...A.values()].filter(Boolean).length;
      expect(n).toBe(parseFEN(POS[k].fen).length);
      expect(n).toBeLessThanOrEqual(prev);
      prev = n;
      A = play(A, POS[k].mv[0], POS[k].mv[1]);
    }
  });
  it('the final board matches the finale FEN minus the unplayed mate', () => {
    // at full progress the queen position has been played and Black replied Kf8
    const P = ACTS.map(() => 1);
    applyProgress(world.pieces, TR, P);
    const onBoard = world.pieces.filter((p) => Math.abs(p.s - 1) < 1e-9);
    const want = parseFEN(FINALE_FEN);
    expect(onBoard.length).toBe(want.length);
    for (const w of want) {
      const [x, z] = sq2xz(w.sq);
      expect(onBoard.some((p) => p.type === w.type && p.c === w.c && Math.abs(p.x - x) < 1e-6 && Math.abs(p.z - z) < 1e-6)).toBe(true);
    }
  });
});

describe('scroll reversibility', () => {
  const snapshot = () => world.pieces.map((p) => [p.x, p.y, p.z, p.s].map((n) => n.toFixed(6)).join());
  it('the same progress always yields the same arrangement, regardless of path', () => {
    const rnd = (() => { let s = 7; return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); })();
    for (let n = 0; n < 40; n++) {
      const P = ACTS.map((_, i) => (i < Math.floor(rnd() * 8) ? 1 : i === Math.floor(rnd() * 8) ? rnd() : 0));
      applyProgress(world.pieces, TR, P);
      const a = snapshot();
      applyProgress(world.pieces, TR, ACTS.map(() => 1)); // scroll to the end
      applyProgress(world.pieces, TR, P0()); // and back to the start
      applyProgress(world.pieces, TR, P);
      expect(snapshot()).toEqual(a);
    }
  });
  it('the start position is restored at zero progress', () => {
    applyProgress(world.pieces, TR, P0());
    world.pieces.forEach((p) => {
      expect(p.x).toBe(p.x0);
      expect(p.z).toBe(p.z0);
      expect(p.y).toBe(0);
    });
  });
});

describe('HUD and text', () => {
  it('eval bar fills monotonically and mate fills the bar', () => {
    expect(evalFill(0)).toBeCloseTo(0.5);
    expect(evalFill(5)).toBeGreaterThan(evalFill(1));
    expect(evalFill('M1')).toBe(1);
  });
  it('evaluation swings from before to after in each position act', () => {
    const [f0] = actEval(3, 0.5);
    const [f1] = actEval(3, 0.9);
    expect(f1).toBeGreaterThan(f0);
  });
  it('scramble keeps length, spaces and the solved prefix', () => {
    const out = scramble('Mate in one.', 4, () => 0.3);
    expect(out.length).toBe(12);
    expect(out.slice(0, 4)).toBe('Mate');
    expect(out[4]).toBe(' ');
  });
});

// ---------------- piece hover (spec 11) ----------------
import { vi } from 'vitest';
import { AI } from './data/acts';
import { PICK_H, pickPiece, rayCylinder } from './engine/picking';
import { describePiece } from './engine/hover';

/** progress vector: acts before `act` complete, `act` at lp, the rest untouched */
const at = (act: number, lp: number) => ACTS.map((_, i) => (i < act ? 1 : i === act ? lp : 0));
const state = () => world.pieces.map((p) => [p.state, p.sq, p.moveFrom, p.moveTo, p.moveSan, p.moveKind, p.moveLabel, p.clearedFor].join('|'));
const byRole = (needle: string) => world.pieces.filter((p) => p.role?.includes(needle));

describe('rayCylinder', () => {
  const o = new THREE.Vector3();
  const d = new THREE.Vector3();
  it('hits the top cap straight down at t = height above the cap', () => {
    o.set(0, 5, 0); d.set(0, -1, 0);
    expect(rayCylinder(o, d, 0, 0, 0.3, 0, 1)).toBeCloseTo(4);
  });
  it('hits the side wall on a horizontal ray', () => {
    o.set(-5, 0.5, 0); d.set(1, 0, 0);
    expect(rayCylinder(o, d, 0, 0, 0.3, 0, 1)).toBeCloseTo(4.7);
  });
  it('misses outside the radius, above the top and behind the ray', () => {
    o.set(-5, 0.5, 0.5); d.set(1, 0, 0);
    expect(rayCylinder(o, d, 0, 0, 0.3, 0, 1)).toBeNull();
    o.set(-5, 2, 0); d.set(1, 0, 0);
    expect(rayCylinder(o, d, 0, 0, 0.3, 0, 1)).toBeNull();
    o.set(5, 0.5, 0); d.set(1, 0, 0);
    expect(rayCylinder(o, d, 0, 0, 0.3, 0, 1)).toBeNull();
  });
});

describe('pickPiece', () => {
  it('returns the nearer of two pieces on the same line of sight, and -1 on empty board', () => {
    vi.stubGlobal('innerWidth', 100);
    vi.stubGlobal('innerHeight', 100);
    const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    cam.position.set(0, 0.5, -6);
    cam.lookAt(0, 0.5, 0);
    cam.updateMatrixWorld(true);
    const saved = world.pieces.map((p) => [p.x, p.z, p.ry, p.rs]);
    world.pieces.forEach((p) => { p.x = 99; p.z = 99; p.ry = 0; p.rs = 1; });
    const [near, far] = [world.pieces[1], world.pieces[2]];
    near.x = 0; near.z = 0;
    far.x = 0; far.z = 3;
    expect(pickPiece(cam, world.pieces, 50, 50)).toBe(near.id);
    far.z = -2; // now the other one is nearer
    expect(pickPiece(cam, world.pieces, 50, 50)).toBe(far.id);
    expect(pickPiece(cam, world.pieces, 2, 2)).toBe(-1);
    world.pieces.forEach((p, i) => { [p.x, p.z, p.ry, p.rs] = saved[i] as number[]; });
    expect(PICK_H.queen).toBeGreaterThan(PICK_H.pawn);
    vi.unstubAllGlobals();
  });
});

describe('piece state follows scroll progress', () => {
  it('all pieces are on their start squares at zero progress', () => {
    applyProgress(world.pieces, TR, P0());
    world.pieces.forEach((p) => {
      expect(p.state).toBe('board');
      expect(p.sq).toBe(p.startSq);
    });
  });
  it('the CoreOS knight is moving d5 to c7 (Nc7+) mid-move, then stands on c7', () => {
    const knight = byRole('CoreOS')[0];
    applyProgress(world.pieces, TR, at(AI.knight, 0.59));
    expect(knight.state).toBe('moving');
    expect([knight.moveFrom, knight.moveTo, knight.moveSan, knight.moveKind]).toEqual(['d5', 'c7', 'Nc7+', 'move']);
    applyProgress(world.pieces, TR, at(AI.knight, 0.7));
    expect([knight.state, knight.sq]).toEqual(['board', 'c7']);
  });
  it('the board rearranging is a setup move, and cleared pieces end up off the board', () => {
    applyProgress(world.pieces, TR, at(AI.bishop, 0.1));
    expect(world.pieces.some((p) => p.state === 'moving' && p.moveKind === 'setup' && p.moveLabel === 'Position 02')).toBe(true);
    applyProgress(world.pieces, TR, at(AI.bishop, 0.3));
    const off = world.pieces.filter((p) => p.state === 'off' && p.clearedFor === 'Position 02');
    expect(off.length).toBeGreaterThan(0);
  });
  it('state is identical after scrolling to the end and back', () => {
    for (const P of [at(AI.knight, 0.59), at(AI.bishop, 0.3), at(AI.queen, 0.7), at(AI.mate, 0.5)]) {
      applyProgress(world.pieces, TR, P);
      const a = state();
      applyProgress(world.pieces, TR, ACTS.map(() => 1));
      applyProgress(world.pieces, TR, P0());
      applyProgress(world.pieces, TR, P);
      expect(state()).toEqual(a);
    }
  });
});

describe('piece roles', () => {
  it('each project is represented by exactly one piece, of the right type', () => {
    const want: [string, string][] = [['CoreOS', 'knight'], ['Harlow & Pine', 'bishop'], ['Summit Ridge Roofing', 'rook'], ['Meridian Solar', 'queen']];
    for (const [name, type] of want) {
      const ps = byRole(name);
      expect(ps).toHaveLength(1);
      expect(ps[0].type).toBe(type);
      expect(ps[0].c).toBe('w');
    }
  });
  it('the black king and the four opening pawns have roles', () => {
    const k = world.pieces.find((p) => p.startSq === 'e8')!;
    expect(k.role).toBe('The last piece standing · Checkmate');
    const pawns = byRole('The premises');
    expect(pawns).toHaveLength(4);
    expect(pawns.every((p) => p.type === 'pawn')).toBe(true);
  });
});

describe('describePiece', () => {
  it('describes a moving knight with notation, status, started square and role', () => {
    const knight = byRole('CoreOS')[0];
    applyProgress(world.pieces, TR, at(AI.knight, 0.59));
    const d = describePiece(knight, AI.knight, 0.59);
    expect(d.eyebrow).toBe('White · Knight');
    expect(d.note).toBe('N' + 'd5–c7');
    expect(d.title).toBe('Knight, moving');
    expect(d.status).toBe('Moving d5 → c7 · Nc7+');
    expect(d.started).toBe('b1');
    expect(d.role).toBe('CoreOS · Position 01');
  });
  it('shows the legal-move count only for the piece about to play, before it plays', () => {
    const knight = byRole('CoreOS')[0];
    applyProgress(world.pieces, TR, at(AI.knight, 0.4));
    expect(describePiece(knight, AI.knight, 0.4).legal).toBe(`${POS.knight.dots.length} moves`);
    const pawn = world.pieces.find((p) => p.type === 'pawn' && p.c === 'w' && p.state === 'board')!;
    expect(describePiece(pawn, AI.knight, 0.4).legal).toBeNull();
    applyProgress(world.pieces, TR, at(AI.knight, 0.9));
    expect(describePiece(knight, AI.knight, 0.9).legal).toBeNull();
  });
  it('describes a piece resting on the board and a captured piece', () => {
    applyProgress(world.pieces, TR, P0());
    const pawn = world.pieces.find((p) => p.type === 'pawn' && p.startSq === 'e2')!;
    const d = describePiece(pawn, 0, 0);
    expect([d.note, d.title, d.status, d.role]).toEqual(['e2', 'Pawn on e2', 'On the board', null]);
    applyProgress(world.pieces, TR, at(AI.bishop, 0.3));
    const off = world.pieces.find((p) => p.state === 'off')!;
    expect(describePiece(off, AI.bishop, 0.3).status).toBe('Off the board · cleared for Position 02');
  });
});
