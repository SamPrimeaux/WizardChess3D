export type PlayMode = 'ai' | 'local';
export type PlayerColor = 'w' | 'b';
export type AIDifficulty = 'novice' | 'club' | 'master';
export type ClockPresetId = 'bullet' | 'blitz' | 'rapid' | 'unlimited';
export type ClockDirection = 'down' | 'up';
export type GraphicsQuality = 'low' | 'medium' | 'high';
export type ReducedMotionSetting = 'system' | 'on' | 'off';
export type RendererPreference = 'auto' | '2d';
export type ArenaId = 'cathedral' | 'robotics';

export interface GameSettings {
  schemaVersion: 1;
  arenaId: ArenaId;
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
  elapsedSeconds?: number;
  startedAtIso?: string;
  moves: RecordedMove[];
  status: 'active' | 'completed';
  result?: '1-0' | '0-1' | '1/2-1/2';
  termination?: string;
  arenaId?: ArenaId;
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
  durationSeconds?: number;
  captureCount?: number;
  playerCaptures?: number;
  opponentCaptures?: number;
  pgn: string;
  finalFen: string;
  moves: RecordedMove[];
  arenaId?: ArenaId;
}

export type MatchOutcome = 'win' | 'loss' | 'draw';

export interface CareerStats {
  schemaVersion: 1;
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRatePct: number;
  lossRatePct: number;
  drawRatePct: number;
  totalCaptures: number;
  playerCaptures: number;
  opponentCaptures: number;
  totalMoves: number;
  totalDurationSeconds: number;
  longestGameSeconds: number;
  longestGameMoves: number;
  currentWinStreak: number;
  bestWinStreak: number;
  recordedGameIds: string[];
}

export const SETTINGS_STORAGE_KEY = 'inneranimalmedia.wizard-chess-3d.settings.v1';
export const ACTIVE_GAME_STORAGE_KEY = 'inneranimalmedia.wizard-chess-3d.active-game.v1';
export const HISTORY_STORAGE_KEY = 'inneranimalmedia.wizard-chess-3d.history.v1';
export const CAREER_STATS_STORAGE_KEY = 'inneranimalmedia.wizard-chess-3d.career-stats.v1';

