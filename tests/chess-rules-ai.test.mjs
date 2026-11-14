import assert from 'node:assert/strict';
import test from 'node:test';
import { Chess } from 'chess.js';

// Note: We test chess.js FIDE mechanics + our AI evaluation/move search logic directly in Node
// and validate PGN/FEN roundtrips without requiring browser DOM APIs.

const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

function evaluateMaterial(chess) {
  let score = 0;
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (!sq) continue;
      const val = PIECE_VALUES[sq.type] || 0;
      score += sq.color === 'w' ? val : -val;
    }
  }
  return chess.turn() === 'w' ? score : -score;
}

function searchBestMove(fen, depth = 2, shouldAbort = () => false) {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0 || shouldAbort()) return null;

  let best = moves[0];
  let bestScore = -Infinity;

  function negamax(d, alpha, beta) {
    if (shouldAbort()) return 0;
    if (chess.isCheckmate()) return -99999 - d;
    if (chess.isDraw()) return 0;
    if (d <= 0) return evaluateMaterial(chess);

    const legal = chess.moves({ verbose: true });
    let bestVal = -Infinity;
    for (const m of legal) {
      if (shouldAbort()) break;
      chess.move(m);
      const val = -negamax(d - 1, -beta, -alpha);
      chess.undo();
      if (val > bestVal) bestVal = val;
      if (val > alpha) alpha = val;
      if (alpha >= beta) break;
    }
    return bestVal;
  }

  for (const m of moves) {
    if (shouldAbort()) return null;
    chess.move(m);
    const val = -negamax(depth - 1, -Infinity, Infinity);
    chess.undo();
    if (val > bestScore) {
      bestScore = val;
      best = m;
    }
  }
  return shouldAbort() ? null : best;
}

