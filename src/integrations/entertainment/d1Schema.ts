import type { WizardChessUISnapshot } from '../../engine/fallbackEngine';
import type {
  ArenaId,
  CompletedGameRecord,
  RecordedMove,
  SavedGameState,
} from '../../engine/storage';

export type D1GameStatus = 'waiting' | 'active' | 'paused' | 'completed' | 'abandoned';
export type D1RoomStatus = 'open' | 'in_game' | 'closed';
export type D1RoomVisibility = 'public' | 'private' | 'unlisted';
export type D1ChessColor = 'white' | 'black';
export type D1GameWinner = 'white' | 'black' | 'draw' | null;

export interface GameRoomRow {
  id: string;
  game_type: string;
  status: D1RoomStatus;
  host_player_id: string | null;
  host_display_name: string | null;
  current_game_id: string | null;
  is_private: 0 | 1;
  max_players: number;
  do_stub_id: string | null;
  tenant_id: string | null;
  workspace_id: string;
  join_code: string | null;
  visibility: D1RoomVisibility;
  metadata_json: string;
  created_at: string;
  updated_at: string;
}

export interface GameRow {
  id: string;
  game_type: string;
  status: D1GameStatus;
  room_id: string;
  white_player_id: string | null;
  black_player_id: string | null;
  white_display_name: string | null;
  black_display_name: string | null;
  current_turn: D1ChessColor;
  winner: D1GameWinner;
  result_reason: string | null;
  piece_set_white: string;
  piece_set_black: string;
  board_state: string | null;
  move_count: number;
  tenant_id: string | null;
  workspace_id: string | null;
  do_id: string | null;
  initial_fen: string;
  current_fen: string;
  pgn: string;
  last_move_at: string | null;
  metadata_json: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GameMoveRow {
  id: string;
  game_id: string;
  move_number: number;
  player_id: string;
  color: D1ChessColor;
  from_square: string;
  to_square: string;
  piece: string;
  captured_piece: string | null;
  promotion: string | null;
  is_check: 0 | 1;
  is_checkmate: 0 | 1;
  is_castling: 0 | 1;
  is_en_passant: 0 | 1;
  fen_after: string | null;
  pgn_notation: string | null;
  san: string | null;
  lan: string | null;
  time_ms: number | null;
  metadata_json: string;
  created_at: string;
}

export interface GameCreditsRow {
  id: number;
  user_email: string;
  credits_balance: number;
  total_purchased: number;
  total_spent: number;
  last_purchase_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface D1ChessGameBundle {
  room: GameRoomRow;
  game: GameRow;
  moves: GameMoveRow[];
}

export interface D1BundleContextOptions {
  workspaceId?: string;
  tenantId?: string | null;
  roomId?: string;
  whitePlayerId?: string;
  blackPlayerId?: string;
  whiteDisplayName?: string;
  blackDisplayName?: string;
}

export const INITIAL_CHESS_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const D1_CHESS_SCHEMA_SQL = `PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS game_rooms (
  id TEXT PRIMARY KEY,
  game_type TEXT NOT NULL DEFAULT 'chess',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_game', 'closed')),
  host_player_id TEXT,
  host_display_name TEXT,
  current_game_id TEXT,
  is_private INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0, 1)),
  max_players INTEGER NOT NULL DEFAULT 2 CHECK (max_players >= 1),
  do_stub_id TEXT,
  tenant_id TEXT,
  workspace_id TEXT NOT NULL DEFAULT 'ws_inneranimalmedia',
  join_code TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'unlisted')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY DEFAULT ('game_' || lower(hex(randomblob(8)))),
  game_type TEXT NOT NULL DEFAULT 'chess',
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'paused', 'completed', 'abandoned')),
  room_id TEXT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  white_player_id TEXT,
  black_player_id TEXT,
  white_display_name TEXT,
  black_display_name TEXT,
  current_turn TEXT NOT NULL DEFAULT 'white' CHECK (current_turn IN ('white', 'black')),
  winner TEXT CHECK (winner IS NULL OR winner IN ('white', 'black', 'draw')),
  result_reason TEXT,
  piece_set_white TEXT NOT NULL DEFAULT 'v1',
  piece_set_black TEXT NOT NULL DEFAULT 'v1',
  board_state TEXT,
  move_count INTEGER NOT NULL DEFAULT 0,
  tenant_id TEXT,
  workspace_id TEXT DEFAULT 'ws_inneranimalmedia',
  do_id TEXT,
  initial_fen TEXT NOT NULL DEFAULT '',
  current_fen TEXT NOT NULL DEFAULT '',
  pgn TEXT NOT NULL DEFAULT '',
  last_move_at DATETIME,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  started_at DATETIME,
  ended_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_moves (
  id TEXT PRIMARY KEY DEFAULT ('mv_' || lower(hex(randomblob(8)))),
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  move_number INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  color TEXT NOT NULL CHECK (color IN ('white', 'black')),
  from_square TEXT NOT NULL,
  to_square TEXT NOT NULL,
  piece TEXT NOT NULL,
  captured_piece TEXT,
  promotion TEXT,
  is_check INTEGER NOT NULL DEFAULT 0 CHECK (is_check IN (0, 1)),
  is_checkmate INTEGER NOT NULL DEFAULT 0 CHECK (is_checkmate IN (0, 1)),
  is_castling INTEGER NOT NULL DEFAULT 0 CHECK (is_castling IN (0, 1)),
  is_en_passant INTEGER NOT NULL DEFAULT 0 CHECK (is_en_passant IN (0, 1)),
  fen_after TEXT,
  pgn_notation TEXT,
  san TEXT,
  lan TEXT,
  time_ms INTEGER,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_credits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL UNIQUE,
  credits_balance INTEGER NOT NULL DEFAULT 0,
  total_purchased INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  last_purchase_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);`;

export function mapArenaToPieceSet(arenaId?: ArenaId): string {
  return arenaId === 'robotics' ? 'robotics_eva_v1' : 'cathedral_stone_v1';
}

function resolveWinner(result?: '1-0' | '0-1' | '1/2-1/2' | '*'): D1GameWinner {
  if (result === '1-0') return 'white';
  if (result === '0-1') return 'black';
  if (result === '1/2-1/2') return 'draw';
  return null;
}

function isSnapshotSource(
  source: WizardChessUISnapshot | SavedGameState | CompletedGameRecord
): source is WizardChessUISnapshot {
  return 'clockPaused' in source && 'isGameOver' in source;
}

function isCompletedRecordSource(
  source: WizardChessUISnapshot | SavedGameState | CompletedGameRecord
): source is CompletedGameRecord {
  return 'finalFen' in source;
}

export function mapRecordedMoveToD1Row(
  gameId: string,
  move: RecordedMove,
  whitePlayerId: string,
  blackPlayerId: string,
  createdAtIso: string
): GameMoveRow {
  const color: D1ChessColor = move.color === 'b' ? 'black' : 'white';
  const san = move.san || '';
  const isCheckmate = san.includes('#') ? 1 : 0;
  const isCheck = isCheckmate || san.includes('+') ? 1 : 0;
  const lan = `${move.fromSq}${move.toSq}${move.promotion || ''}`;

  return {
    id: `mv_${gameId}_${move.ply}`,
    game_id: gameId,
    move_number: move.moveNumber,
    player_id: color === 'white' ? whitePlayerId : blackPlayerId,
    color,
    from_square: move.fromSq,
    to_square: move.toSq,
    piece: move.pieceType,
    captured_piece: move.capturedType ?? null,
    promotion: move.promotion ?? null,
    is_check: isCheck,
    is_checkmate: isCheckmate,
    is_castling: move.isCastle ? 1 : 0,
    is_en_passant: move.isEnPassant ? 1 : 0,
    fen_after: move.fenAfter,
    pgn_notation: san,
    san,
    lan,
    time_ms: null,
    metadata_json: JSON.stringify({
      ply: move.ply,
      castleSide: move.isCastle || null,
      fromCoords: [move.fromR, move.fromC],
      toCoords: [move.toR, move.toC],
    }),
    created_at: createdAtIso,
  };
}

export function toD1GameBundle(
  source: WizardChessUISnapshot | SavedGameState | CompletedGameRecord,
  opts: D1BundleContextOptions = {}
): D1ChessGameBundle {
  const nowIso = new Date().toISOString();
  const workspaceId = opts.workspaceId || 'ws_inneranimalmedia';
  const tenantId = opts.tenantId ?? null;
  const rawId = isSnapshotSource(source)
    ? source.gameId || `game_${Date.now()}`
    : source.id || `game_${Date.now()}`;
  const gameId = rawId.startsWith('game_') ? rawId : `game_${rawId}`;
  const roomId = opts.roomId || `room_${gameId}`;

  const arenaId: ArenaId = source.arenaId === 'robotics' ? 'robotics' : 'cathedral';
  const pieceSet = mapArenaToPieceSet(arenaId);
  const playMode = source.playMode;
  const difficulty = source.difficulty;
  const playerColor = source.playerColor;

  const defaultWhiteLabel =
    playMode === 'local'
      ? 'Player 1 (White)'
      : playerColor === 'w'
      ? 'Commander (White)'
      : arenaId === 'robotics'
      ? `6-DOF Arm (${difficulty})`
      : `Grandmaster AI (${difficulty})`;

  const defaultBlackLabel =
    playMode === 'local'
      ? 'Player 2 (Black)'
      : playerColor === 'b'
      ? 'Commander (Black)'
      : arenaId === 'robotics'
      ? `6-DOF Arm (${difficulty})`
      : `Grandmaster AI (${difficulty})`;

  const whitePlayerId =
    opts.whitePlayerId || (playMode === 'ai' && playerColor === 'b' ? `ai_${difficulty}` : 'player_white');
  const blackPlayerId =
    opts.blackPlayerId || (playMode === 'ai' && playerColor === 'w' ? `ai_${difficulty}` : 'player_black');
  const whiteDisplayName = opts.whiteDisplayName || defaultWhiteLabel;
  const blackDisplayName = opts.blackDisplayName || defaultBlackLabel;

  const moves = source.moves || [];
  let currentFen = INITIAL_CHESS_FEN;
  let status: D1GameStatus = 'waiting';
  let currentTurn: D1ChessColor = 'white';
  let winner: D1GameWinner = null;
  let resultReason: string | null = null;
  let updatedAt = nowIso;
  let endedAt: string | null = null;
  let metadataPayload: Record<string, unknown> = {
    arenaId,
    playMode,
    difficulty,
    clockPreset: source.clockPreset,
  };

  if (isSnapshotSource(source)) {
    currentFen = source.fen || INITIAL_CHESS_FEN;
    status = source.isGameOver
      ? 'completed'
      : source.clockPaused
      ? 'paused'
      : moves.length > 0
      ? 'active'
      : 'waiting';
    currentTurn = source.turn === 'b' ? 'black' : 'white';
    winner = resolveWinner(source.result);
    resultReason = source.termination;
    endedAt = source.isGameOver ? nowIso : null;
    metadataPayload = {
      ...metadataPayload,
      clockDirection: source.clockDirection,
      whiteSeconds: Number(source.whiteSeconds.toFixed(1)),
      blackSeconds: Number(source.blackSeconds.toFixed(1)),
      inCheck: source.inCheck,
    };
  } else if (isCompletedRecordSource(source)) {
    currentFen = source.finalFen || INITIAL_CHESS_FEN;
    status = 'completed';
    const fenTurn = currentFen.split(' ')[1];
    currentTurn = fenTurn === 'b' ? 'black' : 'white';
    winner = resolveWinner(source.result);
    resultReason = source.termination;
    updatedAt = source.dateIso || nowIso;
    endedAt = source.dateIso || nowIso;
  } else {
    currentFen = source.fen || INITIAL_CHESS_FEN;
    status = source.status === 'completed' ? 'completed' : moves.length > 0 ? 'active' : 'waiting';
    const fenTurn = currentFen.split(' ')[1];
    currentTurn = fenTurn === 'b' ? 'black' : 'white';
    winner = resolveWinner(source.result);
    resultReason = source.termination ?? null;
    updatedAt = source.updatedAt || nowIso;
    endedAt = status === 'completed' ? updatedAt : null;
    metadataPayload = {
      ...metadataPayload,
      clockDirection: source.clockDirection,
      whiteSeconds: Number(source.whiteSeconds.toFixed(1)),
      blackSeconds: Number(source.blackSeconds.toFixed(1)),
    };
  }

  const roomStatus: D1RoomStatus = status === 'completed' ? 'closed' : 'in_game';
  const hostId = playerColor === 'b' ? blackPlayerId : whitePlayerId;
  const hostName = playerColor === 'b' ? blackDisplayName : whiteDisplayName;

  const room: GameRoomRow = {
    id: roomId,
    game_type: 'chess',
    status: roomStatus,
    host_player_id: hostId,
    host_display_name: hostName,
    current_game_id: gameId,
    is_private: 0,
    max_players: 2,
    do_stub_id: `do_${roomId}`,
    tenant_id: tenantId,
    workspace_id: workspaceId,
    join_code: null,
    visibility: 'private',
    metadata_json: JSON.stringify({ arenaId, playMode }),
    created_at: updatedAt,
    updated_at: updatedAt,
  };

  const game: GameRow = {
    id: gameId,
    game_type: 'chess',
    status,
    room_id: roomId,
    white_player_id: whitePlayerId,
    black_player_id: blackPlayerId,
    white_display_name: whiteDisplayName,
    black_display_name: blackDisplayName,
    current_turn: currentTurn,
    winner,
    result_reason: resultReason,
    piece_set_white: pieceSet,
    piece_set_black: pieceSet,
    board_state: currentFen,
    move_count: moves.length,
    tenant_id: tenantId,
    workspace_id: workspaceId,
    do_id: room.do_stub_id,
    initial_fen: INITIAL_CHESS_FEN,
    current_fen: currentFen,
    pgn: source.pgn || '',
    last_move_at: moves.length > 0 ? updatedAt : null,
    metadata_json: JSON.stringify(metadataPayload),
    started_at: moves.length > 0 ? updatedAt : null,
    ended_at: endedAt,
    created_at: updatedAt,
    updated_at: updatedAt,
  };

  const moveRows = moves.map((mv) =>
    mapRecordedMoveToD1Row(gameId, mv, whitePlayerId, blackPlayerId, updatedAt)
  );

  return {
    room,
    game,
    moves: moveRows,
  };
}

export function sqlLit(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

export function buildD1UpsertSql(bundle: D1ChessGameBundle): string {
  const { room, game, moves } = bundle;
  const statements: string[] = [
    `INSERT OR REPLACE INTO game_rooms (id, game_type, status, host_player_id, host_display_name, current_game_id, is_private, max_players, do_stub_id, tenant_id, workspace_id, join_code, visibility, metadata_json, created_at, updated_at) VALUES (${[
      sqlLit(room.id),
      sqlLit(room.game_type),
      sqlLit(room.status),
      sqlLit(room.host_player_id),
      sqlLit(room.host_display_name),
      sqlLit(room.current_game_id),
      sqlLit(room.is_private),
      sqlLit(room.max_players),
      sqlLit(room.do_stub_id),
      sqlLit(room.tenant_id),
      sqlLit(room.workspace_id),
      sqlLit(room.join_code),
      sqlLit(room.visibility),
      sqlLit(room.metadata_json),
      sqlLit(room.created_at),
      sqlLit(room.updated_at),
    ].join(', ')});`,
    `INSERT OR REPLACE INTO games (id, game_type, status, room_id, white_player_id, black_player_id, white_display_name, black_display_name, current_turn, winner, result_reason, piece_set_white, piece_set_black, board_state, move_count, tenant_id, workspace_id, do_id, initial_fen, current_fen, pgn, last_move_at, metadata_json, started_at, ended_at, created_at, updated_at) VALUES (${[
      sqlLit(game.id),
      sqlLit(game.game_type),
      sqlLit(game.status),
      sqlLit(game.room_id),
      sqlLit(game.white_player_id),
      sqlLit(game.black_player_id),
      sqlLit(game.white_display_name),
      sqlLit(game.black_display_name),
      sqlLit(game.current_turn),
      sqlLit(game.winner),
      sqlLit(game.result_reason),
      sqlLit(game.piece_set_white),
      sqlLit(game.piece_set_black),
      sqlLit(game.board_state),
      sqlLit(game.move_count),
      sqlLit(game.tenant_id),
      sqlLit(game.workspace_id),
      sqlLit(game.do_id),
      sqlLit(game.initial_fen),
      sqlLit(game.current_fen),
      sqlLit(game.pgn),
      sqlLit(game.last_move_at),
      sqlLit(game.metadata_json),
      sqlLit(game.started_at),
      sqlLit(game.ended_at),
      sqlLit(game.created_at),
      sqlLit(game.updated_at),
    ].join(', ')});`,
  ];

  for (const mv of moves) {
    statements.push(
      `INSERT OR REPLACE INTO game_moves (id, game_id, move_number, player_id, color, from_square, to_square, piece, captured_piece, promotion, is_check, is_checkmate, is_castling, is_en_passant, fen_after, pgn_notation, san, lan, time_ms, metadata_json, created_at) VALUES (${[
        sqlLit(mv.id),
        sqlLit(mv.game_id),
        sqlLit(mv.move_number),
        sqlLit(mv.player_id),
        sqlLit(mv.color),
        sqlLit(mv.from_square),
        sqlLit(mv.to_square),
        sqlLit(mv.piece),
        sqlLit(mv.captured_piece),
        sqlLit(mv.promotion),
        sqlLit(mv.is_check),
        sqlLit(mv.is_checkmate),
        sqlLit(mv.is_castling),
        sqlLit(mv.is_en_passant),
        sqlLit(mv.fen_after),
        sqlLit(mv.pgn_notation),
        sqlLit(mv.san),
        sqlLit(mv.lan),
        sqlLit(mv.time_ms),
        sqlLit(mv.metadata_json),
        sqlLit(mv.created_at),
      ].join(', ')});`
    );
  }

  return statements.join('\n');
}

export interface GenericArcadeMoveInput {
  ply: number;
  moveNumber: number;
  color: D1ChessColor;
  fromSquare: string;
  toSquare: string;
  piece: string;
  notation: string;
  capturedPiece?: string | null;
  promotion?: string | null;
  boardAfter?: string | null;
}

export interface GenericArcadeGameInput {
  gameId: string;
  gameType: 'checkers' | 'reversi';
  status: D1GameStatus;
  turn: D1ChessColor;
  winner: D1GameWinner;
  resultReason: string | null;
  pieceSet: string;
  initialState: string;
  currentState: string;
  whiteDisplayName: string;
  blackDisplayName: string;
  moves: GenericArcadeMoveInput[];
  metadata?: Record<string, unknown>;
}

export function buildArcadeGameD1Bundle(input: GenericArcadeGameInput): D1ChessGameBundle {
  const nowIso = new Date().toISOString();
  const gameId = input.gameId.startsWith('game_') ? input.gameId : `game_${input.gameId}`;
  const roomId = `room_${gameId}`;
  const roomStatus: D1RoomStatus = input.status === 'completed' ? 'closed' : 'in_game';

  const room: GameRoomRow = {
    id: roomId,
    game_type: input.gameType,
    status: roomStatus,
    host_player_id: 'player_white',
    host_display_name: input.whiteDisplayName,
    current_game_id: gameId,
    is_private: 0,
    max_players: 2,
    do_stub_id: `do_${roomId}`,
    tenant_id: null,
    workspace_id: 'ws_inneranimalmedia',
    join_code: null,
    visibility: 'private',
    metadata_json: JSON.stringify(input.metadata || {}),
    created_at: nowIso,
    updated_at: nowIso,
  };

  const game: GameRow = {
    id: gameId,
    game_type: input.gameType,
    status: input.status,
    room_id: roomId,
    white_player_id: 'player_white',
    black_player_id: 'player_black',
    white_display_name: input.whiteDisplayName,
    black_display_name: input.blackDisplayName,
    current_turn: input.turn,
    winner: input.winner,
    result_reason: input.resultReason,
    piece_set_white: input.pieceSet,
    piece_set_black: input.pieceSet,
    board_state: input.currentState,
    move_count: input.moves.length,
    tenant_id: null,
    workspace_id: 'ws_inneranimalmedia',
    do_id: room.do_stub_id,
    initial_fen: input.initialState,
    current_fen: input.currentState,
    pgn: input.moves.map((m) => m.notation).join(' '),
    last_move_at: input.moves.length > 0 ? nowIso : null,
    metadata_json: JSON.stringify(input.metadata || {}),
    started_at: input.moves.length > 0 ? nowIso : null,
    ended_at: input.status === 'completed' ? nowIso : null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const moveRows: GameMoveRow[] = input.moves.map((m) => ({
    id: `mv_${gameId}_${m.ply}`,
    game_id: gameId,
    move_number: m.moveNumber,
    player_id: m.color === 'white' ? 'player_white' : 'player_black',
    color: m.color,
    from_square: m.fromSquare,
    to_square: m.toSquare,
    piece: m.piece,
    captured_piece: m.capturedPiece ?? null,
    promotion: m.promotion ?? null,
    is_check: 0,
    is_checkmate: 0,
    is_castling: 0,
    is_en_passant: 0,
    fen_after: m.boardAfter ?? null,
    pgn_notation: m.notation,
    san: m.notation,
    lan: `${m.fromSquare}-${m.toSquare}`,
    time_ms: null,
    metadata_json: JSON.stringify({ ply: m.ply }),
    created_at: nowIso,
  }));

  return { room, game, moves: moveRows };
}

