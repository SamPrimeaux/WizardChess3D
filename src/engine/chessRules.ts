import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';
import type { RecordedMove } from './storage';

export type EnginePieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
export type EnginePromoChar = 'q' | 'r' | 'b' | 'n';

export const SYMBOL_TO_TYPE: Record<PieceSymbol, EnginePieceType> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

export const TYPE_TO_SYMBOL: Record<EnginePieceType, PieceSymbol> = {
  pawn: 'p',
  knight: 'n',
  bishop: 'b',
  rook: 'r',
  queen: 'q',
  king: 'k',
};

export const PROMO_CHAR_TO_TYPE: Record<EnginePromoChar, EnginePieceType> = {
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
};

export interface BoardCell {
  type: EnginePieceType;
  symbol: PieceSymbol;
  color: Color;
  r: number;
  c: number;
  square: Square;
}

export interface LegalTargetMove {
  from: Square;
  to: Square;
  fromR: number;
  fromC: number;
  r: number;
  c: number;
  san: string;
  capture: boolean;
  isEnPassant: boolean;
  castle: 'k' | 'q' | null;
  rookFromC?: number;
  rookToC?: number;
  isPromotion: boolean;
  promotion?: EnginePromoChar;
}

export interface ExecutedMoveResult {
  move: RecordedMove;
  capturedSquare: { r: number; c: number } | null;
  rookMove: { row: number; fromC: number; toC: number } | null;
  fen: string;
  pgn: string;
}

export interface CapturedSummary {
  byWhite: EnginePieceType[];
  byBlack: EnginePieceType[];
  whiteAdvantage: number;
  blackAdvantage: number;
}

export type GameTerminationReason =
  | 'Checkmate'
  | 'Stalemate'
  | 'Time Expired'
  | 'Resignation'
  | 'Threefold Repetition'
  | '50-Move Rule'
  | 'Insufficient Material'
  | 'Draw Claimed'
  | null;

export interface GameStatusSnapshot {
  fen: string;
  pgn: string;
  turn: Color;
  moveNumber: number;
  halfMoveClock: number;
  inCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isInsufficientMaterial: boolean;
  isThreefoldRepetition: boolean;
  isFiftyMoveRule: boolean;
  canClaimDraw: boolean;
  claimReason: 'Threefold Repetition' | '50-Move Rule' | null;
  isGameOver: boolean;
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  winner: Color | null;
  termination: GameTerminationReason;
}

const PIECE_MATERIAL_WEIGHTS: Record<EnginePieceType, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 0,
};

const STARTING_COUNTS: Record<Exclude<EnginePieceType, 'king'>, number> = {
  queen: 1,
  rook: 2,
  bishop: 2,
  knight: 2,
  pawn: 8,
};

export function rcToSquare(r: number, c: number): Square {
  const file = String.fromCharCode(97 + Math.max(0, Math.min(7, c)));
  const rank = String(8 - Math.max(0, Math.min(7, r)));
  return `${file}${rank}` as Square;
}

export function squareToRc(sq: string): { r: number; c: number } {
  const c = sq.charCodeAt(0) - 97;
  const r = 8 - parseInt(sq[1], 10);
  return { r, c };
}

export function normalizePromotionType(promo?: string | null): EnginePromoChar {
  if (!promo) return 'q';
  const low = promo.toLowerCase();
  if (low === 'r' || low === 'rook') return 'r';
  if (low === 'b' || low === 'bishop') return 'b';
  if (low === 'n' || low === 'knight') return 'n';
  return 'q';
}

function buildRecordedMove(mv: Move, ply: number, fenAfter: string): RecordedMove {
  const fromRc = squareToRc(mv.from);
  const toRc = squareToRc(mv.to);
  const isCastle = mv.flags.includes('k') ? 'k' : mv.flags.includes('q') ? 'q' : null;
  const isEnPassant = mv.flags.includes('e');
  const isCapture = Boolean(mv.captured) || isEnPassant;
  return {
    ply,
    moveNumber: Math.floor((ply - 1) / 2) + 1,
    san: mv.san,
    fromSq: mv.from,
    toSq: mv.to,
    color: mv.color,
    pieceType: SYMBOL_TO_TYPE[mv.piece],
    fromR: fromRc.r,
    fromC: fromRc.c,
    toR: toRc.r,
    toC: toRc.c,
    capture: isCapture,
    capturedType: mv.captured ? SYMBOL_TO_TYPE[mv.captured] : null,
    isEnPassant,
    isCastle,
    promotion: mv.promotion ? SYMBOL_TO_TYPE[mv.promotion] : null,
    fenAfter,
  };
}

