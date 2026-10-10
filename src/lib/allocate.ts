// Exact allocation under constraints (L25, review fix 1.2). Each line goes to exactly one vendor; no
// vendor may take more than `cap` of the award value; at most `maxVendors` vendors. A small integer
// program (≤ 30 lines × 5 vendors) solved to proven optimality by branch and bound, then checked
// independently: if any single-line move to a cheaper vendor still meets the constraints, the result
// is not the cheapest and says so. Code only; the model never allocates.
import solver from "javascript-lp-solver";

export interface Option { v: string; p: number }
export interface AllocLine { lineId: string; qty: number; options: Option[] }
export type AllocStatus = "proven_optimal" | "feasible" | "infeasible";
export interface Allocation {
  /** Chosen vendor per line (null: no eligible price). */
  pick: Record<string, Option | null>;
  status: AllocStatus;
  /** The independent check: a cheaper single-line move that still meets the constraints, if one exists. */
  selfCheck: { passed: boolean; move?: string };
}

const SCALE = 1e5; // rupees → lakh, to keep the tableau well conditioned
const TIMEOUT_MS = 3000;

function totals(lines: AllocLine[], pick: Record<string, Option | null>) {
  const by: Record<string, number> = {};
  let total = 0;
  for (const l of lines) {
    const o = pick[l.lineId];
    if (!o) continue;
    by[o.v] = (by[o.v] ?? 0) + o.p * l.qty;
    total += o.p * l.qty;
  }
  return { by, total };
}

export function meets(lines: AllocLine[], pick: Record<string, Option | null>, cap: number | null, maxVendors: number | null): boolean {
  const { by, total } = totals(lines, pick);
  if (cap != null && Object.values(by).some((x) => x > cap * total + 1e-6)) return false;
  if (maxVendors != null && Object.values(by).filter((x) => x > 0).length > maxVendors) return false;
  return true;
}

/** Every single-line move to a cheaper vendor; the first one that still meets the constraints proves the pick is not cheapest. */
export function cheaperMove(lines: AllocLine[], pick: Record<string, Option | null>, cap: number | null, maxVendors: number | null): string | null {
  for (const l of lines) {
    const cur = pick[l.lineId];
    if (!cur) continue;
    for (const o of l.options) {
      if (o.p >= cur.p - 1e-9) continue;
      const next = { ...pick, [l.lineId]: o };
      if (meets(lines, next, cap, maxVendors))
        return `${l.lineId} ${cur.v} → ${o.v} saves ₹${Math.round((cur.p - o.p) * l.qty).toLocaleString("en-IN")} and still meets the constraints`;
    }
  }
  return null;
}

export function allocate(lines: AllocLine[], cap: number | null, maxVendors: number | null, timeoutMs = TIMEOUT_MS): Allocation {
  const live = lines.filter((l) => l.options.length);
  const empty = Object.fromEntries(lines.map((l) => [l.lineId, null])) as Record<string, Option | null>;
  const cheapest = { ...empty, ...Object.fromEntries(live.map((l) => [l.lineId, [...l.options].sort((a, b) => a.p - b.p)[0]])) };
  // No constraint, or the cheapest pick already meets them: cheapest per line is optimal by construction.
  if (meets(lines, cheapest, cap, maxVendors)) return { pick: cheapest, status: "proven_optimal", selfCheck: { passed: true } };

  const vendors = [...new Set(live.flatMap((l) => l.options.map((o) => o.v)))];
  const model: Parameters<typeof solver.Solve>[0] = { optimize: "cost", opType: "min", constraints: {}, variables: {}, ints: {}, options: { timeout: timeoutMs } };
  for (const l of live) {
    model.constraints[`line_${l.lineId}`] = { equal: 1 };
    for (const o of l.options) {
      const name = `x_${l.lineId}_${o.v}`, value = (o.p * l.qty) / SCALE;
      const vars: Record<string, number> = { cost: value, [`line_${l.lineId}`]: 1 };
      // Share cap, linearised: value(v) − cap × total ≤ 0 for every vendor.
      if (cap != null) for (const w of vendors) vars[`cap_${w}`] = w === o.v ? value * (1 - cap) : -cap * value;
      if (maxVendors != null) vars[`use_${o.v}_${l.lineId}`] = 1;
      model.variables[name] = vars;
      model.ints![name] = 1;
    }
  }
  if (cap != null) for (const w of vendors) model.constraints[`cap_${w}`] = { max: 0 };
  if (maxVendors != null) {
    // y_v = 1 if vendor v gets any line; x ≤ y; Σ y ≤ maxVendors.
    model.constraints.vendors = { max: maxVendors };
    for (const w of vendors) {
      const y: Record<string, number> = { vendors: 1 };
      for (const l of live) if (l.options.some((o) => o.v === w)) { model.constraints[`use_${w}_${l.lineId}`] = { max: 0 }; y[`use_${w}_${l.lineId}`] = -1; }
      model.variables[`y_${w}`] = y;
      model.ints![`y_${w}`] = 1;
      model.constraints[`ybound_${w}`] = { max: 1 };
      y[`ybound_${w}`] = 1;
    }
  }
  const started = Date.now();
  const r = solver.Solve(model);
  const timedOut = Date.now() - started >= timeoutMs;
  if (!r.feasible) return { pick: cheapest, status: "infeasible", selfCheck: { passed: false, move: "The constraints cannot all be met; shown without the cap." } };
  const pick = { ...empty };
  for (const l of live) {
    const o = l.options.find((x) => Number(r[`x_${l.lineId}_${x.v}`] ?? 0) > 0.5);
    pick[l.lineId] = o ?? null;
  }
  // Rounding or a timeout can leave a line unassigned; then it is not a proven result.
  const complete = live.every((l) => pick[l.lineId]);
  if (!complete || !meets(lines, pick, cap, maxVendors)) return { pick: cheapest, status: "infeasible", selfCheck: { passed: false, move: "The solver returned no allocation that meets the constraints." } };
  const move = cheaperMove(lines, pick, cap, maxVendors);
  return { pick, status: move || timedOut ? "feasible" : "proven_optimal", selfCheck: move ? { passed: false, move } : { passed: true } };
}