test('FIDE special rules: castling, en passant, promotion, checkmate, stalemate', () => {
  // Castling kingside and queenside
  const castleGame = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const wkCastle = castleGame.move('O-O');
  assert.equal(wkCastle.san, 'O-O');
  const bkCastle = castleGame.move('O-O-O');
  assert.equal(bkCastle.san, 'O-O-O');

  // En passant capture
  const epGame = new Chess('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
  const epMove = epGame.move({ from: 'e5', to: 'd6' });
  assert.ok(epMove.isEnPassant());
  assert.equal(epMove.captured, 'p');

  // Underpromotion to Knight with check
  const promoGame = new Chess('4k3/3P4/8/8/8/8/8/4K3 w - - 0 1');
  const promoMove = promoGame.move({ from: 'd7', to: 'd8', promotion: 'n' });
  assert.equal(promoMove.promotion, 'n');
  assert.equal(promoGame.get('d8')?.type, 'n');

  // Fool's Mate -> Checkmate
  const mateGame = new Chess();
  mateGame.move('f3');
  mateGame.move('e5');
  mateGame.move('g4');
  mateGame.move('Qh4#');
  assert.equal(mateGame.isCheckmate(), true);

  // Classic Stalemate
  const stalemateGame = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  assert.equal(stalemateGame.isStalemate(), true);
  assert.equal(stalemateGame.isDraw(), true);
});

test('Draw claims: threefold repetition & 50-move halfmove clock', () => {
  const repGame = new Chess();
  const sequence = ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8'];
  for (const san of sequence) repGame.move(san);
  assert.equal(repGame.isThreefoldRepetition(), true);
  assert.equal(repGame.isDraw(), true);

  const fiftyMoveGame = new Chess('4k3/8/8/8/8/8/8/4K2R w - - 100 60');
  assert.equal(fiftyMoveGame.isDrawByFiftyMoves(), true);
});

test('PGN and FEN roundtrip preservation', () => {
  const pgn = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6';
  const g1 = new Chess();
  g1.loadPgn(pgn);
  const g2 = new Chess(g1.fen());
  assert.equal(g1.fen(), g2.fen());
  assert.deepEqual(g1.history(), ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']);
});

test('AI finds legal forcing capture/mate and respects abort cancellation', () => {
  // Mate in 1: White Queen f7#
  const matePos = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
  const move = searchBestMove(matePos, 2);
  assert.ok(move);
  assert.equal(move.san, 'Qxf7#');

  // Abort mid-search returns null cleanly
  const aborted = searchBestMove(matePos, 2, () => true);
  assert.equal(aborted, null);

  // Terminal checkmate position yields null (no move after game end)
  const donePos = new Chess(matePos);
  donePos.move('Qxf7#');
  assert.equal(searchBestMove(donePos.fen(), 2), null);
});

test('WizardChessRules getStatus/getPgn do not recurse and handle full game transitions', async () => {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  });

  try {
    const { WizardChessRules } = await vite.ssrLoadModule('/src/engine/chessRules.ts');
    const rules = new WizardChessRules();

    // 1. e4 e5 (coordinates: e2=(6,4)->e4=(4,4), e7=(1,4)->e5=(3,4))
    const m1 = rules.executeMove(6, 4, 4, 4);
    assert.ok(m1);
    assert.equal(m1.move.san, 'e4');
    assert.equal(m1.pgn, '1. e4');
    assert.equal(rules.getStatus().isGameOver, false);

    const m2 = rules.executeMove(1, 4, 3, 4);
    assert.ok(m2);
    assert.equal(m2.move.san, 'e5');
    assert.equal(m2.pgn, '1. e4 e5');
    assert.equal(rules.getStatus().pgn, '1. e4 e5');

    // Undo and re-play
    const undone = rules.undoLastMove();
    assert.equal(undone?.san, 'e5');
    assert.equal(rules.getPgn(), '1. e4');

    // Fool's mate via algebraic execution
    rules.reset();
    rules.executeMoveByAlgebraic('f3');
    rules.executeMoveByAlgebraic('e5');
    rules.executeMoveByAlgebraic('g4');
    const mateRes = rules.executeMoveByAlgebraic('Qh4#');
    assert.ok(mateRes);
    const mateStatus = rules.getStatus();
    assert.equal(mateStatus.isCheckmate, true);
    assert.equal(mateStatus.isGameOver, true);
    assert.equal(mateStatus.winner, 'b');
    assert.equal(mateStatus.result, '0-1');
    assert.ok(mateStatus.pgn.endsWith('0-1'));

    // Resignation result & PGN tag
    rules.reset();
    rules.executeMoveByAlgebraic('d4');
    const resignStatus = rules.resign('w');
    assert.equal(resignStatus.isGameOver, true);
    assert.equal(resignStatus.winner, 'b');
    assert.equal(resignStatus.termination, 'Resignation');
    assert.equal(resignStatus.pgn, '1. d4 0-1');

    // Claimable threefold repetition draw
    rules.reset();
    for (const san of ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8']) {
      assert.ok(rules.executeMoveByAlgebraic(san));
    }
    const repStatus = rules.getStatus();
    assert.equal(repStatus.canClaimDraw, true);
    assert.equal(repStatus.claimReason, 'Threefold Repetition');
    const drawClaimed = rules.claimDraw();
    assert.ok(drawClaimed);
    assert.equal(drawClaimed.isGameOver, true);
    assert.equal(drawClaimed.result, '1/2-1/2');
    assert.ok(drawClaimed.pgn.endsWith('1/2-1/2'));

    // Direct SAN and coordinate/UCI move resolution (supports keyboard + robotic arm command inputs)
    rules.reset();
    const coordMove = rules.resolveMoveNotation('e2e4');
    assert.deepEqual(coordMove, { fromR: 6, fromC: 4, toR: 4, toC: 4, promotion: undefined });
    rules.executeMove(coordMove.fromR, coordMove.fromC, coordMove.toR, coordMove.toC);

    const sanMove = rules.resolveMoveNotation('e5');
    assert.deepEqual(sanMove, { fromR: 1, fromC: 4, toR: 3, toC: 4, promotion: undefined });
    assert.equal(rules.resolveMoveNotation('Ke8'), null);

    // Controller multi-arena switching & direct notation execution
    const { createFallbackChessController } = await vite.ssrLoadModule('/src/engine/fallbackEngine.ts');
    const ctrl = createFallbackChessController({
      initialSettings: { arenaId: 'robotics', playMode: 'local' },
    });
    assert.equal(ctrl.getSnapshot().arenaId, 'robotics');
    assert.equal(ctrl.submitMoveNotation('d2-d4'), true);
    assert.equal(ctrl.submitMoveNotation('Nf6'), true);
    assert.equal(ctrl.getSnapshot().moves.length, 2);
    ctrl.setArena('cathedral');
    assert.equal(ctrl.getSnapshot().arenaId, 'cathedral');
    assert.equal(ctrl.getSnapshot().moves.length, 2);
    ctrl.destroy();

    const { soundFx } = await vite.ssrLoadModule('/src/engine/soundFx.ts');
    soundFx.setArena('robotics');
    assert.equal(soundFx.getArena(), 'robotics');
    soundFx.setArena('cathedral');
    assert.equal(soundFx.getArena(), 'cathedral');
    soundFx.play('select');
  } finally {
    await vite.close();
  }
});

