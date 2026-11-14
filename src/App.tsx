import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initWizardChess } from './wizardChessEngine.js';
import {
  CLOCK_PRESET_CONFIG,
  createFallbackChessController,
  type WizardChessController,
  type WizardChessUISnapshot,
} from './engine/fallbackEngine';
import {
  clearGameHistory,
  DEFAULT_SETTINGS,
  deleteGameHistoryRecord,
  loadActiveGame,
  loadGameHistory,
  loadSettings,
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
  type RendererPreference,
  type SavedGameState,
} from './engine/storage';
import { ARENA_CATALOG } from './arenas/roboticsLabArena';
import { Board2DFallback } from './components/Board2DFallback';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  emitEntertainmentStateUpdate,
  notifyEntertainmentHostReady,
} from './integrations/entertainment/hostAdapter';
import {
  getInitialMcpDisplayMode,
  initMcpAppsBridge,
  isMcpHostEmbedded,
  requestMcpDisplayMode,
  syncMcpModelContext,
  type McpDisplayMode,
} from './integrations/mcpApps/bridge';

const PIECE_GLYPHS: Record<string, string> = {
  queen: '♛',
  rook: '♜',
  bishop: '♝',
  knight: '♞',
  pawn: '♟',
};

const PIECE_MATERIAL_POINTS: Record<string, number> = {
  queen: 9,
  rook: 5,
  bishop: 3,
  knight: 3,
  pawn: 1,
};

const ARENA_CARD_META: Record<ArenaId, { tag: string; crewLabel: string }> = {
  cathedral: {
    tag: 'Sculpted Marble & Gold',
    crewLabel: 'Royal Stone Sanctum',
  },
  robotics: {
    tag: 'EVA Astronauts & 6-DOF Arm',
    crewLabel: 'Orbital Telemetry Bay',
  },
};

