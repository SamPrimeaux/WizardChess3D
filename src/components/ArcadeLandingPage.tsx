import { useMemo, useState } from 'react';
import type { ArenaId, SavedGameState } from '../engine/storage';
import { getUnifiedEntertainmentLedger } from '../games/arcadeStats';
import { D1_CHESS_SCHEMA_SQL } from '../integrations/entertainment/d1Schema';
import { PWAInstallButton } from './PWAInstallButton';

import heroArcadeImg from '../assets/images/landing_hero_arcade_1795014734827.jpg';
import wizardChessCoverImg from '../assets/images/game_cover_wizard_chess_1795014737531.jpg';
import crownDraughtsCoverImg from '../assets/images/game_cover_crown_draughts_1795014738432.jpg';
import orbitalReversiCoverImg from '../assets/images/game_cover_orbital_reversi_1795014739284.jpg';

export interface ArcadeLandingPageProps {
  savedChessGame: SavedGameState | null;
  onPlayWizardChessQuick: (arenaId?: ArenaId) => void;
  onOpenWizardChessLobby: (arenaId?: ArenaId) => void;
  onResumeWizardChess: () => void;
  onPlayCrownDraughts: () => void;
  onPlayOrbitalReversi: () => void;
}

type CatalogFilter = 'all' | '3d' | 'classic';

function ResilientArtwork({
  src,
  alt,
  fallbackTitle,
  aspectClass,
}: {
  src: string;
  alt: string;
  fallbackTitle: string;
  aspectClass: 'aspect-hero' | 'aspect-card';
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={`arcade-artwork-frame ${aspectClass}`}>
      {!failed ? (
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          loading="eager"
          onError={() => setFailed(true)}
          className="arcade-artwork-img"
        />
      ) : (
        <div className="arcade-artwork-fallback" aria-label={alt}>
          <span className="fallback-title">{fallbackTitle}</span>
        </div>
      )}
    </div>
  );
}

