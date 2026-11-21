// Complete deterministic American Checkers / Crown Draughts engine
// Supports mandatory captures, recursive multi-jump chains, King crowning,
// 80-ply draw detection, WCDF 1-32 square notation, and Alpha-Beta AI.

export type DraughtsColor = 'w' | 'b'; // 'w' = Brass/Gold (moves up, rows 7->0), 'b' = Basalt/Carbon (moves down, rows 0->7)
export type DraughtsDifficulty = 'novice' | 'club' | 'master';

export interface DraughtsPiece {
  color: DraughtsColor;
  isKing: boolean;
}

export type DraughtsBoard = (DraughtsPiece | null)[][];

export interface DraughtsCoord {
  r: number;
  c: number;
}

export interface DraughtsMove {
  from: DraughtsCoord;
  to: DraughtsCoord;
  path: DraughtsCoord[]; // Ordered landing squares (length >= 1)
  captures: DraughtsCoord[]; // Captured opponent squares in jump order
  crowns: boolean;
  notation: string;
}

export interface DraughtsMoveRecord {
  ply: number;
  moveNumber: number;
  color: DraughtsColor;
  fromSq: number;
  toSq: number;
  notation: string;
  capturedCount: number;
  crowned: boolean;
  boardSnapshot: string;
}

export interface DraughtsGameState {
  id: string;
  board: DraughtsBoard;
  turn: DraughtsColor;
  moves: DraughtsMoveRecord[];
  noProgressPlies: number;
  isGameOver: boolean;
  winner: DraughtsColor | 'draw' | null;
  reason: string | null;
  lastMove: DraughtsMove | null;
}

export function isPlayableDarkSquare(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8 && (r + c) % 2 === 1;
}

// Official WCDF 1..32 numbering (row 0 -> 1..4, row 7 -> 29..32)
export function coordToWcdf(r: number, c: number): number {
  if (!isPlayableDarkSquare(r, c)) return 0;
  return r * 4 + Math.floor(c / 2) + 1;
}

export function wcdfToCoord(sq: number): DraughtsCoord | null {
  if (sq < 1 || sq > 32) return null;
  const idx = sq - 1;
  const r = Math.floor(idx / 4);
  const offset = idx % 4;
  const c = r % 2 === 0 ? offset * 2 + 1 : offset * 2;
  return { r, c };
}

export function cloneDraughtsBoard(board: DraughtsBoard): DraughtsBoard {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

export function serializeDraughtsBoard(board: DraughtsBoard, turn: DraughtsColor): string {
  const cells: string[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (!isPlayableDarkSquare(r, c)) continue;
      const p = board[r][c];
      if (!p) cells.push('.');
      else if (p.color === 'w') cells.push(p.isKing ? 'W' : 'w');
      else cells.push(p.isKing ? 'B' : 'b');
    }
  }
  return `${turn}:${cells.join('')}`;
}

export function createInitialDraughtsBoard(): DraughtsBoard {
  const board: DraughtsBoard = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 8; c++) {
      if (isPlayableDarkSquare(r, c)) {
        board[r][c] = { color: 'b', isKing: false };
      }
    }
  }
  for (let r = 5; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (isPlayableDarkSquare(r, c)) {
        board[r][c] = { color: 'w', isKing: false };
      }
    }
  }
  return board;
}

export function createInitialDraughtsState(): DraughtsGameState {
  return {
    id: `game_chk_${Date.now().toString(36)}`,
    board: createInitialDraughtsBoard(),
    turn: 'w', // Brass/Gold moves first from bottom ranks (rows 5..7)
    moves: [],
    noProgressPlies: 0,
    isGameOver: false,
    winner: null,
    reason: null,
    lastMove: null,
  };
}

function getMoveDirections(piece: DraughtsPiece): [number, number][] {
  if (piece.isKing) {
    return [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];
  }
  return piece.color === 'w'
    ? [
        [-1, -1],
        [-1, 1],
      ]
    : [
        [1, -1],
        [1, 1],
      ];
}

function reachesCrownRank(color: DraughtsColor, r: number): boolean {
  return (color === 'w' && r === 0) || (color === 'b' && r === 7);
}

function buildMoveNotation(from: DraughtsCoord, path: DraughtsCoord[], isCapture: boolean): string {
  const sep = isCapture ? 'x' : '-';
  const nums = [coordToWcdf(from.r, from.c), ...path.map((p) => coordToWcdf(p.r, p.c))];
  return nums.join(sep);
}

