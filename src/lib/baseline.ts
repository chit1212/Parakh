// What a comparison is measured against (review fix 1.3). Every answer names its baseline; when the
// question does not say, it is the screen's own eligibility (quality-cleared), never all vendors.
import { LIBRARY, sameRules, type ScenarioRules } from "./scenario";

export type BaselineKey = "as_quoted" | "quality_cleared";
export const BASELINES: Record<BaselineKey, { title: string; rules: ScenarioRules }> = {
  as_quoted: { title: "As quoted, all vendors", rules: LIBRARY.find((x) => x.key === "base")!.rules },
  quality_cleared: { title: "Cheapest per line, quality-cleared only", rules: LIBRARY.find((x) => x.key === "S1")!.rules },
};

export function baselineFor(asked: "as_quoted" | "quality_cleared" | "unstated", rules: ScenarioRules, active: ScenarioRules): BaselineKey {
  if (asked !== "unstated") return asked;
  const own: BaselineKey = active.eligible === "quality_cleared" ? "quality_cleared" : "as_quoted";
  // Comparing a scenario with itself says nothing; then the benchmark is all vendors as quoted.
  return sameRules(BASELINES[own].rules, rules) ? "as_quoted" : own;
}