export class WizardChessRules {
  private chess: Chess;
  private recordedMoves: RecordedMove[] = [];
  private manualOverride: {
    result: '1-0' | '0-1' | '1/2-1/2';
    winner: Color | null;
    termination: Exclude<GameTerminationReason, null>;
  } | null = null;

  constructor(initialFen?: string) {
    this.chess = new Chess(initialFen);
  }

  reset(fen?: string): void {
    this.chess = fen ? new Chess(fen) : new Chess();
    this.recordedMoves = [];
    this.manualOverride = null;
  }

  loadFen(fen: string): { ok: true } | { ok: false; error: string } {
    try {
      const next = new Chess(fen.trim());
      this.chess = next;
      this.recordedMoves = [];
      this.manualOverride = null;
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Invalid FEN string',
      };
    }
  }

  loadPgn(pgn: string): { ok: true; moves: RecordedMove[] } | { ok: false; error: string } {
    try {
      const parsed = new Chess();
      parsed.loadPgn(pgn);
      const verboseHistory = parsed.history({ verbose: true });

      // Rebuild recordedMoves with accurate per-ply FEN snapshots
      const replay = new Chess();
      const headerFen = parsed.header()?.FEN;
      if (headerFen) replay.load(headerFen);

      const rebuilt: RecordedMove[] = [];
      for (let i = 0; i < verboseHistory.length; i++) {
        const mv = verboseHistory[i];
        const executed = replay.move({
          from: mv.from,
          to: mv.to,
          promotion: mv.promotion,
        });
        rebuilt.push(buildRecordedMove(executed, i + 1, replay.fen()));
      }

      this.chess = parsed;
      this.recordedMoves = rebuilt;
      this.manualOverride = null;
      return { ok: true, moves: [...rebuilt] };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Invalid PGN notation',
      };
    }
  }

  hydrateSavedGame(fen: string, moves: RecordedMove[]): boolean {
    try {
      const candidate = new Chess(fen);
      this.chess = candidate;
      this.recordedMoves = Array.isArray(moves) ? [...moves] : [];
      this.manualOverride = null;
      return true;
    } catch {
      return false;
    }
  }

  getFen(): string {
    return this.chess.fen();
  }

  private resolveResultTag(): '1-0' | '0-1' | '1/2-1/2' | '*' {
    if (this.manualOverride) return this.manualOverride.result;
    if (this.chess.isCheckmate()) return this.chess.turn() === 'w' ? '0-1' : '1-0';
    if (this.chess.isStalemate() || this.chess.isInsufficientMaterial()) return '1/2-1/2';
    const halfMoveClock = parseInt(this.chess.fen().split(' ')[4] || '0', 10) || 0;
    if (halfMoveClock >= 150) return '1/2-1/2';
    return '*';
  }

  getPgn(resultOverride?: '1-0' | '0-1' | '1/2-1/2' | '*'): string {
    if (this.recordedMoves.length === 0) return '';
    const tokens: string[] = [];
    let idx = 0;
    while (idx < this.recordedMoves.length) {
      const first = this.recordedMoves[idx];
      if (first.color === 'w') {
        const second = this.recordedMoves[idx + 1];
        if (second && second.color === 'b') {
          tokens.push(`${first.moveNumber}. ${first.san} ${second.san}`);
          idx += 2;
        } else {
          tokens.push(`${first.moveNumber}. ${first.san}`);
          idx += 1;
        }
      } else {
        tokens.push(`${first.moveNumber}... ${first.san}`);
        idx += 1;
      }
    }
    const result = resultOverride ?? this.resolveResultTag();
    if (result !== '*') {
      tokens.push(result);
    }
    return tokens.join(' ');
  }

  getTurn(): Color {
    return this.chess.turn();
  }

  getBoardMatrix(): (BoardCell | null)[][] {
    const raw = this.chess.board();
    return raw.map((row, r) =>
      row.map((cell, c) => {
        if (!cell) return null;
        return {
          type: SYMBOL_TO_TYPE[cell.type],
          symbol: cell.type,
          color: cell.color,
          r,
          c,
          square: rcToSquare(r, c),
        };
      })
    );
  }

  getLegalMovesFrom(r: number, c: number): LegalTargetMove[] {
    if (this.getStatus().isGameOver) return [];
    const sq = rcToSquare(r, c);
    const verbose = this.chess.moves({ square: sq, verbose: true });
    // Deduplicate destination squares (promotions return 4 entries for the same square)
    const byDest = new Map<string, LegalTargetMove>();
    for (const mv of verbose) {
      const toRc = squareToRc(mv.to);
      const isEnPassant = mv.flags.includes('e');
      const castle = mv.flags.includes('k') ? 'k' : mv.flags.includes('q') ? 'q' : null;
      const isPromotion = mv.flags.includes('p');
      if (!byDest.has(mv.to)) {
        byDest.set(mv.to, {
          from: mv.from,
          to: mv.to,
          fromR: r,
          fromC: c,
          r: toRc.r,
          c: toRc.c,
          san: mv.san,
          capture: Boolean(mv.captured) || isEnPassant,
          isEnPassant,
          castle,
          rookFromC: castle === 'k' ? 7 : castle === 'q' ? 0 : undefined,
          rookToC: castle === 'k' ? 5 : castle === 'q' ? 3 : undefined,
          isPromotion,
          promotion: mv.promotion as EnginePromoChar | undefined,
        });
      }
    }
    return Array.from(byDest.values());
  }

  getAllLegalMoves(): LegalTargetMove[] {
    if (this.getStatus().isGameOver) return [];
    const verbose = this.chess.moves({ verbose: true });
    return verbose.map((mv) => {
      const fromRc = squareToRc(mv.from);
      const toRc = squareToRc(mv.to);
      const isEnPassant = mv.flags.includes('e');
      const castle = mv.flags.includes('k') ? 'k' : mv.flags.includes('q') ? 'q' : null;
      return {
        from: mv.from,
        to: mv.to,
        fromR: fromRc.r,
        fromC: fromRc.c,
        r: toRc.r,
        c: toRc.c,
        san: mv.san,
        capture: Boolean(mv.captured) || isEnPassant,
        isEnPassant,
        castle,
        rookFromC: castle === 'k' ? 7 : castle === 'q' ? 0 : undefined,
        rookToC: castle === 'k' ? 5 : castle === 'q' ? 3 : undefined,
        isPromotion: mv.flags.includes('p'),
        promotion: mv.promotion as EnginePromoChar | undefined,
      };
    });
  }

  needsPromotionChoice(fromR: number, fromC: number, toR: number, toC: number): boolean {
    const fromSq = rcToSquare(fromR, fromC);
    const toSq = rcToSquare(toR, toC);
    const legal = this.chess.moves({ square: fromSq, verbose: true });
    return legal.some((m) => m.to === toSq && m.flags.includes('p'));
  }

  executeMove(
    fromR: number,
    fromC: number,
    toR: number,
    toC: number,
    promotionType?: string
  ): ExecutedMoveResult | null {
    if (this.getStatus().isGameOver) return null;
    const fromSq = rcToSquare(fromR, fromC);
    const toSq = rcToSquare(toR, toC);
    const isPromoMove = this.needsPromotionChoice(fromR, fromC, toR, toC);
    const promoChar = isPromoMove ? normalizePromotionType(promotionType) : undefined;

    try {
      const executed = this.chess.move({
        from: fromSq,
        to: toSq,
        promotion: promoChar,
      });
      const fenAfter = this.chess.fen();
      const recorded = buildRecordedMove(executed, this.recordedMoves.length + 1, fenAfter);
      this.recordedMoves.push(recorded);

      const capturedSquare = recorded.capture
        ? recorded.isEnPassant
          ? { r: fromR, c: toC }
          : { r: toR, c: toC }
        : null;

      const rookMove = recorded.isCastle
        ? {
            row: fromR,
            fromC: recorded.isCastle === 'k' ? 7 : 0,
            toC: recorded.isCastle === 'k' ? 5 : 3,
          }
        : null;

      return {
        move: recorded,
        capturedSquare,
        rookMove,
        fen: fenAfter,
        pgn: this.getPgn(),
      };
    } catch {
      return null;
    }
  }

  resolveMoveNotation(
    notation: string
  ): { fromR: number; fromC: number; toR: number; toC: number; promotion?: EnginePromoChar } | null {
    if (this.getStatus().isGameOver) return null;
    const trimmed = (notation || '').trim();
    if (!trimmed) return null;

    const probe = new Chess(this.chess.fen());
    const cleanedCoord = trimmed.replace(/[-\s]/g, '');
    const coordMatch = /^([a-h][1-8])([a-h][1-8])([qrbnQRBN])?$/.exec(cleanedCoord);

    try {
      let matched: Move;
      if (coordMatch) {
        const from = coordMatch[1] as Square;
        const to = coordMatch[2] as Square;
        const fromRc = squareToRc(from);
        const toRc = squareToRc(to);
        const needPromo = this.needsPromotionChoice(fromRc.r, fromRc.c, toRc.r, toRc.c);
        matched = probe.move({
          from,
          to,
          promotion: needPromo ? normalizePromotionType(coordMatch[3]) : undefined,
        });
      } else {
        matched = probe.move(trimmed);
      }
      const fromRc = squareToRc(matched.from);
      const toRc = squareToRc(matched.to);
      return {
        fromR: fromRc.r,
        fromC: fromRc.c,
        toR: toRc.r,
        toC: toRc.c,
        promotion: matched.promotion ? (matched.promotion as EnginePromoChar) : undefined,
      };
    } catch {
      return null;
    }
  }

  executeMoveByAlgebraic(
    fromOrSan: string,
    toSq?: string,
    promotion?: string
  ): ExecutedMoveResult | null {
    if (this.getStatus().isGameOver) return null;
    try {
      let executed: Move;
      if (toSq) {
        const fromRc = squareToRc(fromOrSan);
        const toRc = squareToRc(toSq);
        const needPromo = this.needsPromotionChoice(fromRc.r, fromRc.c, toRc.r, toRc.c);
        executed = this.chess.move({
          from: fromOrSan as Square,
          to: toSq as Square,
          promotion: needPromo ? normalizePromotionType(promotion) : undefined,
        });
      } else {
        executed = this.chess.move(fromOrSan);
      }
      const fromRc = squareToRc(executed.from);
      const toRc = squareToRc(executed.to);
      const fenAfter = this.chess.fen();
      const recorded = buildRecordedMove(executed, this.recordedMoves.length + 1, fenAfter);
      this.recordedMoves.push(recorded);

      const capturedSquare = recorded.capture
        ? recorded.isEnPassant
          ? { r: fromRc.r, c: toRc.c }
          : { r: toRc.r, c: toRc.c }
        : null;

      const rookMove = recorded.isCastle
        ? {
            row: fromRc.r,
            fromC: recorded.isCastle === 'k' ? 7 : 0,
            toC: recorded.isCastle === 'k' ? 5 : 3,
          }
        : null;

      return {
        move: recorded,
        capturedSquare,
        rookMove,
        fen: fenAfter,
        pgn: this.getPgn(),
      };
    } catch {
      return null;
    }
  }

  undoLastMove(): RecordedMove | null {
    if (this.recordedMoves.length === 0) return null;
    const popped = this.chess.undo();
    if (!popped) return null;
    this.manualOverride = null;
    return this.recordedMoves.pop() || null;
  }

  resign(loserColor: Color): GameStatusSnapshot {
    const winner: Color = loserColor === 'w' ? 'b' : 'w';
    this.manualOverride = {
      result: winner === 'w' ? '1-0' : '0-1',
      winner,
      termination: 'Resignation',
    };
    return this.getStatus();
  }

  setTimeoutWinner(winnerColor: Color): GameStatusSnapshot {
    this.manualOverride = {
      result: winnerColor === 'w' ? '1-0' : '0-1',
      winner: winnerColor,
      termination: 'Time Expired',
    };
    return this.getStatus();
  }

  claimDraw(): GameStatusSnapshot | null {
    const st = this.getStatus();
    if (!st.canClaimDraw) return null;
    this.manualOverride = {
      result: '1/2-1/2',
      winner: null,
      termination: st.claimReason || 'Draw Claimed',
    };
    return this.getStatus();
  }

  getMoves(): RecordedMove[] {
    return [...this.recordedMoves];
  }

  getCapturedSummary(): CapturedSummary {
    const remaining: Record<Color, Record<Exclude<EnginePieceType, 'king'>, number>> = {
      w: { queen: 0, rook: 0, bishop: 0, knight: 0, pawn: 0 },
      b: { queen: 0, rook: 0, bishop: 0, knight: 0, pawn: 0 },
    };

    const board = this.chess.board();
    for (const row of board) {
      for (const cell of row) {
        if (!cell || cell.type === 'k') continue;
        const t = SYMBOL_TO_TYPE[cell.type] as Exclude<EnginePieceType, 'king'>;
        remaining[cell.color][t] += 1;
      }
    }

    const byWhite: EnginePieceType[] = [];
    const byBlack: EnginePieceType[] = [];
    const order: Exclude<EnginePieceType, 'king'>[] = ['queen', 'rook', 'bishop', 'knight', 'pawn'];

    let whiteCapturedVal = 0;
    let blackCapturedVal = 0;

    for (const pt of order) {
      const missingBlack = Math.max(0, STARTING_COUNTS[pt] - remaining.b[pt]);
      for (let i = 0; i < missingBlack; i++) {
        byWhite.push(pt);
        whiteCapturedVal += PIECE_MATERIAL_WEIGHTS[pt];
      }
      const missingWhite = Math.max(0, STARTING_COUNTS[pt] - remaining.w[pt]);
      for (let i = 0; i < missingWhite; i++) {
        byBlack.push(pt);
        blackCapturedVal += PIECE_MATERIAL_WEIGHTS[pt];
      }
    }

    return {
      byWhite,
      byBlack,
      whiteAdvantage: Math.max(0, whiteCapturedVal - blackCapturedVal),
      blackAdvantage: Math.max(0, blackCapturedVal - whiteCapturedVal),
    };
  }

  getStatus(): GameStatusSnapshot {
    const fen = this.chess.fen();
    const parts = fen.split(' ');
    const halfMoveClock = parseInt(parts[4] || '0', 10) || 0;
    const moveNumber = parseInt(parts[5] || '1', 10) || 1;
    const turn = this.chess.turn();
    const inCheck = this.chess.inCheck ? this.chess.inCheck() : this.chess.isCheck();
    const isCheckmate = this.chess.isCheckmate();
    const isStalemate = this.chess.isStalemate();
    const isInsufficientMaterial = this.chess.isInsufficientMaterial();
    const isThreefoldRepetition = this.chess.isThreefoldRepetition();
    const isFiftyMoveRule = this.chess.isDrawByFiftyMoves();

    const claimReason: 'Threefold Repetition' | '50-Move Rule' | null = isThreefoldRepetition
      ? 'Threefold Repetition'
      : isFiftyMoveRule
      ? '50-Move Rule'
      : null;

    if (this.manualOverride) {
      return {
        fen,
        pgn: this.getPgn(this.manualOverride.result),
        turn,
        moveNumber,
        halfMoveClock,
        inCheck,
        isCheckmate,
        isStalemate,
        isInsufficientMaterial,
        isThreefoldRepetition,
        isFiftyMoveRule,
        canClaimDraw: false,
        claimReason: null,
        isGameOver: true,
        result: this.manualOverride.result,
        winner: this.manualOverride.winner,
        termination: this.manualOverride.termination,
      };
    }

    if (isCheckmate) {
      const winner: Color = turn === 'w' ? 'b' : 'w';
      const result = winner === 'w' ? '1-0' : '0-1';
      return {
        fen,
        pgn: this.getPgn(result),
        turn,
        moveNumber,
        halfMoveClock,
        inCheck: true,
        isCheckmate: true,
        isStalemate: false,
        isInsufficientMaterial,
        isThreefoldRepetition,
        isFiftyMoveRule,
        canClaimDraw: false,
        claimReason: null,
        isGameOver: true,
        result,
        winner,
        termination: 'Checkmate',
      };
    }

    if (isStalemate || isInsufficientMaterial) {
      return {
        fen,
        pgn: this.getPgn('1/2-1/2'),
        turn,
        moveNumber,
        halfMoveClock,
        inCheck: false,
        isCheckmate: false,
        isStalemate,
        isInsufficientMaterial,
        isThreefoldRepetition,
        isFiftyMoveRule,
        canClaimDraw: false,
        claimReason: null,
        isGameOver: true,
        result: '1/2-1/2',
        winner: null,
        termination: isStalemate ? 'Stalemate' : 'Insufficient Material',
      };
    }

    // 75-move or fivefold automatic draw if halfMoveClock >= 150
    if (halfMoveClock >= 150) {
      return {
        fen,
        pgn: this.getPgn('1/2-1/2'),
        turn,
        moveNumber,
        halfMoveClock,
        inCheck,
        isCheckmate: false,
        isStalemate: false,
        isInsufficientMaterial: false,
        isThreefoldRepetition,
        isFiftyMoveRule: true,
        canClaimDraw: false,
        claimReason: null,
        isGameOver: true,
        result: '1/2-1/2',
        winner: null,
        termination: '50-Move Rule',
      };
    }

    // Threefold repetition and 50-move rule can be claimed by the player (or auto-drawn via Claim Draw)
    return {
      fen,
      pgn: this.getPgn('*'),
      turn,
      moveNumber,
      halfMoveClock,
      inCheck,
      isCheckmate: false,
      isStalemate: false,
      isInsufficientMaterial: false,
      isThreefoldRepetition,
      isFiftyMoveRule,
      canClaimDraw: Boolean(claimReason),
      claimReason,
      isGameOver: false,
      result: '*',
      winner: null,
      termination: null,
    };
  }
}
