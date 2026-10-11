/**
 * Pacing targets, from docs/generated/research/ATTENTION_AND_PACING.md.
 * Median screen attention is about 40 s (Gloria Mark), so nothing is allowed to go quiet for longer than that.
 */
export const PACING = {
  /** Longest stretch with nothing new happening, in real seconds. Past this the director fills the air. */
  maxQuiet: 34,
  /** Real seconds between one visitor leaving and the next one knocking. */
  gapMin: 12,
  gapMax: 26,
  /** Shift minutes that pass per real second while someone is at the glass. */
  visitRate: 0.14,
  /** Shift minutes per real second once the roster is done and the night runs down to six. */
  tailRate: 0.6,
  /** Shift minutes per real second during the dawn walk. */
  dawnRate: 0.22,
};
