import { loadGameHistory } from '../engine/storage';

export type ArcadeGameId = 'chess' | 'checkers' | 'reversi';

export interface ArcadeMatchRecord {
  id: string;
  gameType: ArcadeGameId;
  gameTitle: string;
  winnerLabel: string;
  summary: string;
  moveCount: number;
  modeLabel: string;
  dateIso: string;
}

const ARCADE_HISTORY_KEY = 'inneranimalmedia.entertainment.arcade-history.v1';

export function loadArcadeMatchRecords(): ArcadeMatchRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ARCADE_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordArcadeMatch(entry: Omit<ArcadeMatchRecord, 'id' | 'dateIso'>): ArcadeMatchRecord[] {
  const nextRecord: ArcadeMatchRecord = {
    ...entry,
    id: `arc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    dateIso: new Date().toISOString(),
  };
  const existing = loadArcadeMatchRecords();
  const updated = [nextRecord, ...existing].slice(0, 40);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(ARCADE_HISTORY_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage quota errors
    }
  }
  return updated;
}

export function getUnifiedEntertainmentLedger(): {
  totalMatches: number;
  totalMoves: number;
  recentMatches: ArcadeMatchRecord[];
} {
  const chessHistory = loadGameHistory().map<ArcadeMatchRecord>((rec) => ({
    id: rec.id,
    gameType: 'chess',
    gameTitle: 'Wizard Chess 3D',
    winnerLabel:
      rec.result === '1-0'
        ? 'White Won'
        : rec.result === '0-1'
        ? 'Black Won'
        : 'Drawn Match',
    summary: `${rec.result} · ${rec.termination}`,
    moveCount: rec.moveCount,
    modeLabel: rec.playMode === 'ai' ? `vs AI (${rec.difficulty})` : 'Local 2P',
    dateIso: rec.dateIso,
  }));

  const otherGames = loadArcadeMatchRecords();
  const combined = [...otherGames, ...chessHistory].sort(
    (a, b) => new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime()
  );

  const totalMoves = combined.reduce((sum, item) => sum + (item.moveCount || 0), 0);
  return {
    totalMatches: combined.length,
    totalMoves,
    recentMatches: combined.slice(0, 8),
  };
}
