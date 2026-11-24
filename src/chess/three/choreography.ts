import * as THREE from 'three';
import { AI, type ActKey } from '../data/acts';
import { OPENING_MOVES, POS, POS_KEYS } from '../data/positions';
import { PROJ } from '../data/projects';
import { E, lerp, seg } from '../engine/easing';
import { sq2xz, type Piece } from './world';

/** arrangement: piece id -> square, or null once captured */
export type Arrangement = Map<number, string | null>;
type PieceLike = Pick<Piece, 'id' | 'type' | 'c'>;

const TYPE: Record<string, Piece['type']> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

export function parseFEN(fen: string): { type: Piece['type']; c: 'w' | 'b'; sq: string }[] {
  const out: { type: Piece['type']; c: 'w' | 'b'; sq: string }[] = [];
  fen.split(' ')[0].split('/').forEach((row, ri) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        out.push({ type: TYPE[ch.toLowerCase()], c: ch === ch.toUpperCase() ? 'w' : 'b', sq: 'abcdefgh'[f] + (8 - ri) });
        f++;
      }
    }
  });
  return out;
}

const sqDist = (a: string, b: string) => {
  const [ax, az] = sq2xz(a);
  const [bx, bz] = sq2xz(b);
  return Math.hypot(ax - bx, az - bz);
};

/** Turns an arrangement into the given position with the fewest/shortest moves (greedy by distance). */
export function assign(pieces: PieceLike[], prev: Arrangement, fen: string): Arrangement {
  const specs = parseFEN(fen);
  const pairs: [number, number, number][] = [];
  specs.forEach((s, si) => {
    for (const [id, sq] of prev) if (sq && pieces[id].type === s.type && pieces[id].c === s.c) pairs.push([sqDist(sq, s.sq), si, id]);
  });
  pairs.sort((a, b) => a[0] - b[0]);
  const next: Arrangement = new Map();
  const usedSpec = new Set<number>();
  const usedId = new Set<number>();
  for (const [, si, id] of pairs) {
    if (usedSpec.has(si) || usedId.has(id)) continue;
    usedSpec.add(si);
    usedId.add(id);
    next.set(id, specs[si].sq);
  }
  if (usedSpec.size !== specs.length) throw new Error('position needs a piece that has left the board');
  for (const [id] of prev) if (!next.has(id)) next.set(id, null);
  return next;
}

export function play(prev: Arrangement, from: string, to: string): Arrangement {
  const next: Arrangement = new Map(prev);
  let mover = -1;
  for (const [id, sq] of next) if (sq === from) mover = id;
  if (mover < 0) throw new Error(`no piece on ${from}`);
  for (const [id, sq] of next) if (sq === to) next.set(id, null);
  next.set(mover, to);
  return next;
}

export interface Change {
  id: number;
  from: [number, number];
  to: [number, number];
  /** squares (null = graveyard), kept for the hover card */
  fromSq: string | null;
  toSq: string | null;
  out: boolean;
  lift: number;
  d: number;
  /** 'move' = a real chess move, 'setup' = the board rearranging into a position */
  kind: 'move' | 'setup';
  san: string | null;
  /** 'Opening' | 'Position 01' .. 'Position 04' */
  label: string;
}
export interface Transition {
  ai: number;
  ls: number;
  le: number;
  stagger: number;
  changes: Change[];
}

function graveSlot(counter: Record<'w' | 'b', number>, slots: Map<number, [number, number]>, p: PieceLike): [number, number] {
  let s = slots.get(p.id);
  if (!s) {
    const i = counter[p.c]++;
    const col = Math.floor(i / 8);
    const row = i % 8;
    s = p.c === 'w' ? [5.15 + col * 0.72, 3.2 - row * 0.78] : [-5.15 - col * 0.72, -3.2 + row * 0.78];
    slots.set(p.id, s);
  }
  return s;
}

