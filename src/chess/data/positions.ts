import raw from './positions.json';
import type { EvalValue } from './acts';

export type PosKey = 'knight' | 'bishop' | 'rook' | 'queen';
export interface Position {
  fen: string;
  mv: [string, string];
  san: string;
  pv: string;
  ev: [EvalValue, EvalValue];
  dots: string[];
  reply?: [string, string];
}

/** Single source of truth for the chess data. `reference/verify_positions.py src/chess/data/positions.json` verifies it. */
export const POS: Record<PosKey, Position> = {
  knight: raw.knight as Position,
  bishop: raw.bishop as Position,
  rook: raw.rook as Position,
  queen: raw.queen as Position,
};
export const OPENING_MOVES = raw.opening.moves as [string, string][];
export const FINALE_FEN = raw.finale.fen;
export const POS_KEYS: PosKey[] = ['knight', 'bishop', 'rook', 'queen'];
