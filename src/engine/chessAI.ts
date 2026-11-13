import { Chess, type Color, type Move, type PieceSymbol } from 'chess.js';
import type { AIDifficulty } from './storage';

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece-square tables from White's perspective (rank 8 at index 0 .. rank 1 at index 7)
const PAWN_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5, 5, 10, 27, 27, 10, 5, 5],
  [0, 0, 0, 24, 24, 0, 0, 0],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [5, 10, 10, -22, -22, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

const KNIGHT_PST = [
  [-50, -40, -30, -30, -30, -30, -40, -50],
  [-40, -20, 0, 0, 0, 0, -20, -40],
  [-30, 0, 10, 15, 15, 10, 0, -30],
  [-30, 5, 15, 20, 20, 15, 5, -30],
  [-30, 0, 15, 20, 20, 15, 0, -30],
  [-30, 5, 10, 15, 15, 10, 5, -30],
  [-40, -20, 0, 5, 5, 0, -20, -40],
  [-50, -40, -30, -30, -30, -30, -40, -50],
];

const BISHOP_PST = [
  [-20, -10, -10, -10, -10, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 5, 10, 10, 5, 0, -10],
  [-10, 5, 5, 10, 10, 5, 5, -10],
  [-10, 0, 10, 10, 10, 10, 0, -10],
  [-10, 10, 10, 10, 10, 10, 10, -10],
  [-10, 5, 0, 0, 0, 0, 5, -10],
  [-20, -10, -10, -10, -10, -10, -10, -20],
];

const ROOK_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [5, 10, 10, 10, 10, 10, 10, 5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [0, 0, 0, 5, 5, 0, 0, 0],
];

const QUEEN_PST = [
  [-20, -10, -10, -5, -5, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 5, 5, 5, 5, 0, -10],
  [-5, 0, 5, 5, 5, 5, 0, -5],
  [0, 0, 5, 5, 5, 5, 0, -5],
  [-10, 5, 5, 5, 5, 5, 0, -10],
  [-10, 0, 5, 0, 0, 0, 0, -10],
  [-20, -10, -10, -5, -5, -10, -10, -20],
];

const KING_MID_PST = [
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-20, -30, -30, -40, -40, -30, -30, -20],
  [-10, -20, -20, -20, -20, -20, -20, -10],
  [20, 20, 0, 0, 0, 0, 20, 20],
  [20, 30, 10, 0, 0, 10, 30, 20],
];

function getPstBonus(type: PieceSymbol, color: Color, r: number, c: number): number {
  const rowIdx = color === 'w' ? r : 7 - r;
  switch (type) {
    case 'p':
      return PAWN_PST[rowIdx][c];
    case 'n':
      return KNIGHT_PST[rowIdx][c];
    case 'b':
      return BISHOP_PST[rowIdx][c];
    case 'r':
      return ROOK_PST[rowIdx][c];
    case 'q':
      return QUEEN_PST[rowIdx][c];
    case 'k':
      return KING_MID_PST[rowIdx][c];
    default:
      return 0;
  }
}

function evaluateBoard(chess: Chess, perspective: Color): number {
  if (chess.isCheckmate()) {
    return chess.turn() === perspective ? -99999 : 99999;
  }
  if (chess.isStalemate() || chess.isDraw()) {
    return 0;
  }

  let score = 0;
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (!sq) continue;
      const val = PIECE_VALUES[sq.type] + getPstBonus(sq.type, sq.color, r, c);
      score += sq.color === perspective ? val : -val;
    }
  }
  if (chess.inCheck()) {
    score += chess.turn() === perspective ? -32 : 32;
  }
  return score;
}

function scoreMoveOrdering(m: Move): number {
  let s = 0;
  if (m.captured) {
    s += PIECE_VALUES[m.captured] * 10 - PIECE_VALUES[m.piece];
  }
  if (m.promotion) {
    s += PIECE_VALUES[m.promotion];
  }
  if (m.san.includes('+')) s += 45;
  if (m.flags.includes('k') || m.flags.includes('q')) s += 35;
  return s;
}

function orderMoves(moves: Move[]): Move[] {
  return [...moves].sort((a, b) => scoreMoveOrdering(b) - scoreMoveOrdering(a));
}

