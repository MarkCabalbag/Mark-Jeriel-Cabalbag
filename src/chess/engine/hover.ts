import * as THREE from 'three';
import { ACTS } from '../data/acts';
import { PIECE_INFO } from '../data/pieceInfo';
import { POS, type PosKey } from '../data/positions';
import { sq2xz, type Piece } from '../three/world';
import { pickPiece } from './picking';

export interface HoverOpts {
  camera: THREE.PerspectiveCamera;
  pieces: Piece[];
  /** the .piece-card element (see layers/Chrome.tsx) */
  card: HTMLElement;
  hoverTile: THREE.Mesh;
  /** the grid-snapping cursor square, hidden while the card shows */
  cursor: HTMLElement;
  reducedMotion: boolean;
}
export interface HoverCtx {
  /** false while loading, scrolling, snapping or navigating */
  active: boolean;
  ai: number;
  lp: number;
  dt: number;
}
export interface Hover {
  /** Call once per frame. Returns a number that changes whenever the hover visuals change (for the render key). */
  update(ctx: HoverCtx): number;
  destroy(): void;
}

const NOOP: Hover = { update: () => 0, destroy: () => {} };
/** DOM that always wins over the board (spec 11 section 6.3). */
const BLOCK = '.panel, .slab, .nav, .hero .name, .hero .foot, .reveal .stage, a, button, .piece-card';
const TILE_OPACITY = 0.18;
const EDGE = 16;
const OFFSET = 18;

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const colour = (c: 'w' | 'b') => (c === 'w' ? 'White' : 'Black');

/** Everything the card shows for a piece, as plain strings. Pure, so it can be unit tested. */
export function describePiece(p: Piece, ai: number, lp: number) {
  const info = PIECE_INFO[p.type];
  let note: string;
  let title: string;
  let status: string;
  if (p.state === 'moving') {
    note = `${info.letter}${p.moveFrom ?? ''}–${p.moveTo ?? 'x'}`;
    title = `${info.name}, moving`;
    status =
      p.moveKind === 'setup'
        ? `Repositioning for ${p.moveLabel}`
        : p.moveTo
          ? `Moving ${p.moveFrom} → ${p.moveTo}${p.moveSan ? ` · ${p.moveSan}` : ''}`
          : `Moving ${p.moveFrom} → off the board`;
  } else if (p.state === 'off') {
    note = 'x';
    title = `${info.name}, off the board`;
    status = `Off the board · cleared for ${p.clearedFor}`;
  } else {
    note = `${info.letter}${p.sq}`;
    title = `${info.name} on ${p.sq}`;
    status = 'On the board';
  }
  // legal-move count only for the piece about to play in the active Position act
  const k = ACTS[ai].k as PosKey;
  const P = POS[k] as (typeof POS)[PosKey] | undefined;
  const legal = P && lp < 0.64 && p.state === 'board' && p.sq === P.mv[0] ? `${P.dots.length} moves` : null;
  return { eyebrow: `${colour(p.c)} · ${cap(p.type)}`, note, title, status, started: p.startSq, legal, role: p.role, line: info.line };
}

export function createHover(o: HoverOpts): Hover {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return NOOP;
  const { camera, pieces, card, hoverTile, cursor, reducedMotion } = o;
  const q = (s: string) => card.querySelector<HTMLElement>(s)!;
  const el = {
    eyebrow: q('.pc-eyebrow'), note: q('.pc-note'), title: q('.pc-title'), line: q('.pc-line'),
    status: q('[data-row="status"]'), started: q('[data-row="started"]'), legal: q('[data-row="legal"]'), role: q('[data-row="role"]'),
  };
  const dd = (row: HTMLElement) => row.querySelector('dd')!;
  const tileMat = hoverTile.material as THREE.MeshBasicMaterial;

  let x = -1;
  let y = -1;
  let inside = false;
  let moved = false;
  let blocked = false;
  let shown = false;
  let lastKey = '';
  let cw = 260;
  let ch = 120;
  let tile = 0;

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    x = e.clientX;
    y = e.clientY;
    inside = true;
    moved = true;
  };
  const onLeave = () => { inside = false; };
  addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  addEventListener('blur', onLeave);

  function hide() {
    if (!shown) return;
    shown = false;
    card.classList.remove('show');
    cursor.classList.remove('hidden-by-card');
    lastKey = '';
  }

  return {
    update({ active, ai, lp, dt }) {
      // the DOM gate runs only when the pointer moved (one elementFromPoint, not one per frame)
      if (moved) {
        moved = false;
        blocked = !!document.elementFromPoint(x, y)?.closest(BLOCK);
      }
      const id = active && inside && !blocked ? pickPiece(camera, pieces, x, y) : -1;
      let target = 0;
      let tx = 0;
      let tz = 0;

      if (id < 0) hide();
      else {
        const p = pieces[id];
        const d = describePiece(p, ai, lp);
        const key = [id, p.state, p.sq, p.moveFrom, p.moveTo, p.moveLabel, p.clearedFor, d.legal].join('|');
        if (key !== lastKey) {
          lastKey = key;
          el.eyebrow.textContent = d.eyebrow;
          el.note.textContent = d.note;
          el.title.textContent = d.title;
          dd(el.status).textContent = d.status;
          dd(el.started).textContent = d.started;
          el.legal.hidden = d.legal === null;
          if (d.legal !== null) dd(el.legal).textContent = d.legal;
          el.role.hidden = d.role === null;
          if (d.role !== null) dd(el.role).textContent = d.role;
          el.line.textContent = d.line;
          // card size is read once per content change, never per frame
          cw = card.offsetWidth;
          ch = card.offsetHeight;
        }
        let left = x + OFFSET;
        let top = y + OFFSET;
        if (left + cw > innerWidth - EDGE) left = x - OFFSET - cw;
        if (top + ch > innerHeight - EDGE) top = y - OFFSET - ch;
        card.style.transform = `translate3d(${Math.max(EDGE, left)}px,${Math.max(EDGE, top)}px,0)`;
        if (!shown) {
          shown = true;
          card.classList.add('show');
          cursor.classList.add('hidden-by-card');
        }
        if (p.state === 'board' && p.sq) {
          target = TILE_OPACITY;
          [tx, tz] = sq2xz(p.sq);
          hoverTile.position.set(tx, 0.004, tz);
        }
      }

      // the highlight eases toward its target; reduced motion sets it directly
      tile = reducedMotion ? target : tile + (target - tile) * (1 - Math.exp(-dt * 14));
      if (Math.abs(tile - target) < 0.002) tile = target;
      tileMat.opacity = tile;
      hoverTile.visible = tile > 0.001;
      return id + 1 + tile * 1000 + (hoverTile.visible ? hoverTile.position.x * 7 + hoverTile.position.z * 13 : 0);
    },
    destroy() {
      removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      removeEventListener('blur', onLeave);
      hide();
      tileMat.opacity = 0;
      hoverTile.visible = false;
    },
  };
}