function getJumpSequencesFrom(
  board: DraughtsBoard,
  origin: DraughtsCoord,
  current: DraughtsCoord,
  piece: DraughtsPiece,
  capturedSoFar: DraughtsCoord[],
  pathSoFar: DraughtsCoord[]
): DraughtsMove[] {
  const dirs = getMoveDirections(piece);
  const sequences: DraughtsMove[] = [];

  for (const [dr, dc] of dirs) {
    const midR = current.r + dr;
    const midC = current.c + dc;
    const landR = current.r + dr * 2;
    const landC = current.c + dc * 2;

    if (landR < 0 || landR >= 8 || landC < 0 || landC >= 8) continue;

    const midPiece = board[midR][midC];
    if (!midPiece || midPiece.color === piece.color) continue;
    if (capturedSoFar.some((cap) => cap.r === midR && cap.c === midC)) continue;

    // Landing square must be empty (or the original starting square in a 4-corner loop)
    const landOccupant = board[landR][landC];
    const isOriginSquare = landR === origin.r && landC === origin.c;
    if (landOccupant && !isOriginSquare) continue;

    const nextCaptures = [...capturedSoFar, { r: midR, c: midC }];
    const nextPath = [...pathSoFar, { r: landR, c: landC }];
    const crownsNow = !piece.isKing && reachesCrownRank(piece.color, landR);

    // Per American Checkers rules, crowning a man ends its jump sequence immediately
    if (crownsNow) {
      sequences.push({
        from: origin,
        to: { r: landR, c: landC },
        path: nextPath,
        captures: nextCaptures,
        crowns: true,
        notation: buildMoveNotation(origin, nextPath, true),
      });
      continue;
    }

    const continuations = getJumpSequencesFrom(
      board,
      origin,
      { r: landR, c: landC },
      piece,
      nextCaptures,
      nextPath
    );

    if (continuations.length > 0) {
      sequences.push(...continuations);
    } else {
      sequences.push({
        from: origin,
        to: { r: landR, c: landC },
        path: nextPath,
        captures: nextCaptures,
        crowns: false,
        notation: buildMoveNotation(origin, nextPath, true),
      });
    }
  }

  return sequences;
}

export function getLegalDraughtsMoves(board: DraughtsBoard, turn: DraughtsColor): DraughtsMove[] {
  const captures: DraughtsMove[] = [];
  const slides: DraughtsMove[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== turn) continue;

      const jumps = getJumpSequencesFrom(board, { r, c }, { r, c }, piece, [], []);
      if (jumps.length > 0) {
        captures.push(...jumps);
        continue;
      }

      if (captures.length === 0) {
        for (const [dr, dc] of getMoveDirections(piece)) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
          if (board[nr][nc] !== null) continue;
          const crowns = !piece.isKing && reachesCrownRank(piece.color, nr);
          slides.push({
            from: { r, c },
            to: { r: nr, c: nc },
            path: [{ r: nr, c: nc }],
            captures: [],
            crowns,
            notation: buildMoveNotation({ r, c }, [{ r: nr, c: nc }], false),
          });
        }
      }
    }
  }

  // Mandatory capture rule
  return captures.length > 0 ? captures : slides;
}

export function countDraughtsMaterial(board: DraughtsBoard): {
  whiteMen: number;
  whiteKings: number;
  blackMen: number;
  blackKings: number;
  whiteTotal: number;
  blackTotal: number;
} {
  let whiteMen = 0;
  let whiteKings = 0;
  let blackMen = 0;
  let blackKings = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      if (p.color === 'w') {
        if (p.isKing) whiteKings++;
        else whiteMen++;
      } else {
        if (p.isKing) blackKings++;
        else blackMen++;
      }
    }
  }

  return {
    whiteMen,
    whiteKings,
    blackMen,
    blackKings,
    whiteTotal: whiteMen + whiteKings,
    blackTotal: blackMen + blackKings,
  };
}

export function applyDraughtsMove(state: DraughtsGameState, move: DraughtsMove): DraughtsGameState {
  const nextBoard = cloneDraughtsBoard(state.board);
  const moving = nextBoard[move.from.r][move.from.c];
  if (!moving) return state;

  nextBoard[move.from.r][move.from.c] = null;
  for (const cap of move.captures) {
    nextBoard[cap.r][cap.c] = null;
  }
  nextBoard[move.to.r][move.to.c] = {
    color: moving.color,
    isKing: moving.isKing || move.crowns,
  };

  const nextTurn: DraughtsColor = state.turn === 'w' ? 'b' : 'w';
  const nextPly = state.moves.length + 1;
  const noProgress = move.captures.length > 0 || move.crowns ? 0 : state.noProgressPlies + 1;

  const moveRecord: DraughtsMoveRecord = {
    ply: nextPly,
    moveNumber: Math.ceil(nextPly / 2),
    color: state.turn,
    fromSq: coordToWcdf(move.from.r, move.from.c),
    toSq: coordToWcdf(move.to.r, move.to.c),
    notation: move.notation,
    capturedCount: move.captures.length,
    crowned: move.crowns,
    boardSnapshot: serializeDraughtsBoard(nextBoard, nextTurn),
  };

  const nextLegalMoves = getLegalDraughtsMoves(nextBoard, nextTurn);
  const counts = countDraughtsMaterial(nextBoard);

  let isGameOver = false;
  let winner: DraughtsColor | 'draw' | null = null;
  let reason: string | null = null;

  if (counts.whiteTotal === 0 || (nextTurn === 'w' && nextLegalMoves.length === 0)) {
    isGameOver = true;
    winner = 'b';
    reason = counts.whiteTotal === 0 ? 'All Brass pieces captured' : 'No legal moves remaining';
  } else if (counts.blackTotal === 0 || (nextTurn === 'b' && nextLegalMoves.length === 0)) {
    isGameOver = true;
    winner = 'w';
    reason = counts.blackTotal === 0 ? 'All Basalt pieces captured' : 'No legal moves remaining';
  } else if (noProgress >= 80) {
    isGameOver = true;
    winner = 'draw';
    reason = '40-move non-capture rule';
  }

  return {
    ...state,
    board: nextBoard,
    turn: nextTurn,
    moves: [...state.moves, moveRecord],
    noProgressPlies: noProgress,
    isGameOver,
    winner,
    reason,
    lastMove: move,
  };
}

