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

export default function App() {
  const controllerRef = useRef<WizardChessController | null>(null);
  const statusPillRef = useRef<HTMLDivElement | null>(null);
  const historyListRef = useRef<HTMLDivElement | null>(null);

  const initialSettings = useMemo<GameSettings>(() => loadSettings(), []);
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
  const [uiHidden, setUiHidden] = useState(false);

  // Quick setup draft inside Opening Screen / Settings modal
  const [draftPlayMode, setDraftPlayMode] = useState<PlayMode>(initialSettings.playMode);
  const [draftColor, setDraftColor] = useState<PlayerColor>(initialSettings.playerColor);
  const [draftDifficulty, setDraftDifficulty] = useState<AIDifficulty>(initialSettings.difficulty);
  const [draftClock, setDraftClock] = useState<ClockPresetId>(initialSettings.clockPreset);
  const [draftDirection, setDraftDirection] = useState<ClockDirection>(initialSettings.clockDirection);
  const [draftQuality, setDraftQuality] = useState<GraphicsQuality>(initialSettings.graphicsQuality);
  const [draftMotion, setDraftMotion] = useState<ReducedMotionSetting>(initialSettings.reducedMotion);
  const [draftRenderer, setDraftRenderer] = useState<RendererPreference>(initialSettings.rendererPreference);

  const lastSyncedFenRef = useRef<string>('');

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
      if (clockMenuOpen && statusPillRef.current && !statusPillRef.current.contains(e.target as Node)) {
        setClockMenuOpen(false);
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
  }, [clockMenuOpen, screen, activeModal]);

  // Auto-scroll Move History list
  useEffect(() => {
    if (historyListRef.current && !snapshot?.isReplayMode) {
      historyListRef.current.scrollTop = historyListRef.current.scrollHeight;
    }
  }, [snapshot?.moves.length, snapshot?.isReplayMode]);

  const startFreshMatch = useCallback(
    (overrides?: Partial<GameSettings>) => {
      const merged: GameSettings = {
        ...DEFAULT_SETTINGS,
        ...settingsState,
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

  const handleToggleUI = useCallback(
    (force?: boolean) => {
      const next = controllerRef.current?.toggleUI(force);
      if (typeof next === 'boolean') setUiHidden(next);
    },
    []
  );

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
    if (!snapshot) return 'Summoning Sanctum...';
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
      return `${snapshot.turn === 'w' ? 'White' : 'Black'} (AI Thinking...)`;
    }
    const base = snapshot.turn === 'w' ? 'White to Move' : 'Black to Move';
    return snapshot.inCheck ? `${base} (Check!)` : base;
  }, [snapshot]);

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

  const whiteCapturedGlyphs = (snapshot?.captured.byWhite || [])
    .map((p) => PIECE_GLYPHS[p] || '')
    .join('');
  const blackCapturedGlyphs = (snapshot?.captured.byBlack || [])
    .map((p) => PIECE_GLYPHS[p] || '')
    .join('');

  return (
    <div className={mcpDisplayMode === 'inline' ? 'mcp-inline-shell' : ''}>
      <OfflineIndicator />

      {!show2DBoard && (
        <div id="loading-overlay">
          <div className="loader-title">Wizard Chess 3D</div>
          <div className="loader-bar-wrap">
            <div className="loader-bar" id="loader-bar"></div>
          </div>
          <div id="loader-text">Summoning Sanctum Architecture &amp; Sculpted Pieces...</div>
        </div>
      )}

      {/* 3D Cathedral Canvas (or 2D Fallback Board when WebGL is unavailable / 2D chosen) */}
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
        />
      )}

      {/* OPENING SCREEN (Shown before entering game) */}
      {screen === 'home' && mcpDisplayMode !== 'inline' && (
        <main className="home-overlay" role="main" aria-label="Wizard Chess 3D Title Screen">
          <section className="home-card">
            <div className="home-publisher-row">
              <span className="home-publisher-badge">InnerAnimalMedia • Entertainment</span>
              <span className="home-version-tag">v1.0.0</span>
            </div>
            <h1 className="home-title">Wizard Chess 3D</h1>
            <p className="home-subtitle">
              Gothic cathedral arena with FIDE rules, melee stone captures, chess clocks, offline AI, and full PGN/FEN replay.
            </p>

            <div className="home-setup-grid">
              <div className="setup-field">
                <label className="setup-label">Game Mode</label>
                <div className="segmented-row">
                  <button
                    type="button"
                    className={`seg-btn ${draftPlayMode === 'ai' ? 'active' : ''}`}
                    onClick={() => setDraftPlayMode('ai')}
                  >
                    vs Computer
                  </button>
                  <button
                    type="button"
                    className={`seg-btn ${draftPlayMode === 'local' ? 'active' : ''}`}
                    onClick={() => setDraftPlayMode('local')}
                  >
                    Local 2-Player
                  </button>
                </div>
              </div>

              {draftPlayMode === 'ai' && (
                <>
                  <div className="setup-field">
                    <label className="setup-label">Play As</label>
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
                </>
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
                Play New Match
              </button>

              {savedActiveGame && (
                <button
                  type="button"
                  id="btn-home-continue"
                  className="sanctum-secondary-btn large"
                  onClick={handleContinueSavedGame}
                >
                  Continue Saved Match ({savedActiveGame.moves.length} moves)
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
                Game History ({completedGames.length})
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
                Load FEN / PGN
              </button>
              <PWAInstallButton />
            </div>
          </section>
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
                  title="Return to Opening Screen"
                >
                  <span className="brand-title">Wizard Chess</span>
                  <span className="brand-sub">Menu</span>
                </button>
              )}

              <div className="status-pill" id="status-pill" ref={statusPillRef}>
                <span
                  className={`turn-dot ${snapshot?.turn === 'b' ? 'black' : ''}`}
                  id="turn-dot"
                ></span>
                <span id="turn-text">{turnStatusLabel}</span>
                <span className="mode-badge" id="mode-badge">
                  {snapshot?.playMode === 'local'
                    ? 'Local 2P'
                    : `vs AI (${(snapshot?.difficulty || 'club').toUpperCase()})`}
                </span>

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
                    <span className="clock-popover-title">Chess Clock</span>
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

            <div
              className={`hud-group ${mobileSheetOpen ? 'mobile-sheet-open' : ''}`}
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
                <span className="mobile-sheet-title">Game Controls</span>
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
                Undo
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
                  Claim Draw
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
                  Resign
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
                New Game
              </button>

              {!show2DBoard && (
                <div className="camera-menu-wrap">
                  <button
                    type="button"
                    className={`hud-btn ${cameraMenuOpen ? 'active' : ''}`}
                    id="btn-camera-menu"
                    onClick={() => setCameraMenuOpen((prev) => !prev)}
                  >
                    Camera Views ▾
                  </button>
                  {cameraMenuOpen && (
                    <div className="camera-popover" role="menu" aria-label="Camera Presets">
                      {[
                        ['player', 'Player View'],
                        ['opponent', 'Opponent View'],
                        ['top', 'Overhead View'],
                        ['side', 'Side Profile'],
                        ['wide', 'Cathedral Wide'],
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
                id="btn-sound-toggle"
                onClick={() => controllerRef.current?.setSoundMuted(!(snapshot?.soundMuted ?? false))}
                title={snapshot?.soundMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
              >
                {snapshot?.soundMuted ? 'Muted' : 'Sound On'}
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
                title="Switch between 3D Cathedral and Classic 2D Board"
              >
                {show2DBoard ? '3D View' : '2D Board'}
              </button>

              <button
                type="button"
                className="hud-btn"
                id="btn-open-settings"
                onClick={() => {
                  setMobileSheetOpen(false);
                  setActiveModal('settings');
                }}
              >
                Settings
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
                History
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
                {uiHidden ? 'Show UI [H]' : 'Hide UI [H]'}
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
                  {mcpDisplayMode === 'inline' ? 'Expand Fullscreen' : 'Compact View'}
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
                  <div className="move-history-empty">No moves played yet</div>
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

              {snapshot?.isGameOver && (
                <div className="move-history-result" id="move-history-result">
                  {snapshot.result} • {snapshot.termination}
                </div>
              )}
            </div>
          </aside>

          {/* BOTTOM HUD */}
          <div id="hud-bottom">
            <div className="hint-pill" id="controls-hint">
              <strong>Controls:</strong> Click Piece to Move • Drag: Orbit • Right-Drag: Pan • Scroll: Zoom • WASD: Fly • H: Hide UI
            </div>

            {(whiteCapturedGlyphs || blackCapturedGlyphs) && (
              <div className="captured-pill" id="captured-tray">
                {whiteCapturedGlyphs && <span>White took: {whiteCapturedGlyphs}</span>}
                {blackCapturedGlyphs && <span>Black took: {blackCapturedGlyphs}</span>}
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
              <h3>Promote Pawn</h3>
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
          <div className="checkmate-ornament">✦ &nbsp; Sanctum Judgment &nbsp; ✦</div>
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
              <h3>Sanctum Settings</h3>
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
                    3D Cathedral (WebGL)
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
              <h3>Saved Game History</h3>
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