function quiescence(
  chess: Chess,
  alpha: number,
  beta: number,
  perspective: Color,
  qDepth: number,
  nodeCounter: { count: number; maxNodes: number }
): number {
  nodeCounter.count++;
  const standPat = evaluateBoard(chess, perspective);
  if (qDepth <= 0 || nodeCounter.count >= nodeCounter.maxNodes) return standPat;

  const isMax = chess.turn() === perspective;
  if (isMax) {
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;
  } else {
    if (standPat <= alpha) return alpha;
    if (standPat < beta) beta = standPat;
  }

  const captures = orderMoves(
    chess.moves({ verbose: true }).filter((m) => Boolean(m.captured) || Boolean(m.promotion))
  );

  for (const mv of captures) {
    chess.move(mv);
    const val = quiescence(chess, alpha, beta, perspective, qDepth - 1, nodeCounter);
    chess.undo();
    if (isMax) {
      if (val >= beta) return beta;
      if (val > alpha) alpha = val;
    } else {
      if (val <= alpha) return alpha;
      if (val < beta) beta = val;
    }
  }
  return isMax ? alpha : beta;
}

function minimax(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  perspective: Color,
  enableQuiescence: boolean,
  nodeCounter: { count: number; maxNodes: number },
  shouldAbort?: () => boolean
): number {
  nodeCounter.count++;
  if (shouldAbort && shouldAbort()) {
    return evaluateBoard(chess, perspective);
  }
  if (chess.isGameOver()) {
    const val = evaluateBoard(chess, perspective);
    // Prefer faster checkmates
    return val > 50000 ? val + depth * 10 : val < -50000 ? val - depth * 10 : val;
  }
  if (depth <= 0 || nodeCounter.count >= nodeCounter.maxNodes) {
    return enableQuiescence
      ? quiescence(chess, alpha, beta, perspective, 2, nodeCounter)
      : evaluateBoard(chess, perspective);
  }

  const moves = orderMoves(chess.moves({ verbose: true }));
  const isMax = chess.turn() === perspective;

  if (isMax) {
    let best = -Infinity;
    for (const mv of moves) {
      chess.move(mv);
      const val = minimax(
        chess,
        depth - 1,
        alpha,
        beta,
        perspective,
        enableQuiescence,
        nodeCounter,
        shouldAbort
      );
      chess.undo();
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const mv of moves) {
      chess.move(mv);
      const val = minimax(
        chess,
        depth - 1,
        alpha,
        beta,
        perspective,
        enableQuiescence,
        nodeCounter,
        shouldAbort
      );
      chess.undo();
      if (val < best) best = val;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
    return best;
  }
}

export interface AIChoice {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
  san: string;
  score: number;
}

export function chooseBestAIMove(
  fen: string,
  difficulty: AIDifficulty = 'club',
  shouldAbort?: () => boolean
): AIChoice | null {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return null;
  }
  if (chess.isGameOver()) return null;

  const legalMoves = orderMoves(chess.moves({ verbose: true }));
  if (legalMoves.length === 0) return null;

  const perspective = chess.turn();
  const depth = difficulty === 'novice' ? 1 : difficulty === 'club' ? 2 : 3;
  const enableQuiescence = difficulty !== 'novice';
  const nodeCounter = {
    count: 0,
    maxNodes: difficulty === 'master' ? 7500 : difficulty === 'club' ? 3500 : 1200,
  };

  let bestScore = -Infinity;
  let scoredMoves: { mv: Move; score: number }[] = [];

  for (const mv of legalMoves) {
    if (shouldAbort && shouldAbort()) return null;
    chess.move(mv);
    const val = minimax(
      chess,
      depth - 1,
      -Infinity,
      Infinity,
      perspective,
      enableQuiescence,
      nodeCounter,
      shouldAbort
    );
    chess.undo();

    // Small deterministic-friendly jitter for Novice variety
    const jitter = difficulty === 'novice' ? (Math.random() - 0.5) * 45 : difficulty === 'club' ? (Math.random() - 0.5) * 8 : 0;
    const total = val + jitter;
    scoredMoves.push({ mv, score: total });
    if (total > bestScore) bestScore = total;
  }

  if (shouldAbort && shouldAbort()) return null;

  const tolerance = difficulty === 'novice' ? 35 : difficulty === 'club' ? 6 : 1;
  const topPool = scoredMoves.filter((s) => s.score >= bestScore - tolerance);
  const picked = topPool[Math.floor(Math.random() * topPool.length)] || scoredMoves[0];

  return {
    from: picked.mv.from,
    to: picked.mv.to,
    promotion: (picked.mv.promotion as 'q' | 'r' | 'b' | 'n' | undefined) || undefined,
    san: picked.mv.san,
    score: Math.round(picked.score),
  };
}
