import React, { useMemo, useState } from 'react';
import { rcToSquare, type BoardCell, type LegalTargetMove } from '../engine/chessRules';

interface Board2DFallbackProps {
  boardMatrix: (BoardCell | null)[][];
  flipped: boolean;
  turn: 'w' | 'b';
  interactive: boolean;
  highlightedMove: { fromSq: string; toSq: string } | null;
  getLegalMoves: (r: number, c: number) => LegalTargetMove[];
  onMoveAttempt: (fromR: number, fromC: number, toR: number, toC: number) => void;
  fallbackReason?: string | null;
}

const PIECE_UNICODE: Record<'w' | 'b', Record<string, string>> = {
  w: {
    king: '♔',
    queen: '♕',
    rook: '♖',
    bishop: '♗',
    knight: '♘',
    pawn: '♙',
  },
  b: {
    king: '♚',
    queen: '♛',
    rook: '♜',
    bishop: '♝',
    knight: '♞',
    pawn: '♟',
  },
};

export const Board2DFallback: React.FC<Board2DFallbackProps> = ({
  boardMatrix,
  flipped,
  turn,
  interactive,
  highlightedMove,
  getLegalMoves,
  onMoveAttempt,
  fallbackReason,
}) => {
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);

  const legalMoves = useMemo(() => {
    if (!selected || !interactive) return [];
    return getLegalMoves(selected.r, selected.c);
  }, [selected, interactive, getLegalMoves, boardMatrix]);

  const legalTargetMap = useMemo(() => {
    const map = new Map<string, LegalTargetMove>();
    for (const m of legalMoves) {
      map.set(`${m.r},${m.c}`, m);
    }
    return map;
  }, [legalMoves]);

  const displayRows = useMemo(() => {
    const arr = [0, 1, 2, 3, 4, 5, 6, 7];
    return flipped ? [...arr].reverse() : arr;
  }, [flipped]);

  const displayCols = useMemo(() => {
    const arr = [0, 1, 2, 3, 4, 5, 6, 7];
    return flipped ? [...arr].reverse() : arr;
  }, [flipped]);

  const handleSquareClick = (r: number, c: number) => {
    if (!interactive) return;

    if (selected) {
      const targetMove = legalTargetMap.get(`${r},${c}`);
      if (targetMove) {
        setSelected(null);
        onMoveAttempt(selected.r, selected.c, r, c);
        return;
      }
      if (selected.r === r && selected.c === c) {
        setSelected(null);
        return;
      }
    }

    const piece = boardMatrix[r]?.[c];
    if (piece && piece.color === turn) {
      setSelected({ r, c });
    } else {
      setSelected(null);
    }
  };

  return (
    <div id="board-2d-fallback" className="board-2d-stage" role="region" aria-label="2D Chessboard">
      {fallbackReason && (
        <div className="board-2d-notice" role="status">
          {fallbackReason}
        </div>
      )}
      <div className="board-2d-frame">
        <div className="board-2d-grid" role="grid" aria-label="Chess squares">
          {displayRows.map((r) =>
            displayCols.map((c) => {
              const sqName = rcToSquare(r, c);
              const isLight = (r + c) % 2 === 0;
              const cell = boardMatrix[r]?.[c];
              const isSelected = selected?.r === r && selected?.c === c;
              const legalMove = legalTargetMap.get(`${r},${c}`);
              const isHistoryFrom = highlightedMove?.fromSq === sqName;
              const isHistoryTo = highlightedMove?.toSq === sqName;

              return (
                <button
                  key={sqName}
                  type="button"
                  data-square={sqName}
                  className={[
                    'board-2d-sq',
                    isLight ? 'light' : 'dark',
                    isSelected ? 'selected' : '',
                    legalMove ? (legalMove.capture ? 'legal-capture' : 'legal-move') : '',
                    isHistoryFrom ? 'history-from' : '',
                    isHistoryTo ? 'history-to' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-label={`${sqName}${cell ? ` ${cell.color === 'w' ? 'White' : 'Black'} ${cell.type}` : ''}`}
                  onClick={() => handleSquareClick(r, c)}
                >
                  <span className="sq-coord">{sqName}</span>
                  {cell && (
                    <span className={`sq-piece ${cell.color === 'w' ? 'white' : 'black'}`}>
                      {PIECE_UNICODE[cell.color][cell.type]}
                    </span>
                  )}
                  {legalMove && !cell && <span className="sq-legal-dot" aria-hidden="true" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
