// Complete deterministic Orbital Reversi (Othello) 8x8 engine
// Supports 8-directional outflanking, automatic pass handling when one side has 0 moves,
// algebraic square notation (a1..h8), and positional corner/mobility Alpha-Beta AI.

export type ReversiColor = 'b' | 'w'; // 'b' = Carbon Black (moves first), 'w' = Titanium White
export type ReversiDifficulty = 'novice' | 'club' | 'master';
export type ReversiBoard = (ReversiColor | null)[][];

export interface ReversiLegalMove {
  r: number;
  c: number;
  square: string;
  flips: [number, number][];
}

export interface ReversiMoveRecord {
  ply: number;
  color: ReversiColor;
  square: string;
  flippedCount: number;
  blackScore: number;
  whiteScore: number;
}

export interface ReversiGameState {
  id: string;
  board: ReversiBoard;
  turn: ReversiColor;
  moves: ReversiMoveRecord[];
  lastPlaced: [number, number] | null;
  lastFlipped: [number, number][];
  passedColor: ReversiColor | null;
  isGameOver: boolean;
  winner: ReversiColor | 'draw' | null;
  reason: string | null;
}

const DIRECTIONS: [number, number][] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

const POSITIONAL_WEIGHTS: number[][] = [
  [120, -24, 20, 8, 8, 20, -24, 120],
  [-24, -44, -6, -4, -4, -6, -44, -24],
  [20, -6, 14, 4, 4, 14, -6, 20],
  [8, -4, 4, 2, 2, 4, -4, 8],
  [8, -4, 4, 2, 2, 4, -4, 8],
  [20, -6, 14, 4, 4, 14, -6, 20],
  [-24, -44, -6, -4, -4, -6, -44, -24],
  [120, -24, 20, 8, 8, 20, -24, 120],
];

export function coordToReversiSquare(r: number, c: number): string {
  const file = String.fromCharCode(97 + c);
  const rank = 8 - r;
  return `${file}${rank}`;
}

export function cloneReversiBoard(board: ReversiBoard): ReversiBoard {
  return board.map((row) => [...row]);
}

export function createInitialReversiBoard(): ReversiBoard {
  const board: ReversiBoard = Array.from({ length: 8 }, () => Array(8).fill(null));
  board[3][3] = 'w';
  board[3][4] = 'b';
  board[4][3] = 'b';
  board[4][4] = 'w';
  return board;
}

export function createInitialReversiState(): ReversiGameState {
  return {
    id: `game_rev_${Date.now().toString(36)}`,
    board: createInitialReversiBoard(),
    turn: 'b', // Standard Othello/Reversi: Black moves first
    moves: [],
    lastPlaced: null,
    lastFlipped: [],
    passedColor: null,
    isGameOver: false,
    winner: null,
    reason: null,
  };
}

export function getFlipsForCell(
  board: ReversiBoard,
  r: number,
  c: number,
  color: ReversiColor
): [number, number][] {
  if (r < 0 || r >= 8 || c < 0 || c >= 8 || board[r][c] !== null) return [];
  const opp: ReversiColor = color === 'b' ? 'w' : 'b';
  const totalFlips: [number, number][] = [];

  for (const [dr, dc] of DIRECTIONS) {
    const line: [number, number][] = [];
    let nr = r + dr;
    let nc = c + dc;
    while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === opp) {
      line.push([nr, nc]);
      nr += dr;
      nc += dc;
    }
    if (line.length > 0 && nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === color) {
      totalFlips.push(...line);
    }
  }

  return totalFlips;
}

export function getLegalReversiMoves(board: ReversiBoard, color: ReversiColor): ReversiLegalMove[] {
  const moves: ReversiLegalMove[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const flips = getFlipsForCell(board, r, c, color);
      if (flips.length > 0) {
        moves.push({
          r,
          c,
          square: coordToReversiSquare(r, c),
          flips,
        });
      }
    }
  }
  return moves;
}

export function countReversiDiscs(board: ReversiBoard): {
  black: number;
  white: number;
  empty: number;
} {
  let black = 0;
  let white = 0;
  let empty = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (cell === 'b') black++;
      else if (cell === 'w') white++;
      else empty++;
    }
  }
  return { black, white, empty };
}

export function serializeReversiBoard(board: ReversiBoard, turn: ReversiColor): string {
  const rows = board.map((row) => row.map((c) => (c ? c : '.')).join('')).join('/');
  return `${rows} ${turn}`;
}

