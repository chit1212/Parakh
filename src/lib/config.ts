// One place for every model name and every demo assumption the app relies on.

export const MODELS = {
  /** Reading documents (extraction and the terms sweep) and the analyst chat. */
  reader: "claude-sonnet-5-5",
  /** Cheap steps: deciding what kind of document an email or file is. */
  classifier: "claude-haiku-5-5",
} as const;

/**
 * USD reference rate shown to the buyer next to every converted number.
 * Demo assumption (see dataset/README.md); vendors invoice at the invoice-date rate.
 */
export const USD_REFERENCE = { rate: 88.2, date: "01 Oct 2026" } as const;

/**
 * Should-cost library (demo assumptions, from dataset/README.md).
 * Box weight = blank area x board GSM x 1.04, where board GSM counts each fluted
 * layer with its flute take-up factor.
 */
export const SHOULD_COST = {
  /** INR per kg of finished box, by ply count. */
  ratePerKg: { 3: 38.5, 5: 42.5, 7: 45 } as Record<number, number>,
  /** Printing: fixed + per-m2 cost, per colour. */
  printFixedPerColour: 0.12,
  printPerM2PerColour: 0.25,
  /** Die-cutting, per piece, for die-cut items. */
  dieCutPerPiece: 0.15,
  /** Flute take-up factors (corrugated medium length per unit of board). */
  fluteTakeUp: { B: 1.32, C: 1.45, E: 1.27 } as Record<string, number>,
  /** Allowance for glue, joint and trim on top of board weight. */
  weightAllowance: 1.04,
  /** RSC blank: (2L + 2W + glue flap) x (W + H), in mm. */
  rscGlueFlapMm: 35,
  /** A price more than this far from should-cost is flagged as unusual. */
  band: 0.12,
} as const;

export const DATASET_DIR = "dataset";

/** Max characters of a single parsed text file sent to the model (guards cost; the dataset is far below this). */
export const MAX_DOC_CHARS = 120_000;
