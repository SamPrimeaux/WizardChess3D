import { WizardChessRules, rcToSquare, squareToRc, type BoardCell, type LegalTargetMove } from './chessRules';
import { chooseBestAIMove } from './chessAI';
import { soundFx } from './soundFx';
import {
  DEFAULT_SETTINGS,
  loadActiveGame,
  loadSettings,
  saveActiveGame,
  saveCompletedGame,
  saveSettings,
  type AIDifficulty,
  type ArenaId,
  type ClockDirection,
  type ClockPresetId,
  type CompletedGameRecord,
  type GameSettings,
  type GraphicsQuality,
  type PlayerColor,
  type PlayMode,
  type RecordedMove,
  type ReducedMotionSetting,
  type SavedGameState,
} from './storage';

export const CLOCK_PRESET_CONFIG: Record<
  ClockPresetId,
  { label: string; short: string; seconds: number }
> = {
  bullet: { label: 'Bullet', short: '1m', seconds: 60 },
  blitz: { label: 'Blitz', short: '3m', seconds: 180 },
  rapid: { label: 'Rapid', short: '10m', seconds: 600 },
  unlimited: { label: 'Untimed', short: '∞', seconds: 0 },
};

export interface PendingPromotion {
  fromR: number;
  fromC: number;
  toR: number;
  toC: number;
  color: PlayerColor;
}

export interface WizardChessUISnapshot {
  gameId: string;
  fen: string;
  pgn: string;
  arenaId: ArenaId;
  turn: PlayerColor;
  playMode: PlayMode;
  playerColor: PlayerColor;
  difficulty: AIDifficulty;
  clockPreset: ClockPresetId;
  clockDirection: ClockDirection;
  whiteSeconds: number;
  blackSeconds: number;
  clockPaused: boolean;
  timeoutWinner: PlayerColor | null;
  inCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  canClaimDraw: boolean;
  claimReason: string | null;
  isGameOver: boolean;
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  winner: PlayerColor | null;
  termination: string | null;
  moves: RecordedMove[];
  selectedHistoryPly: number | null;
  highlightedMove: { fromSq: string; toSq: string } | null;
  replayPly: number | null;
  isReplayMode: boolean;
  boardMatrix: (BoardCell | null)[][];
  captured: ReturnType<WizardChessRules['getCapturedSummary']>;
  isAnimatingMove: boolean;
  isAIThinking: boolean;
  soundMuted: boolean;
  graphicsQuality: GraphicsQuality;
  reducedMotion: ReducedMotionSetting;
  webglActive: boolean;
  webglError: string | null;
  pendingPromotion: PendingPromotion | null;
}

export interface WizardChessInitOptions {
  initialSettings?: Partial<GameSettings>;
  resumeSaved?: boolean;
  force2D?: boolean;
  onStateChange?: (snapshot: WizardChessUISnapshot) => void;
  onWebGLUnavailable?: (reason: string) => void;
  onGameCompleted?: (record: CompletedGameRecord) => void;
}