export const DEFAULT_SETTINGS: GameSettings = {
  schemaVersion: 1,
  arenaId: 'cathedral',
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

function detectDefaultGraphicsQuality(): GraphicsQuality {
  try {
    if (typeof window !== 'undefined') {
      const isCoarse = window.matchMedia?.('(pointer: coarse)')?.matches;
      const isCompact = Math.min(window.innerWidth, window.innerHeight) <= 768;
      if (isCoarse || isCompact) return 'medium';
    }
  } catch {
    // Fallback to high
  }
  return 'high';
}

export function countRecordCaptures(
  record: Pick<
    CompletedGameRecord,
    'moves' | 'playerColor' | 'captureCount' | 'playerCaptures' | 'opponentCaptures'
  >
): { totalCaptures: number; playerCaptures: number; opponentCaptures: number } {
  const perspective: PlayerColor = record.playerColor === 'b' ? 'b' : 'w';
  if (Array.isArray(record.moves) && record.moves.length > 0) {
    let playerCaptures = 0;
    let opponentCaptures = 0;
    for (const mv of record.moves) {
      if (mv && mv.capture) {
        if (mv.color === perspective) playerCaptures += 1;
        else opponentCaptures += 1;
      }
    }
    return {
      totalCaptures: playerCaptures + opponentCaptures,
      playerCaptures,
      opponentCaptures,
    };
  }
  const fallbackPlayer = Math.max(0, Math.floor(record.playerCaptures ?? 0));
  const fallbackOpponent = Math.max(0, Math.floor(record.opponentCaptures ?? 0));
  const fallbackTotal = Math.max(
    fallbackPlayer + fallbackOpponent,
    Math.max(0, Math.floor(record.captureCount ?? 0))
  );
  return {
    totalCaptures: fallbackTotal,
    playerCaptures: fallbackPlayer,
    opponentCaptures: fallbackOpponent,
  };
}

export function resolveRecordOutcome(
  record: Pick<CompletedGameRecord, 'result' | 'playerColor'>
): MatchOutcome {
  if (record.result === '1/2-1/2') return 'draw';
  const winnerColor: PlayerColor = record.result === '0-1' ? 'b' : 'w';
  const perspective: PlayerColor = record.playerColor === 'b' ? 'b' : 'w';
  return winnerColor === perspective ? 'win' : 'loss';
}

export function formatDurationClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function createEmptyCareerStats(): CareerStats {
  return {
    schemaVersion: 1,
    totalGames: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winRatePct: 0,
    lossRatePct: 0,
    drawRatePct: 0,
    totalCaptures: 0,
    playerCaptures: 0,
    opponentCaptures: 0,
    totalMoves: 0,
    totalDurationSeconds: 0,
    longestGameSeconds: 0,
    longestGameMoves: 0,
    currentWinStreak: 0,
    bestWinStreak: 0,
    recordedGameIds: [],
  };
}

function recomputeCareerPercentages(stats: CareerStats): CareerStats {
  const total = Math.max(0, stats.totalGames);
  const roundTenths = (num: number) => Math.round(num * 10) / 10;
  return {
    ...stats,
    schemaVersion: 1,
    winRatePct: total > 0 ? roundTenths((stats.wins / total) * 100) : 0,
    lossRatePct: total > 0 ? roundTenths((stats.losses / total) * 100) : 0,
    drawRatePct: total > 0 ? roundTenths((stats.draws / total) * 100) : 0,
  };
}

export function normalizeCompletedGameRecord(record: CompletedGameRecord): CompletedGameRecord {
  const caps = countRecordCaptures(record);
  const moveCount = Math.max(
    Array.isArray(record.moves) ? record.moves.length : 0,
    Math.max(0, Math.floor(record.moveCount ?? 0))
  );
  const rawDuration = Number(record.durationSeconds ?? 0);
  const durationSeconds = Number.isFinite(rawDuration) ? Math.max(0, Math.round(rawDuration)) : 0;

  return {
    ...record,
    schemaVersion: 1,
    moveCount,
    durationSeconds,
    captureCount: caps.totalCaptures,
    playerCaptures: caps.playerCaptures,
    opponentCaptures: caps.opponentCaptures,
  };
}

export function applyCompletedGameToCareerStats(
  current: CareerStats,
  rawRecord: CompletedGameRecord
): CareerStats {
  const record = normalizeCompletedGameRecord(rawRecord);
  if (record.id && current.recordedGameIds.includes(record.id)) {
    return recomputeCareerPercentages(current);
  }

  const outcome = resolveRecordOutcome(record);
  const wins = current.wins + (outcome === 'win' ? 1 : 0);
  const losses = current.losses + (outcome === 'loss' ? 1 : 0);
  const draws = current.draws + (outcome === 'draw' ? 1 : 0);
  const totalGames = current.totalGames + 1;
  const currentWinStreak = outcome === 'win' ? current.currentWinStreak + 1 : 0;
  const bestWinStreak = Math.max(current.bestWinStreak, currentWinStreak);
  const duration = record.durationSeconds ?? 0;
  const moveCount = record.moveCount ?? 0;

  return recomputeCareerPercentages({
    schemaVersion: 1,
    totalGames,
    wins,
    losses,
    draws,
    winRatePct: 0,
    lossRatePct: 0,
    drawRatePct: 0,
    totalCaptures: current.totalCaptures + (record.captureCount ?? 0),
    playerCaptures: current.playerCaptures + (record.playerCaptures ?? 0),
    opponentCaptures: current.opponentCaptures + (record.opponentCaptures ?? 0),
    totalMoves: current.totalMoves + moveCount,
    totalDurationSeconds: current.totalDurationSeconds + duration,
    longestGameSeconds: Math.max(current.longestGameSeconds, duration),
    longestGameMoves: Math.max(current.longestGameMoves, moveCount),
    currentWinStreak,
    bestWinStreak,
    recordedGameIds: record.id
      ? [...current.recordedGameIds, record.id].slice(-500)
      : current.recordedGameIds,
  });
}

export function calculateCareerStatsFromRecords(records: CompletedGameRecord[]): CareerStats {
  const chronological = [...records].reverse();
  let acc = createEmptyCareerStats();
  for (const rec of chronological) {
    if (rec && typeof rec === 'object') {
      acc = applyCompletedGameToCareerStats(acc, rec);
    }
  }
  return acc;
}

function sanitizeStoredCareerStats(parsed: Partial<CareerStats>): CareerStats {
  const empty = createEmptyCareerStats();
  const safeNum = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
  const wins = safeNum(parsed.wins);
  const losses = safeNum(parsed.losses);
  const draws = safeNum(parsed.draws);
  const totalGames = Math.max(wins + losses + draws, safeNum(parsed.totalGames));

  return recomputeCareerPercentages({
    ...empty,
    schemaVersion: 1,
    totalGames,
    wins,
    losses,
    draws,
    totalCaptures: safeNum(parsed.totalCaptures),
    playerCaptures: safeNum(parsed.playerCaptures),
    opponentCaptures: safeNum(parsed.opponentCaptures),
    totalMoves: safeNum(parsed.totalMoves),
    totalDurationSeconds: safeNum(parsed.totalDurationSeconds),
    longestGameSeconds: safeNum(parsed.longestGameSeconds),
    longestGameMoves: safeNum(parsed.longestGameMoves),
    currentWinStreak: safeNum(parsed.currentWinStreak),
    bestWinStreak: safeNum(parsed.bestWinStreak),
    recordedGameIds: Array.isArray(parsed.recordedGameIds)
      ? parsed.recordedGameIds.filter((id): id is string => typeof id === 'string')
      : [],
  });
}

export function loadCareerStats(): CareerStats {
  const storage = safeGetStorage();
  if (!storage) {
    return calculateCareerStatsFromRecords(loadGameHistory());
  }
  try {
    const raw = storage.getItem(CAREER_STATS_STORAGE_KEY);
    if (!raw) {
      const seeded = calculateCareerStatsFromRecords(loadGameHistory());
      if (seeded.totalGames > 0) {
        storage.setItem(CAREER_STATS_STORAGE_KEY, JSON.stringify(seeded));
      }
      return seeded;
    }
    const parsed = JSON.parse(raw) as Partial<CareerStats>;
    if (!parsed || typeof parsed !== 'object') {
      return createEmptyCareerStats();
    }
    return sanitizeStoredCareerStats(parsed);
  } catch {
    return calculateCareerStatsFromRecords(loadGameHistory());
  }
}

export function recordGameInCareerStats(record: CompletedGameRecord): CareerStats {
  const current = loadCareerStats();
  const next = applyCompletedGameToCareerStats(current, record);
  const storage = safeGetStorage();
  if (storage) {
    try {
      storage.setItem(CAREER_STATS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }
  return next;
}

export function clearCareerStats(): CareerStats {
  const empty = createEmptyCareerStats();
  const storage = safeGetStorage();
  if (storage) {
    try {
      storage.setItem(CAREER_STATS_STORAGE_KEY, JSON.stringify(empty));
    } catch {
      // Ignore storage quota errors
    }
  }
  return empty;
}

export function loadSettings(): GameSettings {
  const storage = safeGetStorage();
  const fallbackQuality = detectDefaultGraphicsQuality();
  if (!storage) return { ...DEFAULT_SETTINGS, graphicsQuality: fallbackQuality };
  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, graphicsQuality: fallbackQuality };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      schemaVersion: 1,
      arenaId: parsed.arenaId === 'robotics' ? 'robotics' : 'cathedral',
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
    return Array.isArray(parsed)
      ? parsed.map((rec) => normalizeCompletedGameRecord(rec as CompletedGameRecord))
      : [];
  } catch {
    return [];
  }
}

export function saveCompletedGame(record: CompletedGameRecord): CompletedGameRecord[] {
  const normalized = normalizeCompletedGameRecord(record);
  const existing = loadGameHistory().filter((g) => g.id !== normalized.id);
  const next = [normalized, ...existing].slice(0, 50);
  const storage = safeGetStorage();
  if (storage) {
    try {
      storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota errors
    }
  }
  recordGameInCareerStats(normalized);
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
