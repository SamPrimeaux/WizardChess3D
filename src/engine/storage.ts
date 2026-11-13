export type PlayMode = 'ai' | 'local';
export type PlayerColor = 'w' | 'b';
export type AIDifficulty = 'novice' | 'club' | 'master';
export type ClockPresetId = 'bullet' | 'blitz' | 'rapid' | 'unlimited';
export type ClockDirection = 'down' | 'up';
export type GraphicsQuality = 'low' | 'medium' | 'high';
export type ReducedMotionSetting = 'system' | 'on' | 'off';
export type RendererPreference = 'auto' | '2d';

export interface GameSettings {
  schemaVersion: 1;
  playMode: PlayMode;
  playerColor: PlayerColor;
  difficulty: AIDifficulty;
  clockPreset: ClockPresetId;
  clockDirection: ClockDirection;
  soundMuted: boolean;
  graphicsQuality: GraphicsQuality;
  reducedMotion: ReducedMotionSetting;
  rendererPreference: RendererPreference;
}

export interface RecordedMove {
  ply: number;
  moveNumber: number;
  san: string;
  fromSq: string;
  toSq: string;
  color: PlayerColor;
  pieceType: string;
  fromR: number;
  fromC: number;
  toR: number;
  toC: number;
  capture: boolean;
  capturedType?: string | null;
  isEnPassant?: boolean;
  isCastle?: 'k' | 'q' | null;
  promotion?: string | null;
  fenAfter: string;
}

export interface SavedGameState {
  schemaVersion: 1;
  id: string;
  updatedAt: string;
  fen: string;
  pgn: string;
  playMode: PlayMode;
  playerColor: PlayerColor;
  difficulty: AIDifficulty;
  clockPreset: ClockPresetId;
  clockDirection: ClockDirection;
  whiteSeconds: number;
  blackSeconds: number;
  moves: RecordedMove[];
  status: 'active' | 'completed';
  result?: '1-0' | '0-1' | '1/2-1/2';
  termination?: string;
}

export interface CompletedGameRecord {
  schemaVersion: 1;
  id: string;
  dateIso: string;
  playMode: PlayMode;
  playerColor: PlayerColor;
  difficulty: AIDifficulty;
  clockPreset: ClockPresetId;
  result: '1-0' | '0-1' | '1/2-1/2';
  termination: string;
  moveCount: number;
  pgn: string;
  finalFen: string;
  moves: RecordedMove[];
}

export const SETTINGS_STORAGE_KEY = 'inneranimalmedia.wizard-chess-3d.settings.v1';
export const ACTIVE_GAME_STORAGE_KEY = 'inneranimalmedia.wizard-chess-3d.active-game.v1';
export const HISTORY_STORAGE_KEY = 'inneranimalmedia.wizard-chess-3d.history.v1';

export const DEFAULT_SETTINGS: GameSettings = {
  schemaVersion: 1,
  playMode: 'ai',
  playerColor: 'w',
  difficulty: 'club',
  clockPreset: 'blitz',
  clockDirection: 'down',
  soundMuted: false,
  graphicsQuality: 'high',
  reducedMotion: 'system',
  rendererPreference: 'auto',
};

function safeGetStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

export function loadSettings(): GameSettings {
  const storage = safeGetStorage();
  if (!storage) return { ...DEFAULT_SETTINGS };
  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      schemaVersion: 1,
      playMode: parsed.playMode === 'local' ? 'local' : 'ai',
      playerColor: parsed.playerColor === 'b' ? 'b' : 'w',
      difficulty:
        parsed.difficulty === 'novice' || parsed.difficulty === 'master'
          ? parsed.difficulty
          : 'club',
      clockPreset:
        parsed.clockPreset === 'bullet' ||
        parsed.clockPreset === 'blitz' ||
        parsed.clockPreset === 'rapid' ||
        parsed.clockPreset === 'unlimited'
          ? parsed.clockPreset
          : 'blitz',
      clockDirection: parsed.clockDirection === 'up' ? 'up' : 'down',
      soundMuted: Boolean(parsed.soundMuted),
      graphicsQuality:
        parsed.graphicsQuality === 'low' || parsed.graphicsQuality === 'medium'
          ? parsed.graphicsQuality
          : 'high',
      reducedMotion:
        parsed.reducedMotion === 'on' || parsed.reducedMotion === 'off'
          ? parsed.reducedMotion
          : 'system',
      rendererPreference: parsed.rendererPreference === '2d' ? '2d' : 'auto',
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  const storage = safeGetStorage();
  if (!storage) return;
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...settings, schemaVersion: 1 }));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export function loadActiveGame(): SavedGameState | null {
  const storage = safeGetStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(ACTIVE_GAME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedGameState;
    if (!parsed || typeof parsed.fen !== 'string' || !Array.isArray(parsed.moves)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveActiveGame(state: SavedGameState | null): void {
  const storage = safeGetStorage();
  if (!storage) return;
  try {
    if (!state) {
      storage.removeItem(ACTIVE_GAME_STORAGE_KEY);
      return;
    }
    storage.setItem(ACTIVE_GAME_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadGameHistory(): CompletedGameRecord[] {
  const storage = safeGetStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCompletedGame(record: CompletedGameRecord): CompletedGameRecord[] {
  const existing = loadGameHistory().filter((g) => g.id !== record.id);
  const next = [record, ...existing].slice(0, 50);
  const storage = safeGetStorage();
  if (storage) {
    try {
      storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota errors
    }
  }
  return next;
}

export function deleteGameHistoryRecord(id: string): CompletedGameRecord[] {
  const next = loadGameHistory().filter((g) => g.id !== id);
  const storage = safeGetStorage();
  if (storage) {
    try {
      storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota errors
    }
  }
  return next;
}

export function clearGameHistory(): void {
  const storage = safeGetStorage();
  if (!storage) return;
  try {
    storage.removeItem(HISTORY_STORAGE_KEY);
  } catch {
    // Ignore
  }
}