export interface WizardChessController {
  executeChessMove: (
    fromR: number,
    fromC: number,
    toR: number,
    toC: number,
    options?: { promotion?: string; skipPromotionPrompt?: boolean }
  ) => boolean;
  confirmPromotion: (pieceChar: 'q' | 'r' | 'b' | 'n') => boolean;
  cancelPromotion: () => void;
  getLegalMovesForSquare: (r: number, c: number) => LegalTargetMove[];
  triggerAIMoveNow: () => boolean;
  resetChessBoard: (orientCamera?: boolean, customSettings?: Partial<GameSettings>) => void;
  resumeSavedGame: (saved: SavedGameState) => boolean;
  undoMove: () => boolean;
  resignGame: (color?: PlayerColor) => void;
  claimDraw: () => boolean;
  loadFen: (fen: string) => { ok: boolean; error?: string };
  loadPgn: (pgn: string) => { ok: boolean; error?: string };
  loadCompletedGameReplay: (record: CompletedGameRecord) => boolean;
  highlightHistoryMove: (ply: number | null) => void;
  enterReplayAtPly: (ply: number) => void;
  stepReplay: (delta: number) => void;
  exitReplayToLive: () => void;
  setPlayMode: (mode: PlayMode) => void;
  setArena: (arenaId: ArenaId) => void;
  submitMoveNotation: (notation: string) => boolean;
  setPlayerColor: (color: PlayerColor) => void;
  setDifficulty: (diff: AIDifficulty) => void;
  setClockMode: (mode: ClockPresetId) => void;
  setClockDirection: (dir: ClockDirection) => void;
  resetChessClock: () => void;
  toggleClockPause: (force?: boolean) => void;
  setSoundMuted: (muted: boolean) => void;
  setGraphicsQuality: (quality: GraphicsQuality) => void;
  setReducedMotion: (setting: ReducedMotionSetting) => void;
  setCameraPreset: (preset: string) => void;
  toggleUI: (forceHidden?: boolean) => boolean;
  getMoveHistory: () => string[];
  getMoveHistoryPgn: () => string;
  getSnapshot: () => WizardChessUISnapshot;
  destroy: () => void;
}