export function applyReversiMove(
  state: ReversiGameState,
  r: number,
  c: number
): ReversiGameState {
  if (state.isGameOver) return state;
  const flips = getFlipsForCell(state.board, r, c, state.turn);
  if (flips.length === 0) return state;

  const nextBoard = cloneReversiBoard(state.board);
  nextBoard[r][c] = state.turn;
  for (const [fr, fc] of flips) {
    nextBoard[fr][fc] = state.turn;
  }

  const counts = countReversiDiscs(nextBoard);
  const sq = coordToReversiSquare(r, c);
  const record: ReversiMoveRecord = {
    ply: state.moves.length + 1,
    color: state.turn,
    square: sq,
    flippedCount: flips.length,
    blackScore: counts.black,
    whiteScore: counts.white,
  };

  const opp: ReversiColor = state.turn === 'b' ? 'w' : 'b';
  const oppMoves = getLegalReversiMoves(nextBoard, opp);
  const ownMovesIfPass = oppMoves.length === 0 ? getLegalReversiMoves(nextBoard, state.turn) : [];

  let nextTurn: ReversiColor = opp;
  let passedColor: ReversiColor | null = null;
  let isGameOver = false;
  let winner: ReversiColor | 'draw' | null = null;
  let reason: string | null = null;

  if (oppMoves.length > 0) {
    nextTurn = opp;
  } else if (ownMovesIfPass.length > 0) {
    nextTurn = state.turn;
    passedColor = opp;
  } else {
    isGameOver = true;
    if (counts.black > counts.white) {
      winner = 'b';
      reason = `Carbon wins ${counts.black}–${counts.white}`;
    } else if (counts.white > counts.black) {
      winner = 'w';
      reason = `Titanium wins ${counts.white}–${counts.black}`;
    } else {
      winner = 'draw';
      reason = `Tied grid ${counts.black}–${counts.white}`;
    }
  }

  return {
    ...state,
    board: nextBoard,
    turn: nextTurn,
    moves: [...state.moves, record],
    lastPlaced: [r, c],
    lastFlipped: flips,
    passedColor,
    isGameOver,
    winner,
    reason,
  };
}

function evaluateReversiPosition(board: ReversiBoard, aiColor: ReversiColor): number {
  const opp: ReversiColor = aiColor === 'b' ? 'w' : 'b';
  const counts = countReversiDiscs(board);

  // Late endgame prioritizes raw disc count
  if (counts.empty === 0) {
    const diff = aiColor === 'b' ? counts.black - counts.white : counts.white - counts.black;
    return diff * 500;
  }

  let positional = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (!cell) continue;
      const w = POSITIONAL_WEIGHTS[r][c];
      positional += cell === aiColor ? w : -w;
    }
  }

  const aiMobility = getLegalReversiMoves(board, aiColor).length;
  const oppMobility = getLegalReversiMoves(board, opp).length;
  const discDiff = aiColor === 'b' ? counts.black - counts.white : counts.white - counts.black;
  const endgameFactor = counts.empty <= 12 ? 8 : 1;

  return positional + (aiMobility - oppMobility) * 10 + discDiff * endgameFactor;
}

function minimaxReversi(
  board: ReversiBoard,
  turn: ReversiColor,
  aiColor: ReversiColor,
  depth: number,
  alpha: number,
  beta: number
): number {
  if (depth <= 0) {
    return evaluateReversiPosition(board, aiColor);
  }

  const legal = getLegalReversiMoves(board, turn);
  const opp: ReversiColor = turn === 'b' ? 'w' : 'b';

  if (legal.length === 0) {
    const oppLegal = getLegalReversiMoves(board, opp);
    if (oppLegal.length === 0) {
      return evaluateReversiPosition(board, aiColor);
    }
    return minimaxReversi(board, opp, aiColor, depth - 1, alpha, beta);
  }

  const maximizing = turn === aiColor;
  if (maximizing) {
    let best = -Infinity;
    for (const mv of legal) {
      const child = cloneReversiBoard(board);
      child[mv.r][mv.c] = turn;
      for (const [fr, fc] of mv.flips) child[fr][fc] = turn;
      const val = minimaxReversi(child, opp, aiColor, depth - 1, alpha, beta);
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const mv of legal) {
      const child = cloneReversiBoard(board);
      child[mv.r][mv.c] = turn;
      for (const [fr, fc] of mv.flips) child[fr][fc] = turn;
      const val = minimaxReversi(child, opp, aiColor, depth - 1, alpha, beta);
      if (val < best) best = val;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
    return best;
  }
}

export function chooseReversiAIMove(
  state: ReversiGameState,
  difficulty: ReversiDifficulty
): ReversiLegalMove | null {
  if (state.isGameOver) return null;
  const legal = getLegalReversiMoves(state.board, state.turn);
  if (legal.length === 0) return null;
  if (legal.length === 1) return legal[0];

  const depth = difficulty === 'novice' ? 1 : difficulty === 'club' ? 3 : 5;
  const aiColor = state.turn;
  const opp: ReversiColor = aiColor === 'b' ? 'w' : 'b';

  const scored = legal.map((mv) => {
    const child = cloneReversiBoard(state.board);
    child[mv.r][mv.c] = aiColor;
    for (const [fr, fc] of mv.flips) child[fr][fc] = aiColor;
    const jitter = difficulty === 'novice' ? (Math.random() - 0.5) * 45 : (Math.random() - 0.5) * 4;
    const score = minimaxReversi(child, opp, aiColor, depth - 1, -Infinity, Infinity) + jitter;
    return { mv, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].mv;
}
