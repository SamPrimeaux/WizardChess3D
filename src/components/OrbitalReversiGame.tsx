import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyReversiMove,
  chooseReversiAIMove,
  coordToReversiSquare,
  countReversiDiscs,
  createInitialReversiBoard,
  createInitialReversiState,
  getLegalReversiMoves,
  serializeReversiBoard,
  type ReversiColor,
  type ReversiDifficulty,
  type ReversiGameState,
} from '../games/reversiEngine';
import { playTabletopSound } from '../games/arcadeAudio';
import { recordArcadeMatch } from '../games/arcadeStats';
import { buildArcadeGameD1Bundle, buildD1UpsertSql } from '../integrations/entertainment/d1Schema';

interface OrbitalReversiGameProps {
  onBackToArcade: () => void;
  onSwitchGame: (target: 'chess' | 'draughts') => void;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export function OrbitalReversiGame({ onBackToArcade, onSwitchGame }: OrbitalReversiGameProps) {
  const [playMode, setPlayMode] = useState<'ai' | 'local'>('ai');
  const [humanColor, setHumanColor] = useState<ReversiColor>('b');
  const [difficulty, setDifficulty] = useState<ReversiDifficulty>('club');
  const [showFlipCounts, setShowFlipCounts] = useState(true);
  const [soundMuted, setSoundMuted] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const [historyStack, setHistoryStack] = useState<ReversiGameState[]>(() => [
    createInitialReversiState(),
  ]);
  const [hoveredSquare, setHoveredSquare] = useState<string | null>(null);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const recordedIdsRef = useRef<Set<string>>(new Set());

  const currentState = historyStack[historyStack.length - 1];

  const legalMoves = useMemo(
    () => (currentState.isGameOver ? [] : getLegalReversiMoves(currentState.board, currentState.turn)),
    [currentState.board, currentState.turn, currentState.isGameOver]
  );

  const legalByCoord = useMemo(() => {
    const map = new Map<string, { flips: [number, number][]; square: string }>();
    for (const m of legalMoves) {
      map.set(`${m.r},${m.c}`, { flips: m.flips, square: m.square });
    }
    return map;
  }, [legalMoves]);

  const previewFlipsSet = useMemo(() => {
    const set = new Set<string>();
    if (!hoveredSquare) return set;
    const found = legalMoves.find((m) => m.square === hoveredSquare);
    if (!found) return set;
    for (const [fr, fc] of found.flips) {
      set.add(`${fr},${fc}`);
    }
    return set;
  }, [hoveredSquare, legalMoves]);

  const lastFlippedSet = useMemo(() => {
    const set = new Set<string>();
    for (const [fr, fc] of currentState.lastFlipped) {
      set.add(`${fr},${fc}`);
    }
    return set;
  }, [currentState.lastFlipped]);

  const counts = useMemo(() => countReversiDiscs(currentState.board), [currentState.board]);

  const commitCellMove = useCallback(
    (r: number, c: number) => {
      setHistoryStack((prev) => {
        const latest = prev[prev.length - 1];
        const next = applyReversiMove(latest, r, c);
        if (next === latest) return prev;
        if (next.isGameOver) {
          playTabletopSound('victory', soundMuted);
        } else {
          playTabletopSound('flip', soundMuted);
        }
        return [...prev, next];
      });
      setHoveredSquare(null);
    },
    [soundMuted]
  );

  // Record finished match once
  useEffect(() => {
    if (!currentState.isGameOver || recordedIdsRef.current.has(currentState.id)) return;
    recordedIdsRef.current.add(currentState.id);
    const winnerLabel =
      currentState.winner === 'b'
        ? 'Carbon Won'
        : currentState.winner === 'w'
        ? 'Titanium Won'
        : 'Tied Grid';
    recordArcadeMatch({
      gameType: 'reversi',
      gameTitle: 'Orbital Reversi',
      winnerLabel,
      summary: currentState.reason || winnerLabel,
      moveCount: currentState.moves.length,
      modeLabel: playMode === 'ai' ? `vs AI (${difficulty})` : 'Local 2P',
    });
  }, [currentState, playMode, difficulty]);

  // AI Turn Execution
  useEffect(() => {
    if (playMode !== 'ai' || currentState.isGameOver || currentState.turn === humanColor) {
      setIsAIThinking(false);
      return;
    }

    setIsAIThinking(true);
    const timer = window.setTimeout(() => {
      const aiMove = chooseReversiAIMove(currentState, difficulty);
      setIsAIThinking(false);
      if (aiMove) {
        commitCellMove(aiMove.r, aiMove.c);
      }
    }, 480);

    return () => window.clearTimeout(timer);
  }, [playMode, humanColor, difficulty, currentState, commitCellMove]);

  const handleStartNewGame = useCallback(
    (overrides?: { mode?: 'ai' | 'local'; side?: ReversiColor; diff?: ReversiDifficulty }) => {
      if (overrides?.mode) setPlayMode(overrides.mode);
      if (overrides?.side) setHumanColor(overrides.side);
      if (overrides?.diff) setDifficulty(overrides.diff);
      setIsAIThinking(false);
      setHoveredSquare(null);
      setHistoryStack([createInitialReversiState()]);
    },
    []
  );

  const handleUndo = useCallback(() => {
    if (historyStack.length <= 1 || isAIThinking) return;
    setHistoryStack((prev) => {
      if (playMode === 'ai' && prev.length >= 3) {
        return prev.slice(0, prev.length - 2);
      }
      return prev.slice(0, prev.length - 1);
    });
  }, [historyStack.length, isAIThinking, playMode]);

  const handleCopyD1Sql = useCallback(() => {
    const initialSnap = serializeReversiBoard(createInitialReversiBoard(), 'b');
    const currentSnap = serializeReversiBoard(currentState.board, currentState.turn);
    const bundle = buildArcadeGameD1Bundle({
      gameId: currentState.id,
      gameType: 'reversi',
      status: currentState.isGameOver
        ? 'completed'
        : currentState.moves.length > 0
        ? 'active'
        : 'waiting',
      turn: currentState.turn === 'b' ? 'black' : 'white',
      winner:
        currentState.winner === 'b'
          ? 'black'
          : currentState.winner === 'w'
          ? 'white'
          : currentState.winner === 'draw'
          ? 'draw'
          : null,
      resultReason: currentState.reason,
      pieceSet: 'orbital_reversi_v1',
      initialState: initialSnap,
      currentState: currentSnap,
      whiteDisplayName:
        playMode === 'local'
          ? 'Player 2 (Titanium)'
          : humanColor === 'w'
          ? 'Player (Titanium)'
          : `Orbital AI (${difficulty})`,
      blackDisplayName:
        playMode === 'local'
          ? 'Player 1 (Carbon)'
          : humanColor === 'b'
          ? 'Player (Carbon)'
          : `Orbital AI (${difficulty})`,
      moves: currentState.moves.map((m) => ({
        ply: m.ply,
        moveNumber: Math.ceil(m.ply / 2),
        color: m.color === 'b' ? 'black' : 'white',
        fromSquare: m.square,
        toSquare: m.square,
        piece: 'disc',
        notation: `${m.square}(+${m.flippedCount})`,
        capturedPiece: `${m.flippedCount}_flipped`,
      })),
      metadata: {
        playMode,
        difficulty,
        blackDiscs: counts.black,
        whiteDiscs: counts.white,
      },
    });

    const sql = buildD1UpsertSql(bundle);
    navigator.clipboard?.writeText(sql).catch(() => {});
    setCopiedSql(true);
    window.setTimeout(() => setCopiedSql(false), 1600);
  }, [currentState, playMode, humanColor, difficulty, counts]);

  const statusText = useMemo(() => {
    if (currentState.isGameOver) {
      return currentState.reason || 'Match Complete';
    }
    if (isAIThinking) {
      return `${currentState.turn === 'b' ? 'Carbon' : 'Titanium'} (AI Evaluating Corners...)`;
    }
    const passNotice = currentState.passedColor
      ? ` · ${currentState.passedColor === 'b' ? 'Carbon' : 'Titanium'} had 0 moves (Passed)`
      : '';
    return `${currentState.turn === 'b' ? 'Carbon' : 'Titanium'} to Place (${legalMoves.length} options)${passNotice}`;
  }, [currentState, isAIThinking, legalMoves.length]);

  const blackSharePct = Math.round(
    (counts.black / Math.max(1, counts.black + counts.white)) * 100
  );

  return (
    <div
      className="arcade-scroll-viewport standalone-game-shell skin-orbital"
      id="reversi-game-view"
    >
      <header className="standalone-topbar">
        <div className="standalone-topbar-left">
          <button
            type="button"
            id="btn-reversi-back"
            className="hud-btn"
            onClick={onBackToArcade}
          >
            ← All Games
          </button>
          <div className="standalone-title-wrap">
            <h1 className="standalone-title">Orbital Reversi</h1>
            <span className="standalone-meta">8×8 Outflank Grid · Positional AI</span>
          </div>
        </div>

        <div className="standalone-status-readout" id="reversi-status" role="status" aria-live="polite">
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
            id="btn-reversi-copy-d1"
            className="hud-btn"
            onClick={handleCopyD1Sql}
          >
            {copiedSql ? 'Copied D1 SQL' : 'Copy D1 SQL'}
          </button>
          <button
            type="button"
            id="btn-reversi-new"
            className="sanctum-primary-btn"
            onClick={() => handleStartNewGame()}
          >
            New Game
          </button>
        </div>
      </header>

      <main className="standalone-main-grid">
        <section className="standalone-board-stage" aria-label="Orbital Reversi 8 by 8 Board">
          <div className="draughts-score-strip reversi-score-strip">
            <div className={`draughts-side-stat ${currentState.turn === 'b' && !currentState.isGameOver ? 'active-turn' : ''}`}>
              <span className="disc-swatch carbon" aria-hidden="true" />
              <span className="side-stat-name">Carbon</span>
              <span className="side-stat-nums">{counts.black}</span>
            </div>

            <div className="reversi-balance-bar" aria-hidden="true">
              <div className="reversi-balance-fill" style={{ width: `${blackSharePct}%` }} />
            </div>

            <div className={`draughts-side-stat ${currentState.turn === 'w' && !currentState.isGameOver ? 'active-turn' : ''}`}>
              <span className="disc-swatch titanium" aria-hidden="true" />
              <span className="side-stat-name">Titanium</span>
              <span className="side-stat-nums">{counts.white}</span>
            </div>
          </div>

          <div className="draughts-board-frame reversi-board-frame">
            <div className="reversi-grid" role="grid" aria-label="Reversi Grid">
              {Array.from({ length: 8 }).map((_, r) =>
                Array.from({ length: 8 }).map((__, c) => {
                  const sq = coordToReversiSquare(r, c);
                  const disc = currentState.board[r][c];
                  const legal =
                    !(playMode === 'ai' && currentState.turn !== humanColor) && !isAIThinking
                      ? legalByCoord.get(`${r},${c}`)
                      : undefined;
                  const isLastPlaced =
                    currentState.lastPlaced?.[0] === r && currentState.lastPlaced?.[1] === c;
                  const isRecentlyFlipped = lastFlippedSet.has(`${r},${c}`);
                  const isPreviewFlip = previewFlipsSet.has(`${r},${c}`);

                  return (
                    <button
                      key={sq}
                      type="button"
                      id={`reversi-sq-${sq}`}
                      disabled={!legal}
                      onMouseEnter={() => legal && setHoveredSquare(sq)}
                      onMouseLeave={() => setHoveredSquare((prev) => (prev === sq ? null : prev))}
                      onClick={() => legal && commitCellMove(r, c)}
                      className={[
                        'reversi-cell',
                        legal ? 'legal-move' : '',
                        isLastPlaced ? 'last-placed' : '',
                        isPreviewFlip ? 'preview-flip' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      aria-label={`Square ${sq}${
                        disc
                          ? `, ${disc === 'b' ? 'Carbon' : 'Titanium'} disc`
                          : legal
                          ? `, Legal move flipping ${legal.flips.length}`
                          : ''
                      }`}
                    >
                      {c === 0 && <span className="reversi-coord-rank">{8 - r}</span>}
                      {r === 7 && <span className="reversi-coord-file">{FILES[c]}</span>}

                      {disc && (
                        <span
                          className={`reversi-disc ${disc === 'b' ? 'carbon' : 'titanium'} ${
                            isRecentlyFlipped ? 'just-flipped' : ''
                          }`}
                        />
                      )}

                      {!disc && legal && (
                        <span className="reversi-legal-pip">
                          {showFlipCounts ? `+${legal.flips.length}` : ''}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {currentState.isGameOver && (
              <div className="standalone-gameover-card" role="dialog" aria-label="Match Result">
                <div className="gameover-kicker">Grid Complete</div>
                <h2 className="gameover-heading">
                  {currentState.winner === 'b'
                    ? 'Carbon Victory'
                    : currentState.winner === 'w'
                    ? 'Titanium Victory'
                    : 'Tied Match'}
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

        <aside className="standalone-sidebar" aria-label="Reversi Controls and Move Log">
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
                  <label className="setup-label">Your Discs</label>
                  <div className="segmented-row">
                    <button
                      type="button"
                      className={`seg-btn ${humanColor === 'b' ? 'active' : ''}`}
                      onClick={() => handleStartNewGame({ side: 'b' })}
                    >
                      Carbon (First)
                    </button>
                    <button
                      type="button"
                      className={`seg-btn ${humanColor === 'w' ? 'active' : ''}`}
                      onClick={() => handleStartNewGame({ side: 'w' })}
                    >
                      Titanium
                    </button>
                  </div>
                </div>

                <div className="setup-field">
                  <label className="setup-label">AI Depth</label>
                  <div className="segmented-row triple">
                    {(['novice', 'club', 'master'] as ReversiDifficulty[]).map((d) => (
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
              <label className="setup-label">Outflank Gain Markers</label>
              <div className="segmented-row">
                <button
                  type="button"
                  className={`seg-btn ${showFlipCounts ? 'active' : ''}`}
                  onClick={() => setShowFlipCounts(true)}
                >
                  Show (+N)
                </button>
                <button
                  type="button"
                  className={`seg-btn ${!showFlipCounts ? 'active' : ''}`}
                  onClick={() => setShowFlipCounts(false)}
                >
                  Minimal Dots
                </button>
              </div>
            </div>

            <div className="standalone-quick-row">
              <button
                type="button"
                id="btn-reversi-undo"
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
                Reset Grid
              </button>
            </div>
          </div>

          <div className="sidebar-section grow">
            <div className="sidebar-header-inline">
              <h2 className="sidebar-heading">Placement Log</h2>
              <span className="sidebar-ply-count">{currentState.moves.length} moves</span>
            </div>
            <div className="standalone-move-log">
              {currentState.moves.length === 0 ? (
                <p className="standalone-log-empty">
                  Carbon opens. Corner squares (a1, h1, a8, h8) cannot be outflanked once claimed.
                </p>
              ) : (
                currentState.moves.map((mv) => (
                  <div key={mv.ply} className="standalone-move-row reversi-log-row">
                    <span className="m-num">{mv.ply}.</span>
                    <span className="m-san">
                      {mv.color === 'b' ? 'Carbon' : 'Titanium'} {mv.square} (+{mv.flippedCount})
                    </span>
                    <span className="m-score">
                      {mv.blackScore}–{mv.whiteScore}
                    </span>
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
              <button type="button" className="hud-btn" onClick={() => onSwitchGame('draughts')}>
                Crown Draughts
              </button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