function evaluateDraughtsBoard(board: DraughtsBoard, perspective: DraughtsColor): number {
  let score = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;

      let val = p.isKing ? 172 : 100;
      if (!p.isKing) {
        // Advancement toward promotion rank
        val += p.color === 'w' ? (7 - r) * 4 : r * 4;
        // Home back-row defense bonus
        if ((p.color === 'w' && r === 7) || (p.color === 'b' && r === 0)) {
          val += 9;
        }
      }
      // Central control bonus
      if (r >= 2 && r <= 5 && c >= 2 && c <= 5) {
        val += 8;
      }

      score += p.color === perspective ? val : -val;
    }
  }

  return score;
}

function minimaxDraughts(
  board: DraughtsBoard,
  turn: DraughtsColor,
  aiColor: DraughtsColor,
  depth: number,
  alpha: number,
  beta: number
): number {
  const legal = getLegalDraughtsMoves(board, turn);
  if (legal.length === 0) {
    return turn === aiColor ? -10000 - depth : 10000 + depth;
  }
  if (depth <= 0) {
    const mobility = turn === aiColor ? legal.length * 2 : -legal.length * 2;
    return evaluateDraughtsBoard(board, aiColor) + mobility;
  }

  const maximizing = turn === aiColor;
  const nextTurn: DraughtsColor = turn === 'w' ? 'b' : 'w';

  if (maximizing) {
    let best = -Infinity;
    for (const mv of legal) {
      const child = cloneDraughtsBoard(board);
      const moving = child[mv.from.r][mv.from.c]!;
      child[mv.from.r][mv.from.c] = null;
      for (const cap of mv.captures) child[cap.r][cap.c] = null;
      child[mv.to.r][mv.to.c] = { color: moving.color, isKing: moving.isKing || mv.crowns };

      const val = minimaxDraughts(child, nextTurn, aiColor, depth - 1, alpha, beta);
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const mv of legal) {
      const child = cloneDraughtsBoard(board);
      const moving = child[mv.from.r][mv.from.c]!;
      child[mv.from.r][mv.from.c] = null;
      for (const cap of mv.captures) child[cap.r][cap.c] = null;
      child[mv.to.r][mv.to.c] = { color: moving.color, isKing: moving.isKing || mv.crowns };

      const val = minimaxDraughts(child, nextTurn, aiColor, depth - 1, alpha, beta);
      if (val < best) best = val;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
    return best;
  }
}

export function chooseDraughtsAIMove(
  state: DraughtsGameState,
  difficulty: DraughtsDifficulty
): DraughtsMove | null {
  if (state.isGameOver) return null;
  const legal = getLegalDraughtsMoves(state.board, state.turn);
  if (legal.length === 0) return null;
  if (legal.length === 1) return legal[0];

  const depth = difficulty === 'novice' ? 2 : difficulty === 'club' ? 4 : 6;
  const aiColor = state.turn;
  const nextTurn: DraughtsColor = aiColor === 'w' ? 'b' : 'w';

  const scored = legal.map((mv) => {
    const child = cloneDraughtsBoard(state.board);
    const moving = child[mv.from.r][mv.from.c]!;
    child[mv.from.r][mv.from.c] = null;
    for (const cap of mv.captures) child[cap.r][cap.c] = null;
    child[mv.to.r][mv.to.c] = { color: moving.color, isKing: moving.isKing || mv.crowns };

    const jitter = difficulty === 'novice' ? (Math.random() - 0.5) * 26 : (Math.random() - 0.5) * 3;
    const score = minimaxDraughts(child, nextTurn, aiColor, depth - 1, -Infinity, Infinity) + jitter;
    return { mv, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].mv;
}