function formatClock(totalSeconds: number, direction: ClockDirection, preset: ClockPresetId): string {
  if (preset === 'unlimited' && direction === 'down') return '∞';
  const safe = Math.max(0, totalSeconds);
  if (direction === 'down') {
    if (safe <= 0) return '0:00.0';
    if (safe < 10) {
      const whole = Math.floor(safe);
      const tenths = Math.floor((safe - whole) * 10);
      return `0:0${whole}.${tenths}`;
    }
  }
  const rounded = Math.floor(safe);
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function ArenaEmblem({ arena }: { arena: ArenaId }) {
  if (arena === 'robotics') {
    return (
      <svg className="world-emblem" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <circle cx="14" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.75" />
        <path
          d="M8.5 11.5C10.5 9.2 17.5 9.2 19.5 11.5C19.5 14.3 17.2 16 14 16C10.8 16 8.5 14.3 8.5 11.5Z"
          fill="currentColor"
          fillOpacity="0.28"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path d="M14 2V4.5M4 23.5H24M9 19.5L7.5 23.5M19 19.5L20.5 23.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className="world-emblem" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path
        d="M14 3.5V7.5M12 5.5H16M8.5 12L10.5 19H17.5L19.5 12L16.5 14L14 9.5L11.5 14L8.5 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M8 22.5H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function HudIcon({ name }: { name: 'undo' | 'draw' | 'resign' | 'reset' | 'camera' | 'arena' | 'soundOn' | 'soundOff' | 'view' | 'settings' | 'history' | 'hide' }) {
  switch (name) {
    case 'undo':
      return (
        <svg className="hud-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M8 5L4 9L8 13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4.5 9H12.5C15 9 16.5 10.6 16.5 12.8C16.5 14.7 15.1 16 13 16H10.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case 'draw':
      return (
        <svg className="hud-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M10 3.5V16.5M5 6.5H15M5 6.5L3 11.5H7L5 6.5ZM15 6.5L13 11.5H17L15 6.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      );
    case 'resign':
      return (
        <svg className="hud-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M5 3.5V17M5 4.5H14.5L12.5 8L14.5 11.5H5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'reset':
      return (
        <svg className="hud-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M15.8 7.5A6.5 6.5 0 1 0 16.4 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M16 4V7.8H12.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'camera':
      return (
        <svg className="hud-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect x="2.8" y="5.5" width="10.4" height="9" rx="1.8" stroke="currentColor" strokeWidth="1.6" />
          <path d="M13.2 8.5L17.2 6.4V13.6L13.2 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      );
    case 'arena':
      return (
        <svg className="hud-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M10 2.5L16.5 6.2V13.8L10 17.5L3.5 13.8V6.2L10 2.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M10 10L16.5 6.2M10 10V17.5M10 10L3.5 6.2" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
    case 'soundOn':
      return (
        <svg className="hud-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M3.5 8H6.8L11 4.5V15.5L6.8 12H3.5V8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M14 7.2C15 8.1 15.5 9 15.5 10C15.5 11 15 11.9 14 12.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'soundOff':
      return (
        <svg className="hud-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M3.5 8H6.8L11 4.5V15.5L6.8 12H3.5V8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M14 8L17.5 11.5M17.5 8L14 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'view':
      return (
        <svg className="hud-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect x="3.5" y="3.5" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M10 3.5V16.5M3.5 10H16.5" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
    case 'settings':
      return (
        <svg className="hud-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="2.7" stroke="currentColor" strokeWidth="1.6" />
          <path d="M10 3V4.8M10 15.2V17M3 10H4.8M15.2 10H17M5.1 5.1L6.4 6.4M13.6 13.6L14.9 14.9M14.9 5.1L13.6 6.4M6.4 13.6L5.1 14.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'history':
      return (
        <svg className="hud-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M10 6.5V10.3L12.7 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'hide':
      return (
        <svg className="hud-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M2.5 10C4.6 6.6 7.1 5 10 5C12.9 5 15.4 6.6 17.5 10C15.4 13.4 12.9 15 10 15C7.1 15 4.6 13.4 2.5 10Z" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="10" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
  }
}

export default function App() {
  const controllerRef = useRef<WizardChessController | null>(null);
  const statusPillRef = useRef<HTMLDivElement | null>(null);
  const cameraMenuRef = useRef<HTMLDivElement | null>(null);
  const historyListRef = useRef<HTMLDivElement | null>(null);

  const initialSettings = useMemo<GameSettings>(() => {
    const loaded = loadSettings();
    if (typeof window !== 'undefined') {
      const urlArena = new URLSearchParams(window.location.search).get('arena');
      if (urlArena === 'robotics' || urlArena === 'cathedral') {
        return { ...loaded, arenaId: urlArena };
      }
    }
    return loaded;
  }, []);
  const mcpEmbedded = useMemo(() => isMcpHostEmbedded(), []);

  const [settingsState, setSettingsState] = useState<GameSettings>(initialSettings);
  const [rendererPref, setRendererPref] = useState<RendererPreference>(initialSettings.rendererPreference);
  const [screen, setScreen] = useState<'home' | 'game'>(() => {
    if (typeof window === 'undefined') return 'home';
    const params = new URLSearchParams(window.location.search);
    if (mcpEmbedded || params.get('play') === '1' || navigator.webdriver) return 'game';
    return 'home';
  });
  const [savedActiveGame, setSavedActiveGame] = useState<SavedGameState | null>(() => loadActiveGame());
  const [completedGames, setCompletedGames] = useState<CompletedGameRecord[]>(() => loadGameHistory());

  const [snapshot, setSnapshot] = useState<WizardChessUISnapshot | null>(null);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [mcpDisplayMode, setMcpDisplayMode] = useState<McpDisplayMode>(() => getInitialMcpDisplayMode());

  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [clockMenuOpen, setClockMenuOpen] = useState(false);
  const [cameraMenuOpen, setCameraMenuOpen] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 900 : false
  );

  const [activeModal, setActiveModal] = useState<'none' | 'settings' | 'history' | 'fenpgn'>('none');
  const [gameOverDismissedForId, setGameOverDismissedForId] = useState<string | null>(null);
  const [copiedFeedback, setCopiedFeedback] = useState<'pgn' | 'fen' | null>(null);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [moveNotationInput, setMoveNotationInput] = useState('');
  const [moveNotationError, setMoveNotationError] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);

  // Quick setup draft inside Opening Screen / Settings modal
  const [draftArena, setDraftArena] = useState<ArenaId>(initialSettings.arenaId);
  const [draftPlayMode, setDraftPlayMode] = useState<PlayMode>(initialSettings.playMode);
  const [draftColor, setDraftColor] = useState<PlayerColor>(initialSettings.playerColor);
  const [draftDifficulty, setDraftDifficulty] = useState<AIDifficulty>(initialSettings.difficulty);
  const [draftClock, setDraftClock] = useState<ClockPresetId>(initialSettings.clockPreset);
  const [draftDirection, setDraftDirection] = useState<ClockDirection>(initialSettings.clockDirection);
  const [draftQuality, setDraftQuality] = useState<GraphicsQuality>(initialSettings.graphicsQuality);
  const [draftMotion, setDraftMotion] = useState<ReducedMotionSetting>(initialSettings.reducedMotion);
  const [draftRenderer, setDraftRenderer] = useState<RendererPreference>(initialSettings.rendererPreference);

  const lastSyncedFenRef = useRef<string>('');
  const activeArenaId: ArenaId = snapshot?.arenaId || settingsState.arenaId || draftArena || 'cathedral';
  const visualArena: ArenaId = screen === 'home' ? draftArena : activeArenaId;

  useEffect(() => {
    document.body.dataset.arena = visualArena;
  }, [visualArena]);

  // Mount / Remount 3D or 2D Controller cleanly when renderer preference changes
  useEffect(() => {
    const currentSettings = loadSettings();
    notifyEntertainmentHostReady(currentSettings);

    const handleStateChange = (next: WizardChessUISnapshot) => {
      setSnapshot(next);
      setSavedActiveGame(loadActiveGame());

      if (next.fen !== lastSyncedFenRef.current) {
        lastSyncedFenRef.current = next.fen;
        const lastMove = next.moves[next.moves.length - 1];
        const statusLabel = next.isGameOver
          ? next.termination || 'Game Over'
          : next.inCheck
          ? 'Check'
          : 'In Progress';

        syncMcpModelContext({
          fen: next.fen,
          turn: next.turn,
          moveCount: next.moves.length,
          lastSan: lastMove?.san,
          status: statusLabel,
        });

        emitEntertainmentStateUpdate(loadActiveGame(), {
          gameId: next.gameId,
          fen: next.fen,
          turn: next.turn,
          moveCount: next.moves.length,
          isGameOver: next.isGameOver,
          result: next.result,
          termination: next.termination,
        });
      }
    };

    const handleWebGLUnavailable = (reason: string) => {
      setFallbackReason(reason);
    };

    const handleGameCompleted = () => {
      setCompletedGames(loadGameHistory());
    };

    let ctrl: WizardChessController;
    if (rendererPref === '2d') {
      ctrl = createFallbackChessController({
        initialSettings: currentSettings,
        force2D: true,
        onStateChange: handleStateChange,
        onWebGLUnavailable: handleWebGLUnavailable,
        onGameCompleted: handleGameCompleted,
      });
    } else {
      setFallbackReason(null);
      ctrl = initWizardChess({
        initialSettings: currentSettings,
        onStateChange: handleStateChange,
        onWebGLUnavailable: handleWebGLUnavailable,
        onGameCompleted: handleGameCompleted,
      }) as WizardChessController;
    }

    controllerRef.current = ctrl;
    setSnapshot(ctrl.getSnapshot());

    return () => {
      ctrl.destroy();
      if (controllerRef.current === ctrl) {
        controllerRef.current = null;
      }
    };
  }, [rendererPref]);

  // MCP Apps Host Bridge
  useEffect(() => {
    const cleanup = initMcpAppsBridge({
      onDisplayModeChange: (mode) => setMcpDisplayMode(mode),
      onToolPayload: (payload) => {
        const ctrl = controllerRef.current;
        if (!ctrl) return;
        if (payload.displayMode) setMcpDisplayMode(payload.displayMode);
        if (payload.pgn) {
          ctrl.loadPgn(payload.pgn);
          setScreen('game');
        } else if (payload.fen) {
          ctrl.loadFen(payload.fen);
          setScreen('game');
        } else if (payload.playMode || payload.difficulty || payload.playerColor || payload.clockPreset) {
          ctrl.resetChessBoard(true, {
            playMode: payload.playMode,
            difficulty: payload.difficulty,
            playerColor: payload.playerColor,
            clockPreset: payload.clockPreset,
          });
          setScreen('game');
        }
      },
    });
    return cleanup;
  }, []);

  // Global keyboard & outside-click listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileSheetOpen(false);
        setClockMenuOpen(false);
        setCameraMenuOpen(false);
        setActiveModal('none');
      }
      if (
        (e.key === 'h' || e.key === 'H') &&
        screen === 'game' &&
        activeModal === 'none' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement?.tagName || '').toUpperCase())
      ) {
        setClockMenuOpen(false);
        setCameraMenuOpen(false);
        setUiHidden(document.body.classList.contains('cinematic-ui-hidden'));
      }
    };
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (clockMenuOpen && statusPillRef.current && !statusPillRef.current.contains(target)) {
        setClockMenuOpen(false);
      }
      if (cameraMenuOpen && cameraMenuRef.current && !cameraMenuRef.current.contains(target)) {
        setCameraMenuOpen(false);
      }
    };
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setMobileSheetOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [clockMenuOpen, cameraMenuOpen, screen, activeModal]);

  // Auto-scroll Move History list
  useEffect(() => {
    if (historyListRef.current && !snapshot?.isReplayMode) {
      historyListRef.current.scrollTop = historyListRef.current.scrollHeight;
    }
  }, [snapshot?.moves.length, snapshot?.isReplayMode]);

  // Live preview Arena switch on Home screen
  const handleSelectHomeArena = useCallback(
    (id: ArenaId) => {
      setDraftArena(id);
      const nextSettings: GameSettings = { ...settingsState, arenaId: id };
      saveSettings(nextSettings);
      setSettingsState(nextSettings);
      controllerRef.current?.setArena(id);
    },
    [settingsState]
  );

  const startFreshMatch = useCallback(
    (overrides?: Partial<GameSettings>) => {
      const merged: GameSettings = {
        ...DEFAULT_SETTINGS,
        ...settingsState,
        arenaId: draftArena,
        playMode: draftPlayMode,
        playerColor: draftColor,
        difficulty: draftDifficulty,
        clockPreset: draftClock,
        clockDirection: draftDirection,
        graphicsQuality: draftQuality,
        reducedMotion: draftMotion,
        rendererPreference: draftRenderer,
        ...overrides,
      };
      saveSettings(merged);
      setSettingsState(merged);
      setGameOverDismissedForId(null);
      setActiveModal('none');
      setMobileSheetOpen(false);
      setScreen('game');

      if (merged.rendererPreference !== rendererPref) {
        setRendererPref(merged.rendererPreference);
      } else {
        controllerRef.current?.resetChessBoard(true, merged);
      }
    },
    [
      settingsState,
      draftArena,
      draftPlayMode,
      draftColor,
      draftDifficulty,
      draftClock,
      draftDirection,
      draftQuality,
      draftMotion,
      draftRenderer,
      rendererPref,
    ]
  );

  const handleContinueSavedGame = useCallback(() => {
    const saved = loadActiveGame();
    if (!saved) return;
    setGameOverDismissedForId(null);
    setScreen('game');
    controllerRef.current?.resumeSavedGame(saved);
  }, []);

  const handleApplyLiveSettings = useCallback(() => {
    const ctrl = controllerRef.current;
    const nextSettings: GameSettings = {
      ...settingsState,
      arenaId: draftArena,
      playMode: draftPlayMode,
      playerColor: draftColor,
      difficulty: draftDifficulty,
      clockPreset: draftClock,
      clockDirection: draftDirection,
      graphicsQuality: draftQuality,
      reducedMotion: draftMotion,
      rendererPreference: draftRenderer,
    };
    saveSettings(nextSettings);
    setSettingsState(nextSettings);

    if (nextSettings.rendererPreference !== rendererPref) {
      setRendererPref(nextSettings.rendererPreference);
      setActiveModal('none');
      return;
    }
    if (ctrl) {
      if (snapshot?.arenaId !== draftArena) ctrl.setArena(draftArena);
      if (snapshot?.playMode !== draftPlayMode) ctrl.setPlayMode(draftPlayMode);
      if (snapshot?.playerColor !== draftColor) ctrl.setPlayerColor(draftColor);
      if (snapshot?.difficulty !== draftDifficulty) ctrl.setDifficulty(draftDifficulty);
      if (snapshot?.clockPreset !== draftClock) ctrl.setClockMode(draftClock);
      if (snapshot?.clockDirection !== draftDirection) ctrl.setClockDirection(draftDirection);
      ctrl.setGraphicsQuality(draftQuality);
      ctrl.setReducedMotion(draftMotion);
    }
    setActiveModal('none');
  }, [
    settingsState,
    draftArena,
    draftPlayMode,
    draftColor,
    draftDifficulty,
    draftClock,
    draftDirection,
    draftQuality,
    draftMotion,
    draftRenderer,
    rendererPref,
    snapshot,
  ]);

  const handleSwitchArenaLive = useCallback(() => {
    const nextArena: ArenaId = activeArenaId === 'robotics' ? 'cathedral' : 'robotics';
    const nextSettings: GameSettings = { ...settingsState, arenaId: nextArena };
    saveSettings(nextSettings);
    setSettingsState(nextSettings);
    setDraftArena(nextArena);
    controllerRef.current?.setArena(nextArena);
  }, [activeArenaId, settingsState]);

  const handleSubmitNotationMove = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const ctrl = controllerRef.current;
      const trimmed = moveNotationInput.trim();
      if (!ctrl || !trimmed) return;
      const ok = ctrl.submitMoveNotation(trimmed);
      if (ok) {
        setMoveNotationInput('');
        setMoveNotationError(false);
      } else {
        setMoveNotationError(true);
      }
    },
    [moveNotationInput]
  );

  const handleCopyText = useCallback((kind: 'pgn' | 'fen', text: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedFeedback(kind);
    window.setTimeout(() => setCopiedFeedback(null), 1500);
  }, []);

  const handleImportPosition = useCallback(() => {
    const ctrl = controllerRef.current;
    const raw = importText.trim();
    if (!ctrl || !raw) {
      setImportError('Paste a valid FEN string or PGN move list first.');
      return;
    }
    const looksLikeFen = raw.includes('/') && raw.split(/\s+/).length >= 4;
    const res = looksLikeFen ? ctrl.loadFen(raw) : ctrl.loadPgn(raw);
    if (!res.ok) {
      setImportError(res.error || 'Unable to parse input as FEN or PGN.');
      return;
    }
    setImportError(null);
    setActiveModal('none');
    setScreen('game');
  }, [importText]);

  const handleToggleUI = useCallback((force?: boolean) => {
    const next = controllerRef.current?.toggleUI(force);
    if (typeof next === 'boolean') setUiHidden(next);
  }, []);

  // Pair moves into rows for clean algebraic table
  const moveRows = useMemo(() => {
    const rows: { num: number; white?: RecordedMove; black?: RecordedMove }[] = [];
    const moves = snapshot?.moves || [];
    for (let i = 0; i < moves.length; i += 2) {
      rows.push({
        num: Math.floor(i / 2) + 1,
        white: moves[i],
        black: moves[i + 1],
      });
    }
    return rows;
  }, [snapshot?.moves]);

  const turnStatusLabel = useMemo(() => {
    if (!snapshot) return visualArena === 'robotics' ? 'Calibrating Workcell...' : 'Summoning Sanctum...';
    if (snapshot.isReplayMode) {
      return `Replay: Move ${snapshot.replayPly ?? 0} / ${snapshot.moves.length}`;
    }
    if (snapshot.isGameOver) {
      if (snapshot.isCheckmate) {
        return `Checkmate — ${snapshot.winner === 'w' ? 'White' : 'Black'} Wins`;
      }
      if (snapshot.timeoutWinner) {
        return `Time Out — ${snapshot.timeoutWinner === 'w' ? 'White' : 'Black'} Wins`;
      }
      return snapshot.termination || 'Game Over';
    }
    if (snapshot.isAIThinking) {
      const actor = activeArenaId === 'robotics' ? '6-DOF Arm Thinking...' : 'AI Thinking...';
      return `${snapshot.turn === 'w' ? 'White' : 'Black'} (${actor})`;
    }
    const base = snapshot.turn === 'w' ? 'White to Move' : 'Black to Move';
    return snapshot.inCheck ? `${base} — CHECK` : base;
  }, [snapshot, activeArenaId, visualArena]);

  const show2DBoard =
    rendererPref === '2d' || (snapshot !== null && !snapshot.webglActive);

  const showGameOverBanner =
    screen === 'game' &&
    Boolean(snapshot?.isGameOver) &&
    !snapshot?.isReplayMode &&
    gameOverDismissedForId !== snapshot?.gameId;

  const whiteClockClass = [
    'clock-readout clock-white',
    snapshot && !snapshot.isGameOver && snapshot.turn === 'w' ? 'active' : '',
    snapshot?.clockPaused ? 'paused' : '',
    snapshot && snapshot.clockDirection === 'down' && snapshot.clockPreset !== 'unlimited'
      ? snapshot.whiteSeconds <= 10
        ? 'critical-time'
        : snapshot.whiteSeconds <= 25
        ? 'low-time'
        : ''
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  const blackClockClass = [
    'clock-readout clock-black',
    snapshot && !snapshot.isGameOver && snapshot.turn === 'b' ? 'active' : '',
    snapshot?.clockPaused ? 'paused' : '',
    snapshot && snapshot.clockDirection === 'down' && snapshot.clockPreset !== 'unlimited'
      ? snapshot.blackSeconds <= 10
        ? 'critical-time'
        : snapshot.blackSeconds <= 25
        ? 'low-time'
        : ''
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  const capturedSummary = useMemo(() => {
    const byWhite = snapshot?.captured.byWhite || [];
    const byBlack = snapshot?.captured.byBlack || [];
    const whiteScore = byWhite.reduce((acc, p) => acc + (PIECE_MATERIAL_POINTS[p] || 0), 0);
    const blackScore = byBlack.reduce((acc, p) => acc + (PIECE_MATERIAL_POINTS[p] || 0), 0);
    return {
      whiteGlyphs: byWhite.map((p) => PIECE_GLYPHS[p] || '').join(''),
      blackGlyphs: byBlack.map((p) => PIECE_GLYPHS[p] || '').join(''),
      whiteLead: whiteScore > blackScore ? whiteScore - blackScore : 0,
      blackLead: blackScore > whiteScore ? blackScore - whiteScore : 0,
    };
  }, [snapshot?.captured.byWhite, snapshot?.captured.byBlack]);

  return (
    <div className={mcpDisplayMode === 'inline' ? 'mcp-inline-shell' : ''}>
      <OfflineIndicator />

      {!show2DBoard && (
        <div id="loading-overlay">
          <div className="loader-emblem">
            <ArenaEmblem arena={visualArena} />
          </div>
          <div className="loader-title">Wizard Chess 3D</div>
          <div className="loader-bar-wrap">
            <div className="loader-bar" id="loader-bar"></div>
          </div>
          <div id="loader-text">
            {visualArena === 'robotics'
              ? 'Initializing Workcell Optics & EVA Astronaut Fleet...'
              : 'Summoning Sanctum Architecture & Sculpted Pieces...'}
          </div>
        </div>
      )}

      {/* 3D Arena Canvas (or 2D Fallback Board when WebGL is unavailable / 2D chosen) */}
      <div
        id="canvas-container"
        style={{ display: show2DBoard ? 'none' : 'block' }}
        aria-hidden={show2DBoard}
      />

      {show2DBoard && snapshot && (
        <Board2DFallback
          boardMatrix={snapshot.boardMatrix}
          flipped={snapshot.playerColor === 'b' && snapshot.playMode === 'ai'}
          turn={snapshot.turn}
          interactive={
            screen === 'game' &&
            !snapshot.isGameOver &&
            !snapshot.isReplayMode &&
            !snapshot.pendingPromotion &&
            !(snapshot.playMode === 'ai' && snapshot.turn !== snapshot.playerColor)
          }
          highlightedMove={snapshot.highlightedMove}
          getLegalMoves={(r, c) => controllerRef.current?.getLegalMovesForSquare(r, c) || []}
          onMoveAttempt={(fr, fc, tr, tc) => {
            controllerRef.current?.executeChessMove(fr, fc, tr, tc);
          }}
          fallbackReason={fallbackReason}
          arenaId={activeArenaId}
        />
      )}

      {/* OPENING SCREEN (Left-Docked Game Lobby showcasing Live 3D World on Right) */}
      {screen === 'home' && mcpDisplayMode !== 'inline' && (
        <main className="home-overlay" role="main" aria-label="Wizard Chess 3D Title Screen">
          <section className="home-card">
            <div className="home-publisher-row">
              <span className="home-publisher-badge">InnerAnimalMedia • Entertainment</span>
              <span className="home-version-tag">v1.0.0</span>
            </div>

            <div className="home-hero-block">
              <h1 className="home-title">Wizard Chess 3D</h1>
              <p className="home-subtitle">
                {ARENA_CATALOG[draftArena].subtitle}
              </p>
            </div>

            <div className="home-setup-grid">
              <div className="setup-field">
                <label className="setup-label">Select Arena World</label>
                <div className="world-card-grid" id="home-arena-selector">
                  {(['cathedral', 'robotics'] as ArenaId[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      id={`btn-home-arena-${id}`}
                      className={`world-card-btn ${draftArena === id ? 'active' : ''}`}
                      onClick={() => handleSelectHomeArena(id)}
                    >
                      <ArenaEmblem arena={id} />
                      <div className="world-card-copy">
                        <span className="world-card-name">{ARENA_CATALOG[id].name}</span>
                        <span className="world-card-tag">{ARENA_CARD_META[id].tag}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="setup-split-row">
                <div className="setup-field">
                  <label className="setup-label">Match Mode</label>
                  <div className="segmented-row">
                    <button
                      type="button"
                      className={`seg-btn ${draftPlayMode === 'ai' ? 'active' : ''}`}
                      onClick={() => setDraftPlayMode('ai')}
                    >
                      {draftArena === 'robotics' ? 'vs 6-DOF AI' : 'vs Computer'}
                    </button>
                    <button
                      type="button"
                      className={`seg-btn ${draftPlayMode === 'local' ? 'active' : ''}`}
                      onClick={() => setDraftPlayMode('local')}
                    >
                      Local 2P
                    </button>
                  </div>
                </div>

                {draftPlayMode === 'ai' && (
                  <div className="setup-field">
                    <label className="setup-label">Command Side</label>
                    <div className="segmented-row">
                      <button
                        type="button"
                        className={`seg-btn ${draftColor === 'w' ? 'active' : ''}`}
                        onClick={() => setDraftColor('w')}
                      >
                        ♔ White
                      </button>
                      <button
                        type="button"
                        className={`seg-btn ${draftColor === 'b' ? 'active' : ''}`}
                        onClick={() => setDraftColor('b')}
                      >
                        ♚ Black
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {draftPlayMode === 'ai' && (
                <div className="setup-field">
                  <label className="setup-label">AI Difficulty</label>
                  <div className="segmented-row triple">
                    {(['novice', 'club', 'master'] as AIDifficulty[]).map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={`seg-btn ${draftDifficulty === d ? 'active' : ''}`}
                        onClick={() => setDraftDifficulty(d)}
                      >
                        {d.charAt(0).toUpperCase() + d.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="setup-field">
                <label className="setup-label">Time Control</label>
                <div className="segmented-row quad">
                  {(['bullet', 'blitz', 'rapid', 'unlimited'] as ClockPresetId[]).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`seg-btn ${draftClock === preset ? 'active' : ''}`}
                      onClick={() => setDraftClock(preset)}
                    >
                      {CLOCK_PRESET_CONFIG[preset].label} ({CLOCK_PRESET_CONFIG[preset].short})
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="home-primary-actions">
              <button
                type="button"
                id="btn-home-play"
                className="sanctum-primary-btn large"
                onClick={() => startFreshMatch()}
              >
                Enter Arena &amp; Play
              </button>

              {savedActiveGame && (
                <button
                  type="button"
                  id="btn-home-continue"
                  className="sanctum-secondary-btn large"
                  onClick={handleContinueSavedGame}
                >
                  Resume Saved Match ({savedActiveGame.moves.length} moves)
                </button>
              )}
            </div>

            <div className="home-secondary-actions">
              <button
                type="button"
                className="hud-btn"
                onClick={() => setActiveModal('settings')}
              >
                Settings
              </button>
              <button
                type="button"
                className="hud-btn"
                onClick={() => {
                  setCompletedGames(loadGameHistory());
                  setActiveModal('history');
                }}
              >
                Archive ({completedGames.length})
              </button>
              <button
                type="button"
                className="hud-btn"
                onClick={() => {
                  setImportText(snapshot?.fen || '');
                  setImportError(null);
                  setActiveModal('fenpgn');
                }}
              >
                FEN / PGN
              </button>
              <PWAInstallButton />
            </div>
          </section>

          <div className="home-arena-stage-badge" aria-hidden="true">
            <ArenaEmblem arena={draftArena} />
            <div className="home-stage-meta">
              <span className="home-stage-kicker">{ARENA_CARD_META[draftArena].crewLabel}</span>
              <span className="home-stage-title">{ARENA_CATALOG[draftArena].name}</span>
            </div>
          </div>
        </main>
      )}

      {/* IN-GAME HUD */}
      {screen === 'game' && (
        <>
          <button
            type="button"
            className="hud-btn mobile-only-restore-ui"
            id="btn-mobile-show-ui"
            onClick={() => handleToggleUI(false)}
            title="Show HUD Controls"
          >
            Show UI
          </button>

          {/* TOP BROADCAST MATCH BAR */}
          <div id="hud-top">
            <div className="hud-group" id="hud-left">
              {mcpDisplayMode !== 'inline' && (
                <button
                  type="button"
                  className="brand-pill brand-btn"
                  id="btn-menu-home"
                  onClick={() => {
                    setMobileSheetOpen(false);
                    setClockMenuOpen(false);
                    setCameraMenuOpen(false);
                    setScreen('home');
                  }}
                  title="Return to Arena Lobby"
                >
                  <ArenaEmblem arena={activeArenaId} />
                  <span className="brand-title">Wizard Chess</span>
                  <span className="brand-sub">Lobby</span>
                </button>
              )}

              <div className={`status-pill ${snapshot?.inCheck && !snapshot?.isGameOver ? 'in-check' : ''}`} id="status-pill" ref={statusPillRef}>
                <div className="status-main-group">
                  <span
                    className={`turn-dot ${snapshot?.turn === 'b' ? 'black' : ''}`}
                    id="turn-dot"
                  ></span>
                  <span id="turn-text">{turnStatusLabel}</span>
                  <span className="mode-badge" id="mode-badge">
                    {snapshot?.playMode === 'local'
                      ? '2P'
                      : `${(snapshot?.difficulty || 'club').toUpperCase()}`}
                  </span>
                </div>

                <div className="status-clock-overlay" id="chess-clock-overlay" aria-label="Digital Chess Clock">
                  <div className={whiteClockClass} id="clock-white" title="White Clock">
                    <span className="clock-side-dot white" aria-hidden="true"></span>
                    <span className="clock-time" id="clock-white-time">
                      {formatClock(
                        snapshot?.whiteSeconds ?? 180,
                        snapshot?.clockDirection ?? 'down',
                        snapshot?.clockPreset ?? 'blitz'
                      )}
                    </span>
                  </div>
                  <div className={blackClockClass} id="clock-black" title="Black Clock">
                    <span className="clock-side-dot black" aria-hidden="true"></span>
                    <span className="clock-time" id="clock-black-time">
                      {formatClock(
                        snapshot?.blackSeconds ?? 180,
                        snapshot?.clockDirection ?? 'down',
                        snapshot?.clockPreset ?? 'blitz'
                      )}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`clock-settings-trigger ${clockMenuOpen ? 'active' : ''}`}
                    id="btn-clock-settings"
                    aria-expanded={clockMenuOpen}
                    aria-controls="clock-settings-popover"
                    title="Clock Settings"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCameraMenuOpen(false);
                      setClockMenuOpen((prev) => !prev);
                    }}
                  >
                    <span id="clock-mode-label">
                      {CLOCK_PRESET_CONFIG[snapshot?.clockPreset || 'blitz'].label}
                    </span>
                    <span className="clock-dir-glyph" id="clock-dir-glyph" aria-hidden="true">
                      {snapshot?.clockDirection === 'up' ? '↑' : '↓'}
                    </span>
                  </button>
                </div>

                <div
                  className={`clock-settings-popover ${clockMenuOpen ? 'open' : ''}`}
                  id="clock-settings-popover"
                  role="dialog"
                  aria-label="Chess Clock Settings"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="clock-popover-header">
                    <span className="clock-popover-title">Match Clock</span>
                    <span className="clock-popover-sub">
                      {CLOCK_PRESET_CONFIG[snapshot?.clockPreset || 'blitz'].label} •{' '}
                      {snapshot?.clockDirection === 'up' ? 'Count Up' : 'Count Down'}
                    </span>
                  </div>

                  <div className="clock-popover-group">
                    <span className="clock-popover-label">Time Control</span>
                    <div className="clock-segmented">
                      {(['bullet', 'blitz', 'rapid', 'unlimited'] as ClockPresetId[]).map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className={`clock-opt-btn ${snapshot?.clockPreset === preset ? 'active' : ''}`}
                          onClick={() => controllerRef.current?.setClockMode(preset)}
                        >
                          {CLOCK_PRESET_CONFIG[preset].label} ({CLOCK_PRESET_CONFIG[preset].short})
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="clock-popover-group">
                    <span className="clock-popover-label">Clock Mode</span>
                    <div className="clock-segmented">
                      <button
                        type="button"
                        className={`clock-opt-btn ${snapshot?.clockDirection === 'down' ? 'active' : ''}`}
                        onClick={() => controllerRef.current?.setClockDirection('down')}
                      >
                        Count Down ↓
                      </button>
                      <button
                        type="button"
                        className={`clock-opt-btn ${snapshot?.clockDirection === 'up' ? 'active' : ''}`}
                        onClick={() => controllerRef.current?.setClockDirection('up')}
                      >
                        Count Up ↑
                      </button>
                    </div>
                  </div>

                  <div className="clock-popover-actions">
                    <button
                      type="button"
                      className={`clock-action-btn ${snapshot?.clockPaused ? 'paused-active' : ''}`}
                      onClick={() => controllerRef.current?.toggleClockPause()}
                    >
                      {snapshot?.clockPaused ? 'Resume' : 'Pause'}
                    </button>
                    <button
                      type="button"
                      className="clock-action-btn"
                      onClick={() => controllerRef.current?.resetChessClock()}
                    >
                      Reset Clocks
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              className={`hud-btn mobile-controls-trigger ${mobileSheetOpen ? 'active' : ''}`}
              id="btn-mobile-controls"
              aria-expanded={mobileSheetOpen}
              aria-controls="hud-right"
              onClick={() => {
                setClockMenuOpen(false);
                setCameraMenuOpen(false);
                setMobileSheetOpen((prev) => !prev);
              }}
            >
              {mobileSheetOpen ? 'Close' : 'Controls'}
            </button>

            <div
              className={`mobile-sheet-backdrop ${mobileSheetOpen ? 'open' : ''}`}
              onClick={() => setMobileSheetOpen(false)}
              aria-hidden="true"
            ></div>

            {/* UNIFIED BOTTOM ARCHITECTURAL COMMAND DOCK (Desktop) / SLIDE-UP SHEET (Mobile) */}
            <div
              className={`hud-group command-dock ${mobileSheetOpen ? 'mobile-sheet-open' : ''}`}
              id="hud-right"
            >
              <div
                className="mobile-sheet-handle-wrap"
                onClick={() => setMobileSheetOpen(false)}
                aria-hidden="true"
              >
                <div className="mobile-sheet-handle"></div>
              </div>

              <div className="mobile-sheet-header">
                <span className="mobile-sheet-title">Command Deck</span>
                <button
                  type="button"
                  className="mobile-sheet-close"
                  onClick={() => setMobileSheetOpen(false)}
                  aria-label="Close Controls"
                >
                  Close ✕
                </button>
              </div>

              <button
                type="button"
                className="hud-btn"
                id="btn-undo"
                disabled={!snapshot?.moves.length || snapshot.isReplayMode || snapshot.isAnimatingMove}
                onClick={() => {
                  controllerRef.current?.undoMove();
                  setMobileSheetOpen(false);
                }}
                title="Undo Last Move"
              >
                <HudIcon name="undo" />
                <span>Undo</span>
              </button>

              {snapshot?.canClaimDraw && !snapshot.isGameOver && (
                <button
                  type="button"
                  className="hud-btn primary"
                  id="btn-claim-draw"
                  onClick={() => {
                    controllerRef.current?.claimDraw();
                    setMobileSheetOpen(false);
                  }}
                  title={snapshot.claimReason || 'Claim Draw'}
                >
                  <HudIcon name="draw" />
                  <span>Claim Draw</span>
                </button>
              )}

              {!snapshot?.isGameOver && (snapshot?.moves.length ?? 0) > 0 && (
                <button
                  type="button"
                  className="hud-btn danger-subtle"
                  id="btn-resign"
                  onClick={() => {
                    controllerRef.current?.resignGame();
                    setMobileSheetOpen(false);
                  }}
                  title="Resign current game"
                >
                  <HudIcon name="resign" />
                  <span>Resign</span>
                </button>
              )}

              <button
                type="button"
                className="hud-btn"
                id="btn-reset"
                onClick={() => {
                  setGameOverDismissedForId(null);
                  controllerRef.current?.resetChessBoard(true);
                  setMobileSheetOpen(false);
                }}
                title="Start a Fresh Match"
              >
                <HudIcon name="reset" />
                <span>New Game</span>
              </button>

              <span className="hud-divider" aria-hidden="true"></span>

              {!show2DBoard && (
                <div className="camera-menu-wrap" ref={cameraMenuRef}>
                  <button
                    type="button"
                    className={`hud-btn ${cameraMenuOpen ? 'active' : ''}`}
                    id="btn-camera-menu"
                    onClick={() => {
                      setClockMenuOpen(false);
                      setCameraMenuOpen((prev) => !prev);
                    }}
                  >
                    <HudIcon name="camera" />
                    <span>Camera ▾</span>
                  </button>
                  {cameraMenuOpen && (
                    <div className="camera-popover" role="menu" aria-label="Camera Presets">
                      {[
                        ['player', 'Player View'],
                        ['opponent', 'Opponent View'],
                        ['top', 'Overhead View'],
                        ['side', 'Side Profile'],
                        ['wide', ARENA_CATALOG[activeArenaId].wideCameraLabel],
                        ['reset', 'Reset Camera'],
                      ].map(([preset, label]) => (
                        <button
                          key={preset}
                          type="button"
                          className="camera-popover-item"
                          onClick={() => {
                            controllerRef.current?.setCameraPreset(preset);
                            setCameraMenuOpen(false);
                            setMobileSheetOpen(false);
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                className="hud-btn"
                id="btn-arena-toggle"
                onClick={() => {
                  handleSwitchArenaLive();
                  setMobileSheetOpen(false);
                }}
                title="Switch Arena World & Piece Skin (Gothic Cathedral / Robotics Workcell)"
              >
                <HudIcon name="arena" />
                <span>{ARENA_CATALOG[activeArenaId].shortName}</span>
              </button>

              <button
                type="button"
                className="hud-btn"
                id="btn-sound-toggle"
                onClick={() => controllerRef.current?.setSoundMuted(!(snapshot?.soundMuted ?? false))}
                title={snapshot?.soundMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
              >
                <HudIcon name={snapshot?.soundMuted ? 'soundOff' : 'soundOn'} />
                <span>{snapshot?.soundMuted ? 'Muted' : 'Audio'}</span>
              </button>

              <button
                type="button"
                className="hud-btn"
                id="btn-view-toggle"
                onClick={() => {
                  const nextPref: RendererPreference = show2DBoard ? 'auto' : '2d';
                  const updated = { ...settingsState, rendererPreference: nextPref };
                  saveSettings(updated);
                  setSettingsState(updated);
                  setDraftRenderer(nextPref);
                  setRendererPref(nextPref);
                  setMobileSheetOpen(false);
                }}
                title="Switch between 3D Arena and Classic 2D Board"
              >
                <HudIcon name="view" />
                <span>{show2DBoard ? '3D View' : '2D View'}</span>
              </button>

              <span className="hud-divider" aria-hidden="true"></span>

              <button
                type="button"
                className="hud-btn"
                id="btn-open-settings"
                onClick={() => {
                  setMobileSheetOpen(false);
                  setActiveModal('settings');
                }}
              >
                <HudIcon name="settings" />
                <span>Settings</span>
              </button>

              <button
                type="button"
                className="hud-btn"
                id="btn-open-history"
                onClick={() => {
                  setCompletedGames(loadGameHistory());
                  setMobileSheetOpen(false);
                  setActiveModal('history');
                }}
              >
                <HudIcon name="history" />
                <span>Archive</span>
              </button>

              <button
                type="button"
                className="hud-btn"
                id="btn-hide-ui"
                onClick={() => {
                  handleToggleUI();
                  setMobileSheetOpen(false);
                }}
                title="Toggle HUD visibility (Shortcut: H)"
              >
                <HudIcon name="hide" />
                <span>{uiHidden ? 'Show [H]' : 'Hide [H]'}</span>
              </button>

              <PWAInstallButton compact />

              {mcpEmbedded && (
                <button
                  type="button"
                  className="hud-btn primary"
                  onClick={() => {
                    const nextMode: McpDisplayMode = mcpDisplayMode === 'inline' ? 'fullscreen' : 'inline';
                    setMcpDisplayMode(nextMode);
                    requestMcpDisplayMode(nextMode);
                  }}
                >
                  {mcpDisplayMode === 'inline' ? 'Expand' : 'Compact'}
                </button>
              )}
            </div>
          </div>

          {/* MOVE HISTORY SIDEBAR */}
          <aside
            id="move-history-sidebar"
            className={`move-history-sidebar ${historyCollapsed ? 'collapsed' : ''}`}
            aria-label="Move History"
          >
            <div className="move-history-header">
              <button
                type="button"
                className="move-history-title-btn"
                id="btn-move-history-toggle"
                aria-expanded={!historyCollapsed}
                aria-controls="move-history-body"
                onClick={() => setHistoryCollapsed((prev) => !prev)}
              >
                <span className="move-history-title">Moves</span>
                <span className="move-history-count" id="move-history-count">
                  {snapshot?.moves.length ?? 0}
                </span>
                <span className="move-history-chevron" aria-hidden="true">
                  {historyCollapsed ? '▾' : '▴'}
                </span>
              </button>

              {!historyCollapsed && (
                <div className="move-history-header-actions">
                  <button
                    type="button"
                    className="move-history-copy-btn"
                    onClick={() => {
                      setImportText(snapshot?.pgn || snapshot?.fen || '');
                      setImportError(null);
                      setActiveModal('fenpgn');
                    }}
                    title="FEN / PGN Import & Export"
                  >
                    FEN/PGN
                  </button>
                  <button
                    type="button"
                    className="move-history-copy-btn"
                    id="btn-move-history-copy"
                    onClick={() => handleCopyText('pgn', snapshot?.pgn || '')}
                  >
                    {copiedFeedback === 'pgn' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </div>

            <div className="move-history-body" id="move-history-body">
              <div className="move-history-cols" aria-hidden="true">
                <span>#</span>
                <span>White</span>
                <span>Black</span>
              </div>

              <div className="move-history-list" id="move-history-list" ref={historyListRef} role="log">
                {moveRows.length === 0 ? (
                  <div className="move-history-empty">Awaiting opening move</div>
                ) : (
                  moveRows.map((row) => (
                    <div key={row.num} className="move-history-row">
                      <span className="move-num">{row.num}.</span>
                      {row.white ? (
                        <button
                          type="button"
                          className={`move-san-btn ${
                            snapshot?.selectedHistoryPly === row.white.ply ? 'selected' : ''
                          } ${row.white.ply === snapshot?.moves.length ? 'latest' : ''}`}
                          onClick={() => controllerRef.current?.highlightHistoryMove(row.white!.ply)}
                          onDoubleClick={() => controllerRef.current?.enterReplayAtPly(row.white!.ply)}
                          title={`Highlight ${row.white.fromSq}→${row.white.toSq} (Double-click to inspect position)`}
                        >
                          {row.white.san}
                        </button>
                      ) : (
                        <span className="move-san placeholder">...</span>
                      )}

                      {row.black ? (
                        <button
                          type="button"
                          className={`move-san-btn ${
                            snapshot?.selectedHistoryPly === row.black.ply ? 'selected' : ''
                          } ${row.black.ply === snapshot?.moves.length ? 'latest' : ''}`}
                          onClick={() => controllerRef.current?.highlightHistoryMove(row.black!.ply)}
                          onDoubleClick={() => controllerRef.current?.enterReplayAtPly(row.black!.ply)}
                          title={`Highlight ${row.black.fromSq}→${row.black.toSq} (Double-click to inspect position)`}
                        >
                          {row.black.san}
                        </button>
                      ) : (
                        <span className="move-san placeholder">...</span>
                      )}
                    </div>
                  ))
                )}
              </div>

              {(snapshot?.moves.length ?? 0) > 0 && (
                <div className="move-replay-controls">
                  <button
                    type="button"
                    className="replay-step-btn"
                    title="Start Position"
                    onClick={() => controllerRef.current?.enterReplayAtPly(0)}
                  >
                    |&lt;
                  </button>
                  <button
                    type="button"
                    className="replay-step-btn"
                    title="Previous Move"
                    onClick={() => controllerRef.current?.stepReplay(-1)}
                  >
                    &lt;
                  </button>
                  <button
                    type="button"
                    className="replay-step-btn"
                    title="Next Move"
                    onClick={() => controllerRef.current?.stepReplay(1)}
                  >
                    &gt;
                  </button>
                  <button
                    type="button"
                    className={`replay-step-btn ${snapshot?.isReplayMode ? 'active' : ''}`}
                    title="Return to Live Position"
                    onClick={() => controllerRef.current?.exitReplayToLive()}
                  >
                    Live
                  </button>
                </div>
              )}

              {!snapshot?.isGameOver && !snapshot?.isReplayMode && (
                <form
                  id="move-notation-form"
                  className="move-notation-form"
                  onSubmit={handleSubmitNotationMove}
                >
                  <input
                    id="input-move-notation"
                    type="text"
                    className={`move-notation-input ${moveNotationError ? 'invalid' : ''}`}
                    value={moveNotationInput}
                    onChange={(e) => {
                      setMoveNotationInput(e.target.value);
                      if (moveNotationError) setMoveNotationError(false);
                    }}
                    placeholder="Move: e4, Nf3, e2e4"
                    aria-label="Enter move in SAN or coordinate notation"
                  />
                  <button type="submit" className="replay-step-btn" id="btn-submit-notation">
                    Send
                  </button>
                </form>
              )}

              {snapshot?.isGameOver && (
                <div className="move-history-result" id="move-history-result">
                  {snapshot.result} • {snapshot.termination}
                </div>
              )}
            </div>
          </aside>

          {/* BOTTOM TELEMETRY STRIP (Controls Hint & Captured Material) */}
          <div id="hud-bottom">
            <div className="hint-pill" id="controls-hint">
              <strong>Controls:</strong> Click Piece • Drag Orbit • Right-Drag Pan • Scroll Zoom • WASD Fly • H Hide UI
            </div>

            {(capturedSummary.whiteGlyphs || capturedSummary.blackGlyphs) && (
              <div className="captured-pill" id="captured-tray">
                {capturedSummary.whiteGlyphs && (
                  <span className="captured-side">
                    <span className="captured-lbl">White</span>
                    <span className="captured-glyphs">{capturedSummary.whiteGlyphs}</span>
                    {capturedSummary.whiteLead > 0 && (
                      <span className="captured-adv">+{capturedSummary.whiteLead}</span>
                    )}
                  </span>
                )}
                {capturedSummary.blackGlyphs && (
                  <span className="captured-side">
                    <span className="captured-lbl">Black</span>
                    <span className="captured-glyphs">{capturedSummary.blackGlyphs}</span>
                    {capturedSummary.blackLead > 0 && (
                      <span className="captured-adv">+{capturedSummary.blackLead}</span>
                    )}
                  </span>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* PAWN PROMOTION PICKER */}
      {snapshot?.pendingPromotion && (
        <div className="modal-backdrop open" role="dialog" aria-modal="true" aria-label="Choose Pawn Promotion">
          <div className="sanctum-modal narrow">
            <div className="sanctum-modal-header">
              <h3>Promote Piece</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => controllerRef.current?.cancelPromotion()}
                aria-label="Cancel promotion"
              >
                ✕
              </button>
            </div>
            <div className="promotion-grid">
              {(
                [
                  ['q', 'Queen', snapshot.pendingPromotion.color === 'w' ? '♕' : '♛'],
                  ['r', 'Rook', snapshot.pendingPromotion.color === 'w' ? '♖' : '♜'],
                  ['b', 'Bishop', snapshot.pendingPromotion.color === 'w' ? '♗' : '♝'],
                  ['n', 'Knight', snapshot.pendingPromotion.color === 'w' ? '♘' : '♞'],
                ] as const
              ).map(([pieceChar, label, glyph]) => (
                <button
                  key={pieceChar}
                  type="button"
                  className="promotion-choice-btn"
                  onClick={() => controllerRef.current?.confirmPromotion(pieceChar)}
                >
                  <span className="promo-glyph">{glyph}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER BANNER */}
      <div
        id="checkmate-overlay"
        className={showGameOverBanner ? 'visible' : ''}
        role="status"
        aria-live="polite"
      >
        <div className="checkmate-banner">
          <div className="checkmate-ornament">
            ✦ &nbsp; {activeArenaId === 'robotics' ? 'Workcell Match Complete' : 'Sanctum Judgment'} &nbsp; ✦
          </div>
          <div className="checkmate-crown" id="checkmate-crown">
            {snapshot?.winner === 'b' ? '♚' : snapshot?.winner === 'w' ? '♔' : '⚖'}
          </div>
          <div className="checkmate-title" id="checkmate-title">
            {snapshot?.isCheckmate
              ? 'Checkmate'
              : snapshot?.winner
              ? 'Victory'
              : 'Draw'}
          </div>
          <div className="checkmate-rule"></div>
          <div className="checkmate-subtitle" id="checkmate-subtitle">
            {snapshot?.winner
              ? `${snapshot.winner === 'w' ? 'White' : 'Black'} Wins • ${snapshot.termination || 'Victory'}`
              : snapshot?.termination || 'Drawn Match'}
          </div>
          <div className="checkmate-actions">
            <button
              type="button"
              className="checkmate-btn"
              onClick={() => {
                setGameOverDismissedForId(null);
                controllerRef.current?.resetChessBoard(true);
              }}
            >
              Play Again
            </button>
            <button
              type="button"
              className="checkmate-btn"
              onClick={() => {
                if (snapshot) {
                  setGameOverDismissedForId(snapshot.gameId);
                  controllerRef.current?.enterReplayAtPly(snapshot.moves.length > 0 ? 1 : 0);
                }
              }}
            >
              Replay Moves
            </button>
            {snapshot?.isCheckmate && !show2DBoard && (
              <button
                type="button"
                className="checkmate-btn"
                onClick={() => {
                  const win = window as unknown as {
                    wizardChess?: { triggerCheckmateSequence?: (d?: string, w?: string) => void };
                  };
                  const defeated = snapshot.turn;
                  const winner = snapshot.winner || (defeated === 'w' ? 'b' : 'w');
                  win.wizardChess?.triggerCheckmateSequence?.(defeated, winner);
                }}
              >
                Replay King Fall
              </button>
            )}
            <button
              type="button"
              className="checkmate-btn secondary"
              onClick={() => snapshot && setGameOverDismissedForId(snapshot.gameId)}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>

      {/* SETTINGS MODAL */}
      {activeModal === 'settings' && (
        <div className="modal-backdrop open" role="dialog" aria-modal="true" aria-label="Game Settings">
          <div className="sanctum-modal">
            <div className="sanctum-modal-header">
              <h3>Arena &amp; Game Settings</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActiveModal('none')}
                aria-label="Close settings"
              >
                ✕
              </button>
            </div>

            <div className="modal-form-grid">
              <div className="setup-field">
                <label className="setup-label">3D Arena World</label>
                <div className="segmented-row">
                  {(['cathedral', 'robotics'] as ArenaId[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={`seg-btn ${draftArena === id ? 'active' : ''}`}
                      onClick={() => setDraftArena(id)}
                    >
                      {ARENA_CATALOG[id].name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setup-field">
                <label className="setup-label">Mode</label>
                <div className="segmented-row">
                  <button
                    type="button"
                    className={`seg-btn ${draftPlayMode === 'ai' ? 'active' : ''}`}
                    onClick={() => setDraftPlayMode('ai')}
                  >
                    vs AI
                  </button>
                  <button
                    type="button"
                    className={`seg-btn ${draftPlayMode === 'local' ? 'active' : ''}`}
                    onClick={() => setDraftPlayMode('local')}
                  >
                    Local 2P
                  </button>
                </div>
              </div>

              <div className="setup-field">
                <label className="setup-label">AI Difficulty</label>
                <div className="segmented-row triple">
                  {(['novice', 'club', 'master'] as AIDifficulty[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`seg-btn ${draftDifficulty === d ? 'active' : ''}`}
                      onClick={() => setDraftDifficulty(d)}
                    >
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setup-field">
                <label className="setup-label">Graphics Quality</label>
                <div className="segmented-row triple">
                  {(['low', 'medium', 'high'] as GraphicsQuality[]).map((q) => (
                    <button
                      key={q}
                      type="button"
                      className={`seg-btn ${draftQuality === q ? 'active' : ''}`}
                      onClick={() => setDraftQuality(q)}
                    >
                      {q.charAt(0).toUpperCase() + q.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setup-field">
                <label className="setup-label">Reduced Motion</label>
                <div className="segmented-row triple">
                  {(['system', 'on', 'off'] as ReducedMotionSetting[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`seg-btn ${draftMotion === m ? 'active' : ''}`}
                      onClick={() => setDraftMotion(m)}
                    >
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setup-field">
                <label className="setup-label">Board View</label>
                <div className="segmented-row">
                  <button
                    type="button"
                    className={`seg-btn ${draftRenderer === 'auto' ? 'active' : ''}`}
                    onClick={() => setDraftRenderer('auto')}
                  >
                    3D Arena (WebGL)
                  </button>
                  <button
                    type="button"
                    className={`seg-btn ${draftRenderer === '2d' ? 'active' : ''}`}
                    onClick={() => setDraftRenderer('2d')}
                  >
                    2D Classic Board
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-footer-actions">
              <button
                type="button"
                className="sanctum-secondary-btn"
                onClick={handleApplyLiveSettings}
              >
                Apply to Current Game
              </button>
              <button
                type="button"
                className="sanctum-primary-btn"
                onClick={() => startFreshMatch()}
              >
                Apply &amp; New Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAME HISTORY MODAL */}
      {activeModal === 'history' && (
        <div className="modal-backdrop open" role="dialog" aria-modal="true" aria-label="Completed Games Archive">
          <div className="sanctum-modal">
            <div className="sanctum-modal-header">
              <h3>Saved Game Archive</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActiveModal('none')}
                aria-label="Close history"
              >
                ✕
              </button>
            </div>

            {completedGames.length === 0 ? (
              <p className="modal-empty">No completed games archived yet. Finish or resign a match to save it here.</p>
            ) : (
              <div className="history-archive-list">
                {completedGames.map((rec) => (
                  <div key={rec.id} className="history-archive-item">
                    <div className="history-archive-meta">
                      <strong>{rec.result} — {rec.termination}</strong>
                      <span>
                        {new Date(rec.dateIso).toLocaleDateString()} • {rec.moveCount} plies •{' '}
                        {rec.playMode === 'ai' ? `vs AI (${rec.difficulty})` : 'Local 2P'}
                      </span>
                    </div>
                    <div className="history-archive-btns">
                      <button
                        type="button"
                        className="hud-btn primary"
                        onClick={() => {
                          setActiveModal('none');
                          setScreen('game');
                          controllerRef.current?.loadCompletedGameReplay(rec);
                        }}
                      >
                        Replay
                      </button>
                      <button
                        type="button"
                        className="hud-btn"
                        onClick={() => handleCopyText('pgn', rec.pgn)}
                      >
                        PGN
                      </button>
                      <button
                        type="button"
                        className="hud-btn"
                        onClick={() => setCompletedGames(deleteGameHistoryRecord(rec.id))}
                        aria-label="Delete game record"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {completedGames.length > 0 && (
              <div className="modal-footer-actions">
                <button
                  type="button"
                  className="sanctum-secondary-btn"
                  onClick={() => {
                    clearGameHistory();
                    setCompletedGames([]);
                  }}
                >
                  Clear All History
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FEN / PGN IMPORT & EXPORT MODAL */}
      {activeModal === 'fenpgn' && (
        <div className="modal-backdrop open" role="dialog" aria-modal="true" aria-label="FEN and PGN Import/Export">
          <div className="sanctum-modal">
            <div className="sanctum-modal-header">
              <h3>FEN / PGN Position Tools</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActiveModal('none')}
                aria-label="Close FEN/PGN tools"
              >
                ✕
              </button>
            </div>

            <div className="setup-field">
              <label className="setup-label">Current FEN</label>
              <div className="copy-line">
                <input type="text" readOnly value={snapshot?.fen || ''} className="sanctum-input" />
                <button
                  type="button"
                  className="hud-btn"
                  onClick={() => handleCopyText('fen', snapshot?.fen || '')}
                >
                  {copiedFeedback === 'fen' ? 'Copied' : 'Copy FEN'}
                </button>
              </div>
            </div>

            <div className="setup-field">
              <label className="setup-label">Paste FEN or PGN to Load</label>
              <textarea
                rows={4}
                className="sanctum-textarea"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste a FEN string or PGN notation (e.g. 1. e4 e5 2. Nf3 Nc6)..."
              />
              {importError && <div className="import-error">{importError}</div>}
            </div>

            <div className="modal-footer-actions">
              <button
                type="button"
                className="sanctum-secondary-btn"
                onClick={() => handleCopyText('pgn', snapshot?.pgn || '')}
              >
                {copiedFeedback === 'pgn' ? 'Copied PGN' : 'Copy Current PGN'}
              </button>
              <button
                type="button"
                className="sanctum-primary-btn"
                onClick={handleImportPosition}
              >
                Load Position
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