export function ArcadeLandingPage({
  savedChessGame,
  onPlayWizardChessQuick,
  onOpenWizardChessLobby,
  onResumeWizardChess,
  onPlayCrownDraughts,
  onPlayOrbitalReversi,
}: ArcadeLandingPageProps) {
  const [filter, setFilter] = useState<CatalogFilter>('all');
  const [copiedSchema, setCopiedSchema] = useState(false);

  const ledger = useMemo(() => getUnifiedEntertainmentLedger(), []);

  const handleCopyD1Schema = () => {
    navigator.clipboard?.writeText(D1_CHESS_SCHEMA_SQL).catch(() => {});
    setCopiedSchema(true);
    window.setTimeout(() => setCopiedSchema(false), 1600);
  };

  const showWizardChess = filter === 'all' || filter === '3d';
  const showClassicGames = filter === 'all' || filter === 'classic';

  return (
    <div className="arcade-scroll-viewport" id="entertainment-landing-page">
      {/* Strict 3-Zone Single-Row Top Bar Contract */}
      <header className="arcade-topbar">
        <a href="#top" className="arcade-brand">
          InnerAnimalMedia
        </a>

        <nav className="arcade-nav" aria-label="Collection Navigation">
          <a href="#games" className="arcade-nav-link">
            Games
          </a>
          <a href="#worlds" className="arcade-nav-link">
            3D Worlds
          </a>
          <a href="#architecture" className="arcade-nav-link">
            Architecture
          </a>
          <a href="#records" className="arcade-nav-link">
            Match Ledger
          </a>
        </nav>

        <div className="arcade-topbar-cta">
          <button
            type="button"
            id="btn-topbar-play-chess"
            className="sanctum-primary-btn"
            onClick={() => onOpenWizardChessLobby('cathedral')}
          >
            Play Wizard Chess 3D
          </button>
        </div>
      </header>

      <main id="top" className="arcade-container">
        {/* HERO SPLIT SECTION */}
        <section className="arcade-hero-split" aria-label="Entertainment Collection Hero">
          <div className="arcade-hero-copy">
            <div className="arcade-kicker-line">
              <span>InnerAnimalMedia</span>
              <span aria-hidden="true">·</span>
              <span>Entertainment Collection</span>
              <span aria-hidden="true">·</span>
              <span>Release 1.0</span>
            </div>

            <h1 className="arcade-hero-headline">
              Tabletop Strategy Built for Tactile Play
            </h1>

            <p className="arcade-hero-prose">
              Play rules-complete strategy games across sculpted 3D stone sanctums, industrial
              6-DOF robotics bays, and precision 8×8 tabletop boards. Every title runs offline
              against multi-depth deterministic AI or local opponents with shared D1 match
              records.
            </p>

            <div className="arcade-hero-actions">
              <button
                type="button"
                id="btn-hero-play-chess"
                className="sanctum-primary-btn large"
                onClick={() => onOpenWizardChessLobby('cathedral')}
              >
                Enter Wizard Chess 3D
              </button>

              <button
                type="button"
                id="btn-hero-play-draughts"
                className="sanctum-secondary-btn large"
                onClick={onPlayCrownDraughts}
              >
                Play Crown Draughts
              </button>

              {savedChessGame && (
                <button
                  type="button"
                  id="btn-hero-resume-chess"
                  className="hud-btn"
                  onClick={onResumeWizardChess}
                >
                  Resume Chess ({savedChessGame.moves.length} plies)
                </button>
              )}
            </div>
          </div>

          <div className="arcade-hero-media">
            <ResilientArtwork
              src={heroArcadeImg}
              alt="Sculpted marble and gold chess king and knight on an inlaid obsidian slate board inside an architectural gallery"
              fallbackTitle="InnerAnimalMedia Strategy Gallery"
              aspectClass="aspect-hero"
            />
            <div className="arcade-hero-scrim">
              <div className="arcade-scrim-meta">
                <span>Featured Title · Wizard Chess 3D</span>
                <strong>Gothic Cathedral &amp; Robotics Workcell</strong>
              </div>
              <button
                type="button"
                className="hud-btn"
                onClick={() => onPlayWizardChessQuick('cathedral')}
              >
                Quick Match →
              </button>
            </div>
          </div>
        </section>

        {/* FULL-WIDTH METRIC STRIP BELOW HERO SPLIT */}
        <section className="arcade-kpi-strip" aria-label="Collection Summary">
          <div className="arcade-kpi-cell">
            <span className="kpi-value">3</span>
            <span className="kpi-label">Playable Strategy Games</span>
          </div>
          <div className="arcade-kpi-cell">
            <span className="kpi-value">2</span>
            <span className="kpi-label">3D WebGL Arena Worlds</span>
          </div>
          <div className="arcade-kpi-cell">
            <span className="kpi-value">{ledger.totalMatches}</span>
            <span className="kpi-label">Completed Local Matches</span>
          </div>
          <div className="arcade-kpi-cell">
            <span className="kpi-value">{ledger.totalMoves}</span>
            <span className="kpi-label">Recorded Plies in Ledger</span>
          </div>
        </section>

        {/* INTERACTIVE GAMES COLLECTION */}
        <section id="games" className="arcade-section">
          <div className="arcade-section-header">
            <div>
              <h2 className="arcade-section-title">Playable Game Library</h2>
              <p className="arcade-section-sub">
                Select any title to launch directly in your browser—no account gates or external
                API keys required.
              </p>
            </div>

            <div className="arcade-filter-bar" role="group" aria-label="Filter Games">
              <button
                type="button"
                className={`arcade-filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All Titles (3)
              </button>
              <button
                type="button"
                className={`arcade-filter-btn ${filter === '3d' ? 'active' : ''}`}
                onClick={() => setFilter('3d')}
              >
                3D Spatial (1)
              </button>
              <button
                type="button"
                className={`arcade-filter-btn ${filter === 'classic' ? 'active' : ''}`}
                onClick={() => setFilter('classic')}
              >
                Classic 8×8 (2)
              </button>
            </div>
          </div>

          <div className="arcade-bento-grid">
            {showWizardChess && (
              <article className="arcade-game-card featured" id="card-game-wizard-chess">
                <div className="arcade-card-media-col">
                  <ResilientArtwork
                    src={wizardChessCoverImg}
                    alt="Sculpted marble and obsidian chess armies inside a firelit Gothic Cathedral"
                    fallbackTitle="Wizard Chess 3D"
                    aspectClass="aspect-card"
                  />
                </div>

                <div className="arcade-card-body">
                  <div className="arcade-inline-meta">
                    <span>01. Flagship 3D Spatial</span>
                    <span aria-hidden="true">·</span>
                    <span>FIDE Rules &amp; Clocks</span>
                    <span aria-hidden="true">·</span>
                    <span>vs AI &amp; Local 2P</span>
                  </div>

                  <h3 className="arcade-card-title">Wizard Chess 3D</h3>

                  <p className="arcade-card-desc">
                    Command sculpted stone-and-gold monarchs inside the Royal Stone Sanctum or
                    switch live to EVA astronaut fleets inside an orbital 6-DOF Robotics Workcell.
                    Includes melee fracture physics, Bullet/Blitz/Rapid clocks, SAN move history
                    board highlights, and full PGN/FEN replay.
                  </p>

                  <div className="arcade-card-actions">
                    <button
                      type="button"
                      id="btn-landing-chess-lobby"
                      className="sanctum-primary-btn"
                      onClick={() => onOpenWizardChessLobby('cathedral')}
                    >
                      Configure 3D Lobby
                    </button>
                    <button
                      type="button"
                      id="btn-landing-play-chess"
                      className="hud-btn"
                      onClick={() => onPlayWizardChessQuick('cathedral')}
                    >
                      Quick Play Sanctum
                    </button>
                    <button
                      type="button"
                      id="btn-landing-chess-robotics"
                      className="hud-btn"
                      onClick={() => onPlayWizardChessQuick('robotics')}
                    >
                      Launch Robotics Bay
                    </button>
                  </div>
                </div>
              </article>
            )}

            {showClassicGames && (
              <>
                <article className="arcade-game-card" id="card-game-crown-draughts">
                  <ResilientArtwork
                    src={crownDraughtsCoverImg}
                    alt="Turned black basalt and brushed warm brass crowned checkers pieces on a walnut and slate board"
                    fallbackTitle="Crown Draughts"
                    aspectClass="aspect-card"
                  />

                  <div className="arcade-card-body">
                    <div className="arcade-inline-meta">
                      <span>02. New Release</span>
                      <span aria-hidden="true">·</span>
                      <span>WCDF Checkers</span>
                      <span aria-hidden="true">·</span>
                      <span>Multi-Jump AI</span>
                    </div>

                    <h3 className="arcade-card-title">Crown Draughts</h3>

                    <p className="arcade-card-desc">
                      Tournament American Checkers with mandatory capture enforcement, recursive
                      multi-jump chains, King crowning, official 1–32 WCDF notation log, Walnut &amp;
                      Orbital Slate finishes, and 6-ply Alpha-Beta AI.
                    </p>

                    <div className="arcade-card-actions">
                      <button
                        type="button"
                        id="btn-landing-play-draughts"
                        className="sanctum-primary-btn"
                        onClick={onPlayCrownDraughts}
                      >
                        Play Crown Draughts
                      </button>
                    </div>
                  </div>
                </article>

                <article className="arcade-game-card" id="card-game-orbital-reversi">
                  <ResilientArtwork
                    src={orbitalReversiCoverImg}
                    alt="Two-tone titanium white and carbon black reversible strategy discs on an anodized 8x8 grid"
                    fallbackTitle="Orbital Reversi"
                    aspectClass="aspect-card"
                  />

                  <div className="arcade-card-body">
                    <div className="arcade-inline-meta">
                      <span>03. Tactical Grid</span>
                      <span aria-hidden="true">·</span>
                      <span>8×8 Outflank</span>
                      <span aria-hidden="true">·</span>
                      <span>Corner Heuristic AI</span>
                    </div>

                    <h3 className="arcade-card-title">Orbital Reversi</h3>

                    <p className="arcade-card-desc">
                      High-contrast Carbon vs Titanium Reversi with live outflank gain previews,
                      automatic zero-move pass detection, territory balance meter, and corner-weight
                      minimax AI.
                    </p>

                    <div className="arcade-card-actions">
                      <button
                        type="button"
                        id="btn-landing-play-reversi"
                        className="sanctum-primary-btn"
                        onClick={onPlayOrbitalReversi}
                      >
                        Play Orbital Reversi
                      </button>
                    </div>
                  </div>
                </article>
              </>
            )}
          </div>
        </section>

        {/* DUAL 3D ARENA WORLDS SPOTLIGHT */}
        <section id="worlds" className="arcade-section">
          <div className="arcade-section-header">
            <div>
              <h2 className="arcade-section-title">Selectable 3D Chess Worlds</h2>
              <p className="arcade-section-sub">
                Switch environments and piece skins at any point before or during a Wizard Chess 3D
                match without losing board state or clock time.
              </p>
            </div>
          </div>

          <div className="arcade-worlds-split">
            <div className="arcade-world-panel">
              <div className="arcade-inline-meta">
                <span>Arena 01</span>
                <span aria-hidden="true">·</span>
                <span>Royal Stone Sanctum</span>
              </div>
              <h3 className="arcade-card-title">Gothic Cathedral</h3>
              <p className="arcade-card-desc">
                Vaulted stone architecture illuminated by twin fire braziers, featuring carved
                Carrara marble and obsidian monarch statues with gilded armor trim.
              </p>
              <button
                type="button"
                id="btn-landing-world-cathedral"
                className="hud-btn"
                onClick={() => onOpenWizardChessLobby('cathedral')}
              >
                Open Sanctum Lobby →
              </button>
            </div>

            <div className="arcade-world-panel">
              <div className="arcade-inline-meta">
                <span>Arena 02</span>
                <span aria-hidden="true">·</span>
                <span>Industrial Cleanroom &amp; EVA Fleet</span>
              </div>
              <h3 className="arcade-card-title">Robotics Workcell</h3>
              <p className="arcade-card-desc">
                Designed for robotic-arm tabletop play: articulated 6-DOF industrial gantry arm,
                overhead cleanroom optics, and bone-anchored EVA astronaut visors and life-support
                packs.
              </p>
              <button
                type="button"
                id="btn-landing-world-robotics"
                className="hud-btn"
                onClick={() => onOpenWizardChessLobby('robotics')}
              >
                Open Workcell Lobby →
              </button>
            </div>
          </div>
        </section>

        {/* SHARED ENGINE & 4-TABLE D1 ARCHITECTURE */}
        <section id="architecture" className="arcade-section">
          <div className="arcade-section-header">
            <div>
              <h2 className="arcade-section-title">Unified Entertainment Architecture</h2>
              <p className="arcade-section-sub">
                All titles share deterministic local rules engines, mobile touch ergonomics, and a
                single 4-table Cloudflare D1 relational schema.
              </p>
            </div>
            <button
              type="button"
              id="btn-landing-copy-d1"
              className="hud-btn"
              onClick={handleCopyD1Schema}
            >
              {copiedSchema ? 'Copied d1-chess-schema.sql' : 'Copy D1 Schema SQL'}
            </button>
          </div>

          <div className="arcade-numbered-list">
            <div className="arcade-numbered-item">
              <h3 className="numbered-title">01. Deterministic Rules &amp; Offline AI</h3>
              <p className="numbered-desc">
                Legal move generation, checkmate/draw claims, mandatory multi-jumps, and outflank
                flips run locally in TypeScript with zero paid API latency or network dependency.
              </p>
            </div>
            <div className="arcade-numbered-item">
              <h3 className="numbered-title">02. Mobile-First GLB &amp; Touch Pipeline</h3>
              <p className="numbered-desc">
                Parallel gzipped glTF 2.0 stream decoding, deferred 8.5 MB Cathedral loading when
                booting in Robotics mode, multi-touch pinch/orbit guards, and 44px+ controls.
              </p>
            </div>
            <div className="arcade-numbered-item">
              <h3 className="numbered-title">03. Normalized 4-Table D1 SQLite Storage</h3>
              <p className="numbered-desc">
                Wizard Chess 3D (<code>chess</code>), Crown Draughts (<code>checkers</code>), and
                Orbital Reversi (<code>reversi</code>) export directly into{' '}
                <code>game_rooms</code>, <code>games</code>, <code>game_moves</code>, and{' '}
                <code>game_credits</code>.
              </p>
            </div>
          </div>
        </section>

        {/* UNIFIED MATCH LEDGER */}
        <section id="records" className="arcade-section">
          <div className="arcade-section-header">
            <div>
              <h2 className="arcade-section-title">Recent Local Match Ledger</h2>
              <p className="arcade-section-sub">
                Completed matches across all Entertainment titles stored in your browser.
              </p>
            </div>
          </div>

          {ledger.recentMatches.length === 0 ? (
            <div className="arcade-empty-ledger">
              <p>No completed matches recorded yet. Finish a game in any title to log it here.</p>
              <div className="arcade-card-actions">
                <button
                  type="button"
                  className="hud-btn"
                  onClick={() => onPlayWizardChessQuick('cathedral')}
                >
                  Start Wizard Chess 3D
                </button>
                <button type="button" className="hud-btn" onClick={onPlayCrownDraughts}>
                  Start Crown Draughts
                </button>
                <button type="button" className="hud-btn" onClick={onPlayOrbitalReversi}>
                  Start Orbital Reversi
                </button>
              </div>
            </div>
          ) : (
            <div className="arcade-ledger-table-wrap">
              <table className="arcade-ledger-table">
                <thead>
                  <tr>
                    <th>Game</th>
                    <th>Mode</th>
                    <th>Outcome</th>
                    <th>Plies</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.recentMatches.map((rec) => (
                    <tr key={rec.id}>
                      <td className="ledger-strong">{rec.gameTitle}</td>
                      <td>{rec.modeLabel}</td>
                      <td>{rec.summary}</td>
                      <td className="ledger-num">{rec.moveCount}</td>
                      <td className="ledger-num">
                        {new Date(rec.dateIso).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* QUIET FOOTER */}
      <footer className="arcade-footer">
        <div className="arcade-footer-inner">
          <div className="arcade-footer-brand">
            <strong>InnerAnimalMedia</strong>
            <span>Entertainment Collection · Package inneranimalmedia.wizard-chess-3d · v1.0.0</span>
          </div>

          <div className="arcade-footer-links">
            <button
              type="button"
              className="arcade-footer-btn"
              onClick={() => onOpenWizardChessLobby('cathedral')}
            >
              Wizard Chess 3D
            </button>
            <button type="button" className="arcade-footer-btn" onClick={onPlayCrownDraughts}>
              Crown Draughts
            </button>
            <button type="button" className="arcade-footer-btn" onClick={onPlayOrbitalReversi}>
              Orbital Reversi
            </button>
            <PWAInstallButton compact />
          </div>
        </div>
      </footer>
    </div>
  );
}
