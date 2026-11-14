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
    'btn-home-arena-cathedral',
    'btn-home-arena-robotics',
    'btn-arena-toggle',
    'input-move-notation',
  ]) {
    assert.ok(appTsx.includes(`id="${multiArenaId}"`), `Missing multi-arena/input control #${multiArenaId}`);
  }
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
});
