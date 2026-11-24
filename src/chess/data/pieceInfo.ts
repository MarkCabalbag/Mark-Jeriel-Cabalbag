import type { PieceType } from '../three/geometry';

/** Copy for the hover card (spec 11-piece-hover.md section 2.2). `letter` is the SAN piece letter ('' for pawns). */
export const PIECE_INFO: Record<PieceType, { name: string; letter: string; line: string }> = {
  pawn: { name: 'Pawn', letter: '', line: 'Moves one square forward and captures diagonally.' },
  knight: { name: 'Knight', letter: 'N', line: 'Moves in an L shape and is the only piece that jumps.' },
  bishop: { name: 'Bishop', letter: 'B', line: 'Moves any distance along a diagonal.' },
  rook: { name: 'Rook', letter: 'R', line: 'Moves any distance along a rank or a file.' },
  queen: { name: 'Queen', letter: 'Q', line: 'Moves any distance in a straight line or diagonal.' },
  king: { name: 'King', letter: 'K', line: 'Moves one square in any direction. Lose it and the game ends.' },
};
