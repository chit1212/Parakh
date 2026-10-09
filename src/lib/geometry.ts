// Box geometry and should-cost, computed in code from the RFQ spec. Never by the model.
import { SHOULD_COST } from "./config";

export interface ParsedSpec {
  ply: string;
  plyN: number;
  flutes: string[];
  layersGsm: number[];
  colours: number;
}

/** Parse "5-ply BC, 180/120/120/120/150 GSM, top 20 BF, flutes B+C, 1-colour flexo print". */
export function parseSpec(spec: string): ParsedSpec {
  const ply = spec.match(/(\d)-ply\s+([A-Z]+)/i);
  if (!ply) throw new Error(`No ply in spec: ${spec}`);
  const plyN = Number(ply[1]);
  const flutes = ply[2].toUpperCase().split("");
  const gsm = spec.match(/([\d/]+)\s*GSM/i);
  if (!gsm) throw new Error(`No GSM in spec: ${spec}`);
  const layersGsm = gsm[1].split("/").map(Number);
  if (layersGsm.length !== plyN) throw new Error(`GSM layers (${layersGsm.length}) do not match ply (${plyN}): ${spec}`);
  if (flutes.length !== (plyN - 1) / 2) throw new Error(`Flute count does not match ply: ${spec}`);
  const col = spec.match(/(\d+)-colou?r/i);
  const colours = col ? Number(col[1]) : 0;
  return { ply: `${plyN}-ply ${flutes.join("")}`, plyN, flutes, layersGsm, colours };
}

/** Board grammage per m2: liners as-is, each fluted medium times its take-up factor. */
export function boardGsm(layersGsm: number[], flutes: string[]): number {
  let total = 0;
  let f = 0;
  layersGsm.forEach((g, i) => {
    if (i % 2 === 1) {
      const factor = SHOULD_COST.fluteTakeUp[flutes[f++]];
      if (!factor) throw new Error(`Unknown flute ${flutes[f - 1]}`);
      total += g * factor;
    } else total += g;
  });
  return total;
}

/** Blank area of a regular slotted carton from internal dimensions (mm), in m2. */
export function rscBlankAreaM2(L: number, W: number, H: number): number {
  return ((2 * L + 2 * W + SHOULD_COST.rscGlueFlapMm) * (W + H)) / 1e6;
}

export const round = (x: number, dp: number) => {
  const f = 10 ** dp;
  return Math.round((x + Number.EPSILON) * f) / f;
};

export interface Costing {
  areaM2: number;
  boardGsm: number;
  weightKg: number;
  shouldCost: number;
  shouldCostCalc: string;
}

/** Weight and should-cost for one line. Returns rounded values plus the sum as a readable string. */
export function costLine(input: {
  areaM2: number;
  layersGsm: number[];
  flutes: string[];
  plyN: number;
  colours: number;
  dieCut: boolean;
}): Costing {
  const gsm = boardGsm(input.layersGsm, input.flutes);
  const wt = (input.areaM2 * gsm) / 1000 * SHOULD_COST.weightAllowance;
  const rate = SHOULD_COST.ratePerKg[input.plyN];
  if (!rate) throw new Error(`No should-cost rate for ${input.plyN}-ply`);
  const board = wt * rate;
  const print = input.colours
    ? input.colours * (SHOULD_COST.printFixedPerColour + SHOULD_COST.printPerM2PerColour * input.areaM2)
    : 0;
  const die = input.dieCut ? SHOULD_COST.dieCutPerPiece : 0;
  const sc = board + print + die;
  const parts = [`${round(wt, 3)} kg x ₹${rate}/kg = ${round(board, 2).toFixed(2)}`];
  if (print) parts.push(`print ${input.colours} col = ${round(print, 2).toFixed(2)}`);
  if (die) parts.push(`die-cut ${die.toFixed(2)}`);
  return {
    areaM2: round(input.areaM2, 4),
    boardGsm: round(gsm, 1),
    weightKg: round(wt, 3),
    shouldCost: round(sc, 2),
    shouldCostCalc: `${parts.join(" + ")} → ₹${round(sc, 2).toFixed(2)}`,
  };
}
