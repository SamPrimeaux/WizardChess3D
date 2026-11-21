import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = process.cwd();

test('Production HUD and Opening Screen exclude dev/multiplayer lobby clutter and preserve essential controls', () => {
  const appTsx = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf-8');

  for (const requiredId of [
    'btn-home-play',
    'btn-undo',
    'btn-reset',
    'btn-camera-menu',
    'btn-sound-toggle',
    'btn-view-toggle',
    'btn-open-settings',
    'btn-open-history',
    'btn-hide-ui',
    'controls-hint',
  ]) {
    assert.ok(appTsx.includes(`id="${requiredId}"`), `Missing required UI control #${requiredId}`);
  }

  for (const forbiddenId of [
    'cam-speed-wrap',
    'input-cam-speed',
    'rot-speed-wrap',
    'input-rot-speed',
    'script-bar',
    'btn-script-modal',
    'lobby-modal',
    'room-pill',
  ]) {
    assert.ok(!appTsx.includes(forbiddenId), `Forbidden prototype UI element #${forbiddenId} found in App.tsx`);
  }
});

test('All 7 compressed 3D assets (.glb.gz.b64) decode and gunzip to valid glTF 2.0 binary models', () => {
  const expectedModels = [
    'option8_cathedral',
    'pawn_white',
    'rook_white',
    'knight_white',
    'bishop_white',
    'queen_white',
    'king_white',
  ];

  for (const name of expectedModels) {
    const b64Path = path.join(ROOT, 'public/assets/glb', `${name}.glb.gz.b64`);
    assert.ok(fs.existsSync(b64Path), `Missing 3D asset ${b64Path}`);
    const b64Text = fs.readFileSync(b64Path, 'utf-8').trim();
    assert.ok(b64Text.length > 1000, `Asset ${name}.glb.gz.b64 is unexpectedly small`);

    const gzBuf = Buffer.from(b64Text, 'base64');
    const glbBuf = zlib.gunzipSync(gzBuf);

    const magic = glbBuf.toString('ascii', 0, 4);
    const version = glbBuf.readUInt32LE(4);
    const totalLen = glbBuf.readUInt32LE(8);
    assert.equal(magic, 'glTF', `Invalid glTF magic header for ${name}`);
    assert.equal(version, 2, `Invalid glTF version for ${name}`);
    assert.equal(totalLen, glbBuf.length, `Mismatched glTF byte length for ${name}`);
  }
});