export function createFallbackChessController(options: WizardChessInitOptions = {}): WizardChessController {
  const settings: GameSettings = {
    ...DEFAULT_SETTINGS,
    ...loadSettings(),
    ...options.initialSettings,
  };
  soundFx.setMuted(settings.soundMuted);

  const rules = new WizardChessRules();
  let gameId = `wc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  let gameEpoch = 0;
  let aiTimer: number | null = null;
  let isAIThinking = false;
  let clockInterval: number | null = null;
  let lastTickMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let completionRecordedForGameId: string | null = null;

  let clockPaused = false;
  let timeoutWinner: PlayerColor | null = null;
  let whiteSeconds = CLOCK_PRESET_CONFIG[settings.clockPreset].seconds;
  let blackSeconds = CLOCK_PRESET_CONFIG[settings.clockPreset].seconds;
  if (settings.clockDirection === 'up' || settings.clockPreset === 'unlimited') {
    whiteSeconds = 0;
    blackSeconds = 0;
  }

  let selectedHistoryPly: number | null = null;
  let replayPly: number | null = null;
  let replayRules: WizardChessRules | null = null;
  let pendingPromotion: PendingPromotion | null = null;

  function persistSettings() {
    saveSettings(settings);
  }

  function persistActiveState() {
    const status = rules.getStatus();
    if (status.isGameOver) {
      saveActiveGame(null);
      if (completionRecordedForGameId !== gameId && rules.getMoves().length > 0) {
        completionRecordedForGameId = gameId;
        const record: CompletedGameRecord = {
          schemaVersion: 1,
          id: gameId,
          dateIso: new Date().toISOString(),
          playMode: settings.playMode,
          playerColor: settings.playerColor,
          difficulty: settings.difficulty,
          clockPreset: settings.clockPreset,
          result: status.result === '*' ? '1/2-1/2' : status.result,
          termination: status.termination || 'Completed',
          moveCount: rules.getMoves().length,
          pgn: rules.getPgn(),
          finalFen: status.fen,
          moves: rules.getMoves(),
        };
        saveCompletedGame(record);
        options.onGameCompleted?.(record);
      }
      return;
    }

    if (rules.getMoves().length === 0) return;

    saveActiveGame({
      schemaVersion: 1,
      id: gameId,
      updatedAt: new Date().toISOString(),
      fen: status.fen,
      pgn: status.pgn,
      playMode: settings.playMode,
      playerColor: settings.playerColor,
      difficulty: settings.difficulty,
      clockPreset: settings.clockPreset,
      clockDirection: settings.clockDirection,
      whiteSeconds,
      blackSeconds,
      moves: rules.getMoves(),
      status: 'active',
    });
  }

  function getSnapshot(): WizardChessUISnapshot {
    const activeEngine = replayRules || rules;
    const status = rules.getStatus();
    const moves = rules.getMoves();
    const highlightedRec =
      selectedHistoryPly !== null
        ? moves.find((m) => m.ply === selectedHistoryPly) || null
        : moves.length > 0
        ? moves[moves.length - 1]
        : null;

    return {
      gameId,
      fen: activeEngine.getFen(),
      pgn: rules.getPgn(),
      arenaId: settings.arenaId,
      turn: status.turn,
      playMode: settings.playMode,
      playerColor: settings.playerColor,
      difficulty: settings.difficulty,
      clockPreset: settings.clockPreset,
      clockDirection: settings.clockDirection,
      whiteSeconds,
      blackSeconds,
      clockPaused,
      timeoutWinner,
      inCheck: status.inCheck,
      isCheckmate: status.isCheckmate,
      isStalemate: status.isStalemate,
      canClaimDraw: status.canClaimDraw,
      claimReason: status.claimReason,
      isGameOver: status.isGameOver,
      result: status.result,
      winner: status.winner,
      termination: status.termination,
      moves,
      selectedHistoryPly,
      highlightedMove: highlightedRec
        ? { fromSq: highlightedRec.fromSq, toSq: highlightedRec.toSq }
        : null,
      replayPly,
      isReplayMode: replayPly !== null,
      boardMatrix: activeEngine.getBoardMatrix(),
      captured: activeEngine.getCapturedSummary(),
      isAnimatingMove: false,
      isAIThinking,
      soundMuted: settings.soundMuted,
      graphicsQuality: settings.graphicsQuality,
      reducedMotion: settings.reducedMotion,
      webglActive: false,
      webglError: 'Using Classic 2D Board',
      pendingPromotion,
    };
  }

  function emit() {
    options.onStateChange?.(getSnapshot());
  }

  function cancelPendingAI() {
    gameEpoch += 1;
    if (aiTimer !== null) {
      clearTimeout(aiTimer);
      aiTimer = null;
    }
    isAIThinking = false;
  }

  function maybeScheduleAIMove() {
    if (aiTimer !== null) {
      clearTimeout(aiTimer);
      aiTimer = null;
    }
    const status = rules.getStatus();
    if (status.isGameOver || replayPly !== null || settings.playMode !== 'ai') {
      isAIThinking = false;
      return;
    }
    const aiColor: PlayerColor = settings.playerColor === 'w' ? 'b' : 'w';
    if (status.turn !== aiColor) {
      isAIThinking = false;
      return;
    }
    const scheduledEpoch = gameEpoch;
    isAIThinking = true;
    emit();

    aiTimer = window.setTimeout(() => {
      aiTimer = null;
      if (scheduledEpoch !== gameEpoch || rules.getStatus().isGameOver) {
        isAIThinking = false;
        emit();
        return;
      }
      const chosen = chooseBestAIMove(
        rules.getFen(),
        settings.difficulty,
        () => scheduledEpoch !== gameEpoch || rules.getStatus().isGameOver
      );
      isAIThinking = false;
      if (scheduledEpoch !== gameEpoch || !chosen) {
        emit();
        return;
      }
      const fromRc = squareToRc(chosen.from);
      const toRc = squareToRc(chosen.to);
      executeChessMove(fromRc.r, fromRc.c, toRc.r, toRc.c, {
        promotion: chosen.promotion,
        skipPromotionPrompt: true,
      });
    }, 280);
  }

  function executeChessMove(
    fromR: number,
    fromC: number,
    toR: number,
    toC: number,
    moveOpts: { promotion?: string; skipPromotionPrompt?: boolean } = {}
  ): boolean {
    if (replayPly !== null || rules.getStatus().isGameOver) return false;

    if (!moveOpts.skipPromotionPrompt && !moveOpts.promotion && rules.needsPromotionChoice(fromR, fromC, toR, toC)) {
      pendingPromotion = {
        fromR,
        fromC,
        toR,
        toC,
        color: rules.getTurn(),
      };
      emit();
      return true;
    }

    const res = rules.executeMove(fromR, fromC, toR, toC, moveOpts.promotion);
    if (!res) return false;

    pendingPromotion = null;
    selectedHistoryPly = res.move.ply;

    const status = rules.getStatus();
    if (status.isGameOver) {
      if (status.winner) {
        const humanWon = settings.playMode === 'local' || status.winner === settings.playerColor;
        soundFx.play(humanWon ? 'win' : 'loss');
      } else {
        soundFx.play('draw');
      }
    } else if (status.inCheck) {
      soundFx.play('check');
    } else {
      soundFx.play(res.move.capture ? 'capture' : 'move');
    }

    persistActiveState();
    emit();
    maybeScheduleAIMove();
    return true;
  }

  function resetClockInternal() {
    const base = CLOCK_PRESET_CONFIG[settings.clockPreset].seconds;
    timeoutWinner = null;
    clockPaused = false;
    if (settings.clockDirection === 'down' && settings.clockPreset !== 'unlimited') {
      whiteSeconds = base;
      blackSeconds = base;
    } else {
      whiteSeconds = 0;
      blackSeconds = 0;
    }
  }

  function resetChessBoard(_orientCamera = true, customSettings?: Partial<GameSettings>) {
    cancelPendingAI();
    if (customSettings) {
      Object.assign(settings, customSettings);
      persistSettings();
    }
    rules.reset();
    gameId = `wc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    completionRecordedForGameId = null;
    selectedHistoryPly = null;
    replayPly = null;
    replayRules = null;
    pendingPromotion = null;
    resetClockInternal();
    saveActiveGame(null);
    emit();
    maybeScheduleAIMove();
  }

  if (options.resumeSaved) {
    const saved = loadActiveGame();
    if (saved && rules.hydrateSavedGame(saved.fen, saved.moves)) {
      gameId = saved.id;
      settings.playMode = saved.playMode;
      settings.playerColor = saved.playerColor;
      settings.difficulty = saved.difficulty;
      settings.clockPreset = saved.clockPreset;
      settings.clockDirection = saved.clockDirection;
      whiteSeconds = saved.whiteSeconds;
      blackSeconds = saved.blackSeconds;
      selectedHistoryPly = saved.moves.length > 0 ? saved.moves[saved.moves.length - 1].ply : null;
    }
  }

  if (typeof window !== 'undefined') {
    clockInterval = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.25, Math.max(0, (now - lastTickMs) / 1000));
      lastTickMs = now;
      const status = rules.getStatus();
      if (
        clockPaused ||
        status.isGameOver ||
        replayPly !== null ||
        settings.clockPreset === 'unlimited' ||
        rules.getMoves().length === 0
      ) {
        return;
      }

      if (settings.clockDirection === 'down') {
        if (status.turn === 'w') {
          whiteSeconds = Math.max(0, whiteSeconds - dt);
          if (whiteSeconds <= 0) {
            timeoutWinner = 'b';
            rules.setTimeoutWinner('b');
            cancelPendingAI();
            soundFx.play('timeout');
            persistActiveState();
          }
        } else {
          blackSeconds = Math.max(0, blackSeconds - dt);
          if (blackSeconds <= 0) {
            timeoutWinner = 'w';
            rules.setTimeoutWinner('w');
            cancelPendingAI();
            soundFx.play('timeout');
            persistActiveState();
          }
        }
      } else {
        if (status.turn === 'w') whiteSeconds += dt;
        else blackSeconds += dt;
      }
      emit();
    }, 100);
  }

  const controller: WizardChessController = {
    executeChessMove,
    confirmPromotion(pieceChar) {
      if (!pendingPromotion) return false;
      const p = pendingPromotion;
      pendingPromotion = null;
      return executeChessMove(p.fromR, p.fromC, p.toR, p.toC, {
        promotion: pieceChar,
        skipPromotionPrompt: true,
      });
    },
    cancelPromotion() {
      pendingPromotion = null;
      emit();
    },
    getLegalMovesForSquare: (r, c) => (replayPly !== null ? [] : rules.getLegalMovesFrom(r, c)),
    triggerAIMoveNow() {
      const status = rules.getStatus();
      if (status.isGameOver || replayPly !== null) return false;
      const chosen = chooseBestAIMove(rules.getFen(), settings.difficulty);
      if (!chosen) return false;
      const fromRc = squareToRc(chosen.from);
      const toRc = squareToRc(chosen.to);
      return executeChessMove(fromRc.r, fromRc.c, toRc.r, toRc.c, {
        promotion: chosen.promotion,
        skipPromotionPrompt: true,
      });
    },
    resetChessBoard,
    resumeSavedGame(saved) {
      cancelPendingAI();
      if (!rules.hydrateSavedGame(saved.fen, saved.moves)) return false;
      gameId = saved.id;
      settings.playMode = saved.playMode;
      settings.playerColor = saved.playerColor;
      settings.difficulty = saved.difficulty;
      settings.clockPreset = saved.clockPreset;
      settings.clockDirection = saved.clockDirection;
      whiteSeconds = saved.whiteSeconds;
      blackSeconds = saved.blackSeconds;
      replayPly = null;
      replayRules = null;
      pendingPromotion = null;
      selectedHistoryPly = saved.moves.length > 0 ? saved.moves[saved.moves.length - 1].ply : null;
      emit();
      maybeScheduleAIMove();
      return true;
    },
    undoMove() {
      if (replayPly !== null || rules.getMoves().length === 0) return false;
      cancelPendingAI();
      timeoutWinner = null;
      if (settings.playMode === 'ai') {
        const aiColor: PlayerColor = settings.playerColor === 'w' ? 'b' : 'w';
        if (rules.getTurn() === settings.playerColor && rules.getMoves().length >= 2) {
          rules.undoLastMove();
          rules.undoLastMove();
        } else {
          rules.undoLastMove();
          if (rules.getTurn() === aiColor && rules.getMoves().length >= 1) {
            rules.undoLastMove();
          }
        }
      } else {
        rules.undoLastMove();
      }
      const moves = rules.getMoves();
      selectedHistoryPly = moves.length > 0 ? moves[moves.length - 1].ply : null;
      persistActiveState();
      emit();
      return true;
    },
    resignGame(color) {
      if (rules.getStatus().isGameOver) return;
      cancelPendingAI();
      const loser = color || (settings.playMode === 'ai' ? settings.playerColor : rules.getTurn());
      rules.resign(loser);
      soundFx.play('loss');
      persistActiveState();
      emit();
    },
    claimDraw() {
      const res = rules.claimDraw();
      if (!res) return false;
      cancelPendingAI();
      soundFx.play('draw');
      persistActiveState();
      emit();
      return true;
    },
    loadFen(fen) {
      cancelPendingAI();
      const res = rules.loadFen(fen);
      if (!res.ok) return res;
      gameId = `wc-${Date.now()}`;
      completionRecordedForGameId = null;
      selectedHistoryPly = null;
      replayPly = null;
      replayRules = null;
      resetClockInternal();
      emit();
      maybeScheduleAIMove();
      return { ok: true };
    },
    loadPgn(pgn) {
      cancelPendingAI();
      const res = rules.loadPgn(pgn);
      if (!res.ok) return res;
      gameId = `wc-${Date.now()}`;
      completionRecordedForGameId = null;
      selectedHistoryPly = res.moves.length > 0 ? res.moves[res.moves.length - 1].ply : null;
      replayPly = null;
      replayRules = null;
      resetClockInternal();
      emit();
      return { ok: true };
    },
    loadCompletedGameReplay(record) {
      cancelPendingAI();
      const ok = rules.loadPgn(record.pgn).ok || rules.hydrateSavedGame(record.finalFen, record.moves);
      if (!ok) return false;
      gameId = record.id;
      completionRecordedForGameId = record.id;
      settings.playMode = record.playMode;
      settings.playerColor = record.playerColor;
      settings.difficulty = record.difficulty;
      const startPly = record.moves.length > 0 ? 1 : 0;
      controller.enterReplayAtPly(startPly);
      return true;
    },
    highlightHistoryMove(ply) {
      selectedHistoryPly = ply;
      emit();
    },
    enterReplayAtPly(ply) {
      const moves = rules.getMoves();
      const clamped = Math.max(0, Math.min(moves.length, ply));
      replayPly = clamped;
      selectedHistoryPly = clamped > 0 ? clamped : null;
      const targetFen =
        clamped === 0
          ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
          : moves[clamped - 1].fenAfter;
      replayRules = new WizardChessRules(targetFen);
      emit();
    },
    stepReplay(delta) {
      const moves = rules.getMoves();
      const cur = replayPly === null ? moves.length : replayPly;
      controller.enterReplayAtPly(cur + delta);
    },
    exitReplayToLive() {
      replayPly = null;
      replayRules = null;
      const moves = rules.getMoves();
      selectedHistoryPly = moves.length > 0 ? moves[moves.length - 1].ply : null;
      emit();
    },
    setPlayMode(mode) {
      settings.playMode = mode;
      persistSettings();
      cancelPendingAI();
      emit();
      maybeScheduleAIMove();
    },
    setArena(arenaId) {
      settings.arenaId = arenaId === 'robotics' ? 'robotics' : 'cathedral';
      persistSettings();
      emit();
    },
    submitMoveNotation(notation) {
      if (replayPly !== null || rules.getStatus().isGameOver) return false;
      if (settings.playMode === 'ai' && rules.getTurn() !== settings.playerColor) return false;
      const parsed = rules.resolveMoveNotation(notation);
      if (!parsed) return false;
      return executeChessMove(parsed.fromR, parsed.fromC, parsed.toR, parsed.toC, {
        promotion: parsed.promotion,
        skipPromotionPrompt: true,
      });
    },
    setPlayerColor(color) {
      settings.playerColor = color;
      persistSettings();
      cancelPendingAI();
      emit();
      maybeScheduleAIMove();
    },
    setDifficulty(diff) {
      settings.difficulty = diff;
      persistSettings();
      emit();
    },
    setClockMode(mode) {
      settings.clockPreset = mode;
      persistSettings();
      resetClockInternal();
      emit();
    },
    setClockDirection(dir) {
      settings.clockDirection = dir;
      persistSettings();
      resetClockInternal();
      emit();
    },
    resetChessClock() {
      resetClockInternal();
      emit();
    },
    toggleClockPause(force) {
      clockPaused = typeof force === 'boolean' ? force : !clockPaused;
      emit();
    },
    setSoundMuted(muted) {
      settings.soundMuted = muted;
      soundFx.setMuted(muted);
      persistSettings();
      emit();
    },
    setGraphicsQuality(quality) {
      settings.graphicsQuality = quality;
      persistSettings();
      emit();
    },
    setReducedMotion(setting) {
      settings.reducedMotion = setting;
      persistSettings();
      emit();
    },
    setCameraPreset() {},
    toggleUI(forceHidden) {
      const shouldHide =
        typeof forceHidden === 'boolean'
          ? forceHidden
          : !document.body.classList.contains('cinematic-ui-hidden');
      document.body.classList.toggle('cinematic-ui-hidden', shouldHide);
      return shouldHide;
    },
    getMoveHistory: () => rules.getMoves().map((m) => m.san),
    getMoveHistoryPgn: () => rules.getPgn(),
    getSnapshot,
    destroy() {
      cancelPendingAI();
      if (clockInterval !== null) {
        clearInterval(clockInterval);
        clockInterval = null;
      }
    },
  };

  if (typeof window !== 'undefined') {
    (window as unknown as { wizardChess?: WizardChessController }).wizardChess = controller;
  }

  emit();
  options.onWebGLUnavailable?.('Classic 2D Board active');
  return controller;
}
