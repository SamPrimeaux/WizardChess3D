/**
 * Canonical MeauxChess visual Franka timings.
 * These timestamps drive a presentation animation, not a verified grasp.
 */
export const FRANKA_MOVE_MS = Object.freeze({
  approach: 650,
  touch: 400,
  lift: 340,
  transport: 850,
  lower: 410,
  retreat: 370,
  home: 740,
});

export const FRANKA_MOVE_TOTAL_MS = Object.values(FRANKA_MOVE_MS).reduce(
  (total, milliseconds) => total + milliseconds,
  0,
);