/** Builds the ordered transition list (file 06 section 3). Later transitions override earlier ones. */
export function buildTransitions(pieces: Piece[], start: Map<number, string>): Transition[] {
  const TR: Transition[] = [];
  const counter = { w: 0, b: 0 };
  const slots = new Map<number, [number, number]>();
  let A: Arrangement = new Map(start);

  const push = (next: Arrangement, act: ActKey, ls: number, le: number, lift: number, stagger: number, kind: 'move' | 'setup', san: string | null, label: string) => {
    const changes: Change[] = [];
    for (const [id, sq] of next) {
      const was = A.get(id) ?? null;
      if (was === sq) continue;
      changes.push({
        id,
        from: was ? sq2xz(was) : graveSlot(counter, slots, pieces[id]),
        to: sq ? sq2xz(sq) : graveSlot(counter, slots, pieces[id]),
        fromSq: was,
        toSq: sq,
        out: !sq,
        lift: sq ? lift : 0.7,
        d: 0,
        kind,
        san,
        label,
      });
    }
    changes.forEach((c, i) => (c.d = stagger ? (i / Math.max(1, changes.length - 1)) * stagger : 0));
    TR.push({ ai: AI[act], ls, le, stagger, changes });
    A = next;
  };

  const windows: [number, number][] = [[0.3, 0.42], [0.4, 0.5], [0.52, 0.64], [0.62, 0.72]];
  const OPENING_SAN = ['e4', 'e5', 'd4', 'd5'];
  const movers = (tr: Transition) => tr.changes.filter((c) => c.kind === 'move' && !c.out).map((c) => c.id);
  OPENING_MOVES.forEach(([f, t], i) => {
    push(play(A, f, t), 'opening', windows[i][0], windows[i][1], 0.12, 0, 'move', OPENING_SAN[i], 'Opening');
    movers(TR[TR.length - 1]).forEach((id) => (pieces[id].role = 'The premises · Opening'));
  });
  POS_KEYS.forEach((k, n) => {
    const P = POS[k];
    const label = `Position ${PROJ[k].no}`;
    push(assign(pieces, A, P.fen), k, 0, 0.22, 0.3, 0.4, 'setup', null, label);
    push(play(A, P.mv[0], P.mv[1]), k, 0.54, 0.64, k === 'knight' ? 0.95 : 0.16, 0, 'move', P.san, label);
    // the piece that plays the solution represents this project
    movers(TR[TR.length - 1]).forEach((id) => (pieces[id].role = `${PROJ[k].name} · ${label}`));
    if (P.reply) push(play(A, P.reply[0], P.reply[1]), k, 0.66, 0.74, 0.1, 0, 'move', 'Kf8', label);
    void n;
  });
  const bk = pieces.find((p) => p.startSq === 'e8');
  if (bk) bk.role = 'The last piece standing · Checkmate';
  return TR;
}

/** Writes x/y/z/s on every piece for progress vector P. Pure in P. Returns a numeric signature of the arrangement. */
export function applyProgress(pieces: Piece[], TR: Transition[], P: number[]): number {
  for (const p of pieces) {
    p.x = p.x0;
    p.z = p.z0;
    p.y = 0;
    p.s = 1;
    p.state = 'board';
    p.sq = p.startSq;
    p.moveFrom = p.moveTo = p.moveSan = p.moveKind = p.moveLabel = p.clearedFor = null;
  }
  let sig = 0;
  for (const tr of TR) {
    const t = seg(P[tr.ai], tr.ls, tr.le);
    if (t <= 0) continue;
    for (const c of tr.changes) {
      const lt = E(tr.stagger ? seg(t, c.d, c.d + (1 - tr.stagger)) : t);
      sig += lt;
      if (lt <= 0) continue;
      const p = pieces[c.id];
      p.x = lerp(c.from[0], c.to[0], lt);
      p.z = lerp(c.from[1], c.to[1], lt);
      p.y = Math.sin(Math.PI * lt) * c.lift;
      p.s = c.out ? 1 - 0.16 * lt : 1;
      // current state for the hover card: the last change with lt > 0 wins
      if (lt < 1) {
        p.state = 'moving';
        p.moveFrom = c.fromSq;
        p.moveTo = c.toSq;
        p.moveSan = c.san;
        p.moveKind = c.kind;
        p.moveLabel = c.label;
        p.sq = null;
      } else if (c.toSq) {
        p.state = 'board';
        p.sq = c.toSq;
        p.moveFrom = p.moveTo = p.moveSan = p.moveKind = p.moveLabel = null;
      } else {
        p.state = 'off';
        p.sq = null;
        p.clearedFor = c.label;
        p.moveFrom = p.moveTo = p.moveSan = p.moveKind = p.moveLabel = null;
      }
    }
  }
  return sig;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Load-in assembly (pieces drop into place, staggered) + instance matrix writes. Returns signature contribution. */
export function writeInstances(pieces: Piece[], insts: THREE.InstancedMesh[], asm: number, reduced: boolean): number {
  let sig = 0;
  for (const p of pieces) {
    const order = (p.c === 'w' ? 0 : 16) + (p.type === 'pawn' ? 8 : 0) + p.idx;
    const a = reduced ? 1 : E(seg(asm, (order / 32) * 0.5, (order / 32) * 0.5 + 0.5));
    p.ry = p.y + (1 - a) * 1.4;
    p.rs = p.s * (0.6 + 0.4 * a);
    tmpP.set(p.x, p.ry, p.z);
    tmpQ.setFromAxisAngle(UP, p.rotY);
    tmpS.setScalar(p.rs);
    p.inst.setMatrixAt(p.idx, tmpM.compose(tmpP, tmpQ, tmpS));
    sig += a;
  }
  for (const m of insts) m.instanceMatrix.needsUpdate = true;
  return sig;
}