test('Digital chess clock, Move History highlighting, PWA assets, and ecosystem manifests exist', () => {
  const appTsx = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf-8');
  const engineJs = fs.readFileSync(path.join(ROOT, 'src/wizardChessEngine.js'), 'utf-8');

  for (const requiredId of [
    'status-pill',
    'chess-clock-overlay',
    'clock-white',
    'clock-black',
    'btn-clock-settings',
    'clock-settings-popover',
    'move-history-sidebar',
    'move-history-list',
    'move-history-count',
    'btn-move-history-toggle',
    'btn-move-history-copy',
  ]) {
    assert.ok(appTsx.includes(`id="${requiredId}"`), `Missing HUD element #${requiredId}`);
  }

  for (const symbol of ['CLOCK_PRESET_CONFIG', 'setClockMode', 'setClockDirection', 'handleClockTimeout', 'highlightMoveSquares', 'WizardChessRules']) {
    assert.ok(engineJs.includes(symbol), `Missing engine symbol ${symbol}`);
  }

  for (const relPath of [
    'src/arenas/roboticsLabArena.ts',
    'public/favicon-32x32.png',
    'public/apple-touch-icon.png',
    'public/pwa-192x192.png',
    'public/pwa-512x512.png',
    'public/pwa-maskable-512x512.png',
    'public/cover-1280x720.png',
    'entertainment/app.manifest.json',
    'entertainment/schemas/settings.schema.json',
    'entertainment/schemas/save-state.schema.json',
    'chatgpt-plugin/manifest.json',
    'chatgpt-plugin/openapi.json',
    'chatgpt-plugin/server.mjs',
  ]) {
    assert.ok(fs.existsSync(path.join(ROOT, relPath)), `Missing deliverable file ${relPath}`);
  }

  for (const multiArenaId of [
    'home-arena-selector',
    'btn-arena-toggle',
    'input-move-notation',
  ]) {
    assert.ok(appTsx.includes(`id="${multiArenaId}"`), `Missing multi-arena/input control #${multiArenaId}`);
  }
  assert.ok(
    appTsx.includes('id={`btn-home-arena-${id}`}') && appTsx.includes("'cathedral'") && appTsx.includes("'robotics'"),
    'Missing world card selector buttons for cathedral and robotics arenas'
  );
  for (const engineHook of [
    'createRoboticsLabArena',
    'createPieceSkinSystem',
    'applyArenaToPiece',
    'getShardMaterial',
    'setArena',
    'submitMoveNotation',
  ]) {
    assert.ok(engineJs.includes(engineHook), `Missing multi-arena/input engine hook ${engineHook}`);
  }

  const pieceSkinsTs = fs.readFileSync(path.join(ROOT, 'src/arenas/pieceSkins.ts'), 'utf-8');
  assert.ok(pieceSkinsTs.includes('export function createPieceSkinSystem'), 'Missing createPieceSkinSystem export');
  for (const boneName of ['Head', 'Tower_Upper', 'Rider_Head', 'Horse_Head', 'Head_Mitre', 'Head_Crown']) {
    assert.ok(pieceSkinsTs.includes(`'${boneName}'`), `Missing astronaut bone anchor ${boneName}`);
  }

  const stylesCss = fs.readFileSync(path.join(ROOT, 'src/styles.css'), 'utf-8');
  assert.ok(appTsx.includes('data-board-highlighted='), 'Missing 3D board highlighted marker on move history buttons');
  assert.ok(appTsx.includes('data-latest='), 'Missing latest move marker on move history buttons');
  assert.ok(stylesCss.includes('.move-san-btn:hover') && stylesCss.includes('dashed'), 'Missing dashed border style for move history hover state');
  assert.ok(stylesCss.includes('.move-san-btn.selected') && stylesCss.includes('1.5px solid #4ea8de'), 'Missing solid border style for move history selected state');
});

test('Organized D1 SQLite schema validates all 4 tables, indexes, manifest wiring, and TypeScript mapper', async () => {
  const schemaPath = path.join(ROOT, 'entertainment/schemas/d1-chess-schema.sql');
  assert.ok(fs.existsSync(schemaPath), 'Missing organized D1 SQL schema file');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  for (const table of ['game_rooms', 'games', 'game_moves', 'game_credits']) {
    assert.ok(
      schemaSql.includes(`CREATE TABLE IF NOT EXISTS ${table}`),
      `Missing CREATE TABLE statement for ${table}`
    );
  }
  for (const idx of [
    'idx_game_rooms_status',
    'idx_game_rooms_workspace',
    'idx_game_rooms_join_code',
    'idx_games_room_id',
    'idx_games_status',
    'idx_games_workspace',
    'idx_game_moves_game_order',
    'idx_game_credits_updated_at',
  ]) {
    assert.ok(schemaSql.includes(idx), `Missing SQL index ${idx}`);
  }

  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'entertainment/app.manifest.json'), 'utf-8')
  );
  assert.equal(manifest.schemas?.d1Database, './schemas/d1-chess-schema.sql');

  const d1Ts = fs.readFileSync(path.join(ROOT, 'src/integrations/entertainment/d1Schema.ts'), 'utf-8');
  for (const sym of [
    'export interface GameRoomRow',
    'export interface GameRow',
    'export interface GameMoveRow',
    'export interface GameCreditsRow',
    'export function toD1GameBundle',
    'export function buildD1UpsertSql',
  ]) {
    assert.ok(d1Ts.includes(sym), `Missing D1 module export: ${sym}`);
  }

  const hostAdapterTs = fs.readFileSync(
    path.join(ROOT, 'src/integrations/entertainment/hostAdapter.ts'),
    'utf-8'
  );
  assert.ok(hostAdapterTs.includes('toD1GameBundle'), 'hostAdapter must attach D1 game bundle');

  // Execute real SQLite DDL + sample insert if node:sqlite is available in runtime
  try {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.exec(schemaSql);
    db.exec(`
      INSERT INTO game_rooms (id, host_player_id, host_display_name) VALUES ('room_test_1', 'player_white', 'Commander');
      INSERT INTO games (id, room_id, status, white_player_id, black_player_id, move_count) VALUES ('game_test_1', 'room_test_1', 'active', 'player_white', 'ai_medium', 1);
      INSERT INTO game_moves (id, game_id, move_number, player_id, color, from_square, to_square, piece, san, lan) VALUES ('mv_test_1', 'game_test_1', 1, 'player_white', 'white', 'e2', 'e4', 'p', 'e4', 'e2e4');
      INSERT INTO game_credits (user_email, credits_balance) VALUES ('player@inneranimalmedia.com', 100);
    `);
    const gameRow = db.prepare('SELECT id, room_id, move_count FROM games WHERE id = ?').get('game_test_1');
    assert.equal(gameRow.room_id, 'room_test_1');
    assert.equal(gameRow.move_count, 1);
    db.close();
  } catch (err) {
    if (err?.code !== 'ERR_UNKNOWN_BUILTIN_MODULE' && err?.code !== 'ERR_MODULE_NOT_FOUND') {
      throw err;
    }
  }
});

