import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyDraughtsMove,
  chooseDraughtsAIMove,
  coordToWcdf,
  countDraughtsMaterial,
  createInitialDraughtsBoard,
  createInitialDraughtsState,
  getLegalDraughtsMoves,
  isPlayableDarkSquare,
  serializeDraughtsBoard,
  type DraughtsColor,
  type DraughtsCoord,
  type DraughtsDifficulty,
  type DraughtsGameState,
  type DraughtsMove,
} from '../games/draughtsEngine';
import { playTabletopSound } from '../games/arcadeAudio';
import { recordArcadeMatch } from '../games/arcadeStats';
import { buildArcadeGameD1Bundle, buildD1UpsertSql } from '../integrations/entertainment/d1Schema';

interface CrownDraughtsGameProps {
  onBackToArcade: () => void;
  onSwitchGame: (target: 'chess' | 'reversi') => void;
}

export function CrownDraughtsGame({ onBackToArcade, onSwitchGame }: CrownDraughtsGameProps) {
  const [playMode, setPlayMode] = useState<'ai' | 'local'>('ai');
  const [humanColor, setHumanColor] = useState<DraughtsColor>('w');
  const [difficulty, setDifficulty] = useState<DraughtsDifficulty>('club');
  const [boardSkin, setBoardSkin] = useState<'sanctum' | 'orbital'>('sanctum');
  const [soundMuted, setSoundMuted] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const [historyStack, setHistoryStack] = useState<DraughtsGameState[]>(() => [
    createInitialDraughtsState(),
  ]);
  const [selectedSq, setSelectedSq] = useState<DraughtsCoord | null>(null);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const recordedGameIdsRef = useRef<Set<string>>(new Set());

  const currentState = historyStack[historyStack.length - 1];
  const flipped = playMode === 'ai' && humanColor === 'b';

  const legalMoves = useMemo(
    () => (currentState.isGameOver ? [] : getLegalDraughtsMoves(currentState.board, currentState.turn)),
    [currentState.board, currentState.turn, currentState.isGameOver]
  );

  const hasMandatoryCapture = useMemo(
    () => legalMoves.some((m) => m.captures.length > 0),
    [legalMoves]
  );

  const movableOrigins = useMemo(() => {
    const keys = new Set<string>();
    for (const m of legalMoves) {
      keys.add(`${m.from.r},${m.from.c}`);
    }
    return keys;
  }, [legalMoves]);

  const selectedMoves = useMemo(() => {
    if (!selectedSq) return [];
    return legalMoves.filter(
      (m) => m.from.r === selectedSq.r && m.from.c === selectedSq.c
    );
  }, [legalMoves, selectedSq]);

  const counts = useMemo(() => countDraughtsMaterial(currentState.board), [currentState.board]);

  const commitMove = useCallback(
    (move: DraughtsMove) => {
      setHistoryStack((prev) => {
        const latest = prev[prev.length - 1];
        const next = applyDraughtsMove(latest, move);
        if (next.isGameOver) {
          playTabletopSound('victory', soundMuted);
        } else if (move.crowns) {
          playTabletopSound('crown', soundMuted);
        } else if (move.captures.length > 0) {
          playTabletopSound('capture', soundMuted);
        } else {
          playTabletopSound('move', soundMuted);
        }
        return [...prev, next];
      });
      setSelectedSq(null);
    },
    [soundMuted]
  );

  // Record finished game to unified entertainment ledger once
  useEffect(() => {
    if (!currentState.isGameOver || recordedGameIdsRef.current.has(currentState.id)) return;
    recordedGameIdsRef.current.add(currentState.id);
    const winnerLabel =
      currentState.winner === 'w'
        ? 'Brass Won'
        : currentState.winner === 'b'
        ? 'Basalt Won'
        : 'Draw';
    recordArcadeMatch({
      gameType: 'checkers',
      gameTitle: 'Crown Draughts',
      winnerLabel,
      summary: `${winnerLabel} · ${currentState.reason || 'Completed'}`,
      moveCount: currentState.moves.length,
      modeLabel: playMode === 'ai' ? `vs AI (${difficulty})` : 'Local 2P',
    });
  }, [currentState, playMode, difficulty]);

  // Deterministic offline AI turn handler with clean cancellation on reset/unmount
  useEffect(() => {
    if (playMode !== 'ai' || currentState.isGameOver || currentState.turn === humanColor) {
      setIsAIThinking(false);
      return;
    }

    setIsAIThinking(true);
    const timer = window.setTimeout(() => {
      const chosen = chooseDraughtsAIMove(currentState, difficulty);
      setIsAIThinking(false);
      if (chosen) {
        commitMove(chosen);
      }
    }, 460);

    return () => {
      window.clearTimeout(timer);
    };
  }, [playMode, humanColor, difficulty, currentState, commitMove]);

  const handleStartNewGame = useCallback(
    (overrides?: { mode?: 'ai' | 'local'; side?: DraughtsColor; diff?: DraughtsDifficulty }) => {
      if (overrides?.mode) setPlayMode(overrides.mode);
      if (overrides?.side) setHumanColor(overrides.side);
      if (overrides?.diff) setDifficulty(overrides.diff);
      setIsAIThinking(false);
      setSelectedSq(null);
      setHistoryStack([createInitialDraughtsState()]);
    },
    []
  );

  const handleUndo = useCallback(() => {
    if (historyStack.length <= 1 || isAIThinking) return;
    setSelectedSq(null);
    setHistoryStack((prev) => {
      if (playMode === 'ai' && prev.length >= 3) {
        return prev.slice(0, prev.length - 2);
      }
      return prev.slice(0, prev.length - 1);
    });
  }, [historyStack.length, isAIThinking, playMode]);

  const handleSquareClick = useCallback(
    (r: number, c: number) => {
      if (currentState.isGameOver || isAIThinking) return;
      if (playMode === 'ai' && currentState.turn !== humanColor) return;
      if (!isPlayableDarkSquare(r, c)) return;

      // Check if clicking a destination of the currently selected piece
      if (selectedSq) {
        const matchingDest = selectedMoves.filter((m) => m.to.r === r && m.to.c === c);
        if (matchingDest.length > 0) {
          // Prefer maximum captures if multiple paths reach the same destination
          matchingDest.sort((a, b) => b.captures.length - a.captures.length);
          commitMove(matchingDest[0]);
          return;
        }
      }

      const occupant = currentState.board[r][c];
      if (occupant && occupant.color === currentState.turn) {
        if (movableOrigins.has(`${r},${c}`)) {
          setSelectedSq((prev) => (prev && prev.r === r && prev.c === c ? null : { r, c }));
        } else {
          setSelectedSq(null);
        }
      } else {
        setSelectedSq(null);
      }
    },
    [
      currentState,
      isAIThinking,
      playMode,
      humanColor,
      selectedSq,
      selectedMoves,
      movableOrigins,
      commitMove,
    ]
  );

  const handleCopyD1Sql = useCallback(() => {
    const initialSnap = serializeDraughtsBoard(createInitialDraughtsBoard(), 'w');
    const currentSnap = serializeDraughtsBoard(currentState.board, currentState.turn);
    const bundle = buildArcadeGameD1Bundle({
      gameId: currentState.id,
      gameType: 'checkers',
      status: currentState.isGameOver
        ? 'completed'
        : currentState.moves.length > 0
        ? 'active'
        : 'waiting',
      turn: currentState.turn === 'w' ? 'white' : 'black',
      winner:
        currentState.winner === 'w'
          ? 'white'
          : currentState.winner === 'b'
          ? 'black'
          : currentState.winner === 'draw'
          ? 'draw'
          : null,
      resultReason: currentState.reason,
      pieceSet: boardSkin === 'orbital' ? 'orbital_draughts_v1' : 'sanctum_brass_v1',
      initialState: initialSnap,
      currentState: currentSnap,
      whiteDisplayName:
        playMode === 'local'
          ? 'Player 1 (Brass)'
          : humanColor === 'w'
          ? 'Player (Brass)'
          : `Draughts AI (${difficulty})`,
      blackDisplayName:
        playMode === 'local'
          ? 'Player 2 (Basalt)'
          : humanColor === 'b'
          ? 'Player (Basalt)'
          : `Draughts AI (${difficulty})`,
      moves: currentState.moves.map((m) => ({
        ply: m.ply,
        moveNumber: m.moveNumber,
        color: m.color === 'w' ? 'white' : 'black',
        fromSquare: String(m.fromSq),
        toSquare: String(m.toSq),
        piece: m.crowned ? 'king' : 'man',
        notation: m.notation,
        capturedPiece: m.capturedCount > 0 ? `${m.capturedCount}x` : null,
        promotion: m.crowned ? 'king' : null,
        boardAfter: m.boardSnapshot,
      })),
      metadata: { playMode, difficulty, boardSkin },
    });

    const sql = buildD1UpsertSql(bundle);
    navigator.clipboard?.writeText(sql).catch(() => {});
    setCopiedSql(true);
    window.setTimeout(() => setCopiedSql(false), 1600);
  }, [currentState, boardSkin, playMode, humanColor, difficulty]);

  const movePairs = useMemo(() => {
    const rows: { num: number; white?: string; black?: string }[] = [];
    for (let i = 0; i < currentState.moves.length; i += 2) {
      rows.push({
        num: Math.floor(i / 2) + 1,
        white: currentState.moves[i]?.notation,
        black: currentState.moves[i + 1]?.notation,
      });
    }
    return rows;
  }, [currentState.moves]);

  const indices = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  const statusText = useMemo(() => {
    if (currentState.isGameOver) {
      if (currentState.winner === 'w') return `Brass Wins · ${currentState.reason}`;
      if (currentState.winner === 'b') return `Basalt Wins · ${currentState.reason}`;
      return `Draw · ${currentState.reason}`;
    }
    if (isAIThinking) {
      return `${currentState.turn === 'w' ? 'Brass' : 'Basalt'} (AI Calculating...)`;
    }
    const base = currentState.turn === 'w' ? 'Brass to Move' : 'Basalt to Move';
    return hasMandatoryCapture ? `${base} · Jump Required` : base;
  }, [currentState, isAIThinking, hasMandatoryCapture]);

  return (
    <div
      className={`arcade-scroll-viewport standalone-game-shell skin-${boardSkin}`}
      id="draughts-game-view"
    >
      <header className="standalone-topbar">
        <div className="standalone-topbar-left">
          <button
            type="button"
            id="btn-draughts-back"
            className="hud-btn"
            onClick={onBackToArcade}
          >
            ← All Games
          </button>
          <div className="standalone-title-wrap">
            <h1 className="standalone-title">Crown Draughts</h1>
            <span className="standalone-meta">American Checkers · WCDF 1–32</span>
          </div>
        </div>

        <div className="standalone-status-readout" id="draughts-status" role="status" aria-live="polite">
          {statusText}
        </div>

        <div className="standalone-topbar-actions">
          <button
            type="button"
            className="hud-btn"
            onClick={() => setSoundMuted((m) => !m)}
          >
            {soundMuted ? 'Unmute' : 'Mute Audio'}
          </button>
          <button
            type="button"
            id="btn-draughts-copy-d1"
            className="hud-btn"
            onClick={handleCopyD1Sql}
          >
            {copiedSql ? 'Copied D1 SQL' : 'Copy D1 SQL'}
          </button>
          <button
            type="button"
            id="btn-draughts-new"
            className="sanctum-primary-btn"
            onClick={() => handleStartNewGame()}
          >
            New Game
          </button>
        </div>
      </header>

      <main className="standalone-main-grid">
        <section className="standalone-board-stage" aria-label="Crown Draughts 8 by 8 Board">
          <div className="draughts-score-strip">
            <div className={`draughts-side-stat ${currentState.turn === 'w' && !currentState.isGameOver ? 'active-turn' : ''}`}>
              <span className="disc-swatch brass" aria-hidden="true" />
              <span className="side-stat-name">Brass</span>
              <span className="side-stat-nums">
                {counts.whiteTotal} pcs ({counts.whiteKings} Kings)
              </span>
            </div>
            <div className={`draughts-side-stat ${currentState.turn === 'b' && !currentState.isGameOver ? 'active-turn' : ''}`}>
              <span className="disc-swatch basalt" aria-hidden="true" />
              <span className="side-stat-name">Basalt</span>
              <span className="side-stat-nums">
                {counts.blackTotal} pcs ({counts.blackKings} Kings)
              </span>
            </div>
          </div>

          <div className="draughts-board-frame">
            <div className="draughts-grid" role="grid" aria-label="Draughts Board">
              {indices.map((r) =>
                indices.map((c) => {
                  const dark = isPlayableDarkSquare(r, c);
                  const wcdfNum = coordToWcdf(r, c);
                  const piece = currentState.board[r][c];
                  const isSelected = selectedSq?.r === r && selectedSq?.c === c;
                  const destMove = selectedMoves.find((m) => m.to.r === r && m.to.c === c);
                  const isIntermediateHop = selectedMoves.some((m) =>
                    m.path.slice(0, -1).some((p) => p.r === r && p.c === c)
                  );
                  const isForcedOrigin =
                    hasMandatoryCapture &&
                    !selectedSq &&
                    piece?.color === currentState.turn &&
                    movableOrigins.has(`${r},${c}`);
                  const isLastFrom =
                    currentState.lastMove?.from.r === r && currentState.lastMove?.from.c === c;
                  const isLastTo =
                    currentState.lastMove?.to.r === r && currentState.lastMove?.to.c === c;

                  return (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      id={dark ? `draughts-sq-${wcdfNum}` : undefined}
                      disabled={!dark}
                      onClick={() => handleSquareClick(r, c)}
                      className={[
                        'draughts-cell',
                        dark ? 'dark-playable' : 'light-nonplayable',
                        isSelected ? 'selected' : '',
                        destMove ? 'legal-target' : '',
                        isIntermediateHop ? 'intermediate-hop' : '',
                        isForcedOrigin ? 'forced-origin' : '',
                        isLastFrom || isLastTo ? 'last-move' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      aria-label={
                        dark
                          ? `Square ${wcdfNum}${
                              piece
                                ? `, ${piece.color === 'w' ? 'Brass' : 'Basalt'} ${
                                    piece.isKing ? 'King' : 'Piece'
                                  }`
                                : destMove
                                ? ', Legal destination'
                                : ''
                            }`
                          : 'Light square'
                      }
                    >
                      {dark && <span className="wcdf-num">{wcdfNum}</span>}

                      {piece && (
                        <span
                          className={`draughts-checker ${
                            piece.color === 'w' ? 'brass' : 'basalt'
                          } ${piece.isKing ? 'crowned' : ''}`}
                        >
                          {piece.isKing && (
                            <svg
                              className="checker-crown-svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              aria-hidden="true"
                            >
                              <path
                                d="M4 17L6 8L10.2 12L12 6.5L13.8 12L18 8L20 17H4Z"
                                stroke="currentColor"
                                strokeWidth="1.9"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </span>
                      )}

                      {destMove && (
                        <span className="draughts-target-ring">
                          {destMove.captures.length > 1 ? `×${destMove.captures.length}` : ''}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {currentState.isGameOver && (
              <div className="standalone-gameover-card" role="dialog" aria-label="Match Result">
                <div className="gameover-kicker">Match Complete</div>
                <h2 className="gameover-heading">
                  {currentState.winner === 'w'
                    ? 'Brass Victory'
                    : currentState.winner === 'b'
                    ? 'Basalt Victory'
                    : 'Drawn Match'}
                </h2>
                <p className="gameover-reason">{currentState.reason}</p>
                <div className="gameover-actions">
                  <button
                    type="button"
                    className="sanctum-primary-btn"
                    onClick={() => handleStartNewGame()}
                  >
                    Play Again
                  </button>
                  <button type="button" className="hud-btn" onClick={onBackToArcade}>
                    All Games
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="standalone-sidebar" aria-label="Game Setup and Move Log">
          <div className="sidebar-section">
            <h2 className="sidebar-heading">Match Configuration</h2>

            <div className="setup-field">
              <label className="setup-label">Opponent</label>
              <div className="segmented-row">
                <button
                  type="button"
                  className={`seg-btn ${playMode === 'ai' ? 'active' : ''}`}
                  onClick={() => handleStartNewGame({ mode: 'ai' })}
                >
                  vs Computer
                </button>
                <button
                  type="button"
                  className={`seg-btn ${playMode === 'local' ? 'active' : ''}`}
                  onClick={() => handleStartNewGame({ mode: 'local' })}
                >
                  Local 2P
                </button>
              </div>
            </div>

            {playMode === 'ai' && (
              <>
                <div className="setup-field">
                  <label className="setup-label">Your Pieces</label>
                  <div className="segmented-row">
                    <button
                      type="button"
                      className={`seg-btn ${humanColor === 'w' ? 'active' : ''}`}
                      onClick={() => handleStartNewGame({ side: 'w' })}
                    >
                      Brass (First)
                    </button>
                    <button
                      type="button"
                      className={`seg-btn ${humanColor === 'b' ? 'active' : ''}`}
                      onClick={() => handleStartNewGame({ side: 'b' })}
                    >
                      Basalt
                    </button>
                  </div>
                </div>

                <div className="setup-field">
                  <label className="setup-label">AI Depth</label>
                  <div className="segmented-row triple">
                    {(['novice', 'club', 'master'] as DraughtsDifficulty[]).map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={`seg-btn ${difficulty === d ? 'active' : ''}`}
                        onClick={() => setDifficulty(d)}
                      >
                        {d.charAt(0).toUpperCase() + d.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="setup-field">
              <label className="setup-label">Board Finish</label>
              <div className="segmented-row">
                <button
                  type="button"
                  className={`seg-btn ${boardSkin === 'sanctum' ? 'active' : ''}`}
                  onClick={() => setBoardSkin('sanctum')}
                >
                  Sanctum Walnut
                </button>
                <button
                  type="button"
                  className={`seg-btn ${boardSkin === 'orbital' ? 'active' : ''}`}
                  onClick={() => setBoardSkin('orbital')}
                >
                  Orbital Slate
                </button>
              </div>
            </div>

            <div className="standalone-quick-row">
              <button
                type="button"
                id="btn-draughts-undo"
                className="hud-btn"
                disabled={historyStack.length <= 1 || isAIThinking}
                onClick={handleUndo}
              >
                Undo Move
              </button>
              <button
                type="button"
                className="hud-btn"
                onClick={() => handleStartNewGame()}
              >
                Reset Board
              </button>
            </div>
          </div>

          <div className="sidebar-section grow">
            <div className="sidebar-header-inline">
              <h2 className="sidebar-heading">WCDF Move Log</h2>
              <span className="sidebar-ply-count">{currentState.moves.length} plies</span>
            </div>
            <div className="standalone-move-log">
              {movePairs.length === 0 ? (
                <p className="standalone-log-empty">
                  Select any highlighted Brass piece on squares 21–24 to open. Jumps are mandatory.
                </p>
              ) : (
                movePairs.map((row) => (
                  <div key={row.num} className="standalone-move-row">
                    <span className="m-num">{row.num}.</span>
                    <span className="m-san">{row.white || ''}</span>
                    <span className="m-san">{row.black || '...'}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="sidebar-section">
            <h2 className="sidebar-heading">Switch Title</h2>
            <div className="standalone-quick-row">
              <button type="button" className="hud-btn" onClick={() => onSwitchGame('chess')}>
                Wizard Chess 3D
              </button>
              <button type="button" className="hud-btn" onClick={() => onSwitchGame('reversi')}>
                Orbital Reversi
              </button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
