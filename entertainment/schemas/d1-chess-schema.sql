-- =============================================================================
-- InnerAnimalMedia :: Wizard Chess 3D (inneranimalmedia.wizard-chess-3d)
-- Organized SQLite / Cloudflare D1 Relational Schema
-- Tables: game_rooms, games, game_moves, game_credits
-- =============================================================================

PRAGMA foreign_keys = ON;

-- 1. Multiplayer / Arena Game Rooms (Durable Object & Lobby Routing)
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

CREATE INDEX IF NOT EXISTS idx_game_rooms_status
  ON game_rooms (status, game_type);

CREATE INDEX IF NOT EXISTS idx_game_rooms_workspace
  ON game_rooms (workspace_id, visibility);

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_rooms_join_code
  ON game_rooms (join_code)
  WHERE join_code IS NOT NULL AND join_code <> '';

-- 2. Individual Chess Match State & Snapshot Record
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

CREATE INDEX IF NOT EXISTS idx_games_room_id
  ON games (room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_games_status
  ON games (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_games_workspace
  ON games (workspace_id, tenant_id);

-- 3. Normalized Per-Ply Move Log (Synchronized with Chess Engine & 3D Board Highlights)
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

CREATE INDEX IF NOT EXISTS idx_game_moves_game_order
  ON game_moves (game_id, move_number, color, created_at);

-- 4. Workspace Entertainment Credits Balance Ledger
CREATE TABLE IF NOT EXISTS game_credits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL UNIQUE,
  credits_balance INTEGER NOT NULL DEFAULT 0,
  total_purchased INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  last_purchase_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_game_credits_updated_at
  ON game_credits (updated_at DESC);