test('Mobile-optimized GLB loading, touch gesture safeguards, and responsive UI hooks are configured', () => {
  const engineJs = fs.readFileSync(path.join(ROOT, 'src/wizardChessEngine.js'), 'utf-8');
  const storageTs = fs.readFileSync(path.join(ROOT, 'src/engine/storage.ts'), 'utf-8');
  const appTsx = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf-8');
  const stylesCss = fs.readFileSync(path.join(ROOT, 'src/styles.css'), 'utf-8');
  const viteConfig = fs.readFileSync(path.join(ROOT, 'vite.config.ts'), 'utf-8');

  for (const hook of [
    'THREE.Cache.enabled = true',
    'ensureCathedralLoaded',
    'decodeBase64GzipToBuffer',
    'getResponsiveCameraFov',
    'getResponsiveDistanceScale',
    'gestureHadMultiTouch',
    'handlePointerCancel',
    "touchAction = 'none'",
  ]) {
    assert.ok(engineJs.includes(hook), `Missing mobile/GLB engine optimization: ${hook}`);
  }

  assert.ok(storageTs.includes('detectDefaultGraphicsQuality'), 'Missing mobile graphics quality detection');
  assert.ok(viteConfig.includes("assets/aistudio/**"), 'VitePWA must exclude internal attachment files from precache');

  for (const uiHook of [
    'id="mobile-quick-bar"',
    'id="btn-copy-d1-schema"',
    'id="btn-copy-d1-match"',
  ]) {
    assert.ok(appTsx.includes(uiHook), `Missing UI control ${uiHook}`);
  }

  for (const cssRule of [
    'touch-action: none',
    '100dvh',
    '.mobile-quick-bar',
    '@media (max-width: 768px)',
  ]) {
    assert.ok(stylesCss.includes(cssRule), `Missing responsive CSS rule ${cssRule}`);
  }
});

test('Entertainment Landing Page, Crown Draughts, and Orbital Reversi are wired with bespoke artwork and D1 support', () => {
  const appTsx = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf-8');
  const landingTsx = fs.readFileSync(path.join(ROOT, 'src/components/ArcadeLandingPage.tsx'), 'utf-8');
  const draughtsEngine = fs.readFileSync(path.join(ROOT, 'src/games/draughtsEngine.ts'), 'utf-8');
  const reversiEngine = fs.readFileSync(path.join(ROOT, 'src/games/reversiEngine.ts'), 'utf-8');
  const d1Ts = fs.readFileSync(path.join(ROOT, 'src/integrations/entertainment/d1Schema.ts'), 'utf-8');

  assert.ok(appTsx.includes('<ArcadeLandingPage'), 'App.tsx must render ArcadeLandingPage');
  assert.ok(appTsx.includes('<CrownDraughtsGame'), 'App.tsx must render CrownDraughtsGame');
  assert.ok(appTsx.includes('<OrbitalReversiGame'), 'App.tsx must render OrbitalReversiGame');

  for (const landingId of [
    'entertainment-landing-page',
    'btn-topbar-play-chess',
    'btn-landing-chess-lobby',
    'btn-landing-play-chess',
    'btn-landing-play-draughts',
    'btn-landing-play-reversi',
  ]) {
    assert.ok(landingTsx.includes(`id="${landingId}"`), `Missing landing page control #${landingId}`);
  }

  for (const imgFile of [
    'src/assets/images/landing_hero_arcade_1795014734827.jpg',
    'src/assets/images/game_cover_wizard_chess_1795014737531.jpg',
    'src/assets/images/game_cover_crown_draughts_1795014738432.jpg',
    'src/assets/images/game_cover_orbital_reversi_1795014739284.jpg',
  ]) {
    assert.ok(fs.existsSync(path.join(ROOT, imgFile)), `Missing generated cover asset ${imgFile}`);
  }

  for (const fnName of [
    'getLegalDraughtsMoves',
    'applyDraughtsMove',
    'chooseDraughtsAIMove',
    'coordToWcdf',
  ]) {
    assert.ok(draughtsEngine.includes(`export function ${fnName}`), `Missing Draughts export ${fnName}`);
  }

  for (const fnName of [
    'getLegalReversiMoves',
    'applyReversiMove',
    'chooseReversiAIMove',
    'countReversiDiscs',
  ]) {
    assert.ok(reversiEngine.includes(`export function ${fnName}`), `Missing Reversi export ${fnName}`);
  }

  assert.ok(d1Ts.includes('export function buildArcadeGameD1Bundle'), 'Missing multi-game D1 bundle builder');
});

test('Career statistics track win/loss %, total captures, longest game duration, and Archive modal hooks', async () => {
  const storageTs = fs.readFileSync(path.join(ROOT, 'src/engine/storage.ts'), 'utf-8');
  const engineJs = fs.readFileSync(path.join(ROOT, 'src/wizardChessEngine.js'), 'utf-8');
  const fallbackTs = fs.readFileSync(path.join(ROOT, 'src/engine/fallbackEngine.ts'), 'utf-8');
  const appTsx = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf-8');
  const stylesCss = fs.readFileSync(path.join(ROOT, 'src/styles.css'), 'utf-8');

  for (const fnExport of [
    'export interface CareerStats',
    'export const CAREER_STATS_STORAGE_KEY',
    'export function countRecordCaptures',
    'export function resolveRecordOutcome',
    'export function formatDurationClock',
    'export function applyCompletedGameToCareerStats',
    'export function calculateCareerStatsFromRecords',
    'export function loadCareerStats',
    'export function recordGameInCareerStats',
    'export function clearCareerStats',
  ]) {
    assert.ok(storageTs.includes(fnExport), `Missing storage career stats export: ${fnExport}`);
  }

  for (const engineField of ['durationSeconds', 'captureCount', 'playerCaptures', 'opponentCaptures', 'getCurrentElapsedSeconds']) {
    assert.ok(engineJs.includes(engineField), `3D engine missing completion stat field ${engineField}`);
    assert.ok(fallbackTs.includes(engineField), `2D fallback engine missing completion stat field ${engineField}`);
  }

  for (const archiveId of [
    'id="archive-career-stats"',
    'id="career-stats-wld"',
    'id="career-stat-win-loss"',
    'id="career-stat-captures"',
    'id="career-stat-longest"',
    'id="career-stat-playtime"',
    'id="btn-reset-career-stats"',
    'id="btn-clear-archive-history"',
  ]) {
    assert.ok(appTsx.includes(archiveId), `Archive modal missing element ${archiveId}`);
  }

  assert.ok(stylesCss.includes('.career-stats-grid'), 'Missing .career-stats-grid style in styles.css');
  assert.ok(stylesCss.includes('tabular-nums'), 'Career statistics must use tabular-nums');

  // Dynamically import storage.ts in Node (supported natively in Node >= 22.6 via type stripping) to verify math
  const storageMod = await import('../src/engine/storage.ts');
  const makeMove = (ply, color, capture) => ({
    ply,
    moveNumber: Math.ceil(ply / 2),
    san: capture ? 'exd5' : 'e4',
    fromSq: 'e4',
    toSq: 'd5',
    color,
    pieceType: 'pawn',
    fromR: 4,
    fromC: 4,
    toR: 3,
    toC: 3,
    capture,
    fenAfter: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  });

  //Newest-first history array (chronological order: g1 -> g2 -> g3 -> g4)
  const sampleHistory = [
    {
      schemaVersion: 1,
      id: 'g4',
      dateIso: '2026-11-18T12:30:00.000Z',
      playMode: 'ai',
      playerColor: 'b',
      difficulty: 'master',
      clockPreset: 'rapid',
      result: '0-1', // Black won -> player won!
      termination: 'Checkmate',
      moveCount: 54,
      durationSeconds: 412,
      pgn: '',
      finalFen: '',
      moves: [makeMove(1, 'w', true), makeMove(2, 'b', true), makeMove(3, 'b', true)],
    },
    {
      schemaVersion: 1,
      id: 'g3',
      dateIso: '2026-11-18T12:20:00.000Z',
      playMode: 'ai',
      playerColor: 'w',
      difficulty: 'club',
      clockPreset: 'blitz',
      result: '1/2-1/2', // Draw
      termination: 'Stalemate',
      moveCount: 62,
      durationSeconds: 195,
      pgn: '',
      finalFen: '',
      moves: [makeMove(1, 'w', false), makeMove(2, 'b', true)],
    },
    {
      schemaVersion: 1,
      id: 'g2',
      dateIso: '2026-11-18T12:10:00.000Z',
      playMode: 'ai',
      playerColor: 'w',
      difficulty: 'club',
      clockPreset: 'blitz',
      result: '0-1', // Loss
      termination: 'Resignation',
      moveCount: 24,
      durationSeconds: 95,
      pgn: '',
      finalFen: '',
      moves: [makeMove(1, 'b', true)],
    },
    {
      schemaVersion: 1,
      id: 'g1',
      dateIso: '2026-11-18T12:00:00.000Z',
      playMode: 'ai',
      playerColor: 'w',
      difficulty: 'novice',
      clockPreset: 'blitz',
      result: '1-0', // Win
      termination: 'Checkmate',
      moveCount: 30,
      durationSeconds: 140,
      pgn: '',
      finalFen: '',
      moves: [makeMove(1, 'w', true), makeMove(2, 'w', true)],
    },
  ];

  const stats = storageMod.calculateCareerStatsFromRecords(sampleHistory);
  assert.equal(stats.totalGames, 4);
  assert.equal(stats.wins, 2);
  assert.equal(stats.losses, 1);
  assert.equal(stats.draws, 1);
  assert.equal(stats.winRatePct, 50);
  assert.equal(stats.lossRatePct, 25);
  assert.equal(stats.drawRatePct, 25);
  assert.equal(stats.totalCaptures, 7);
  assert.equal(stats.playerCaptures, 4);
  assert.equal(stats.opponentCaptures, 3);
  assert.equal(stats.longestGameSeconds, 412);
  assert.equal(stats.longestGameMoves, 62);
  assert.equal(stats.totalDurationSeconds, 842);
  assert.equal(stats.currentWinStreak, 1);
  assert.equal(stats.bestWinStreak, 1);

  // Deduplication check: re-applying g4 does not double-count
  const deduped = storageMod.applyCompletedGameToCareerStats(stats, sampleHistory[0]);
  assert.equal(deduped.totalGames, 4);
  assert.equal(deduped.totalCaptures, 7);

  assert.equal(storageMod.formatDurationClock(0), '00:00');
  assert.equal(storageMod.formatDurationClock(412), '06:52');
  assert.equal(storageMod.formatDurationClock(3665), '1:01:05');
});



