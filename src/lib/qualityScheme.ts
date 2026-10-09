// L26 quality marking scheme (design: RFQ → Evaluation rules → Quality score). The RFQ asks the
// questions; this says how each answer is marked. Code marks every reply against it; the AI only
// drafts changes to it, which the buyer sees and accepts (see /api/rules).

export interface Band { atLeast?: number; atMost?: number; pts: number }

export interface MarkRule {
  /** The RFQ question this marks, e.g. "Q5". */
  id: string;
  mandatory: boolean;
  /** Most points this question can earn. */
  points: number;
  /**
   * How code marks the answer:
   * - check_iso / check_test_report: the mandatory document checks (valid ISO 9001; test report within 12 months)
   * - number: the first number in the answer, against the bands
   * - count: how many items the answer names ("two", "one"; "on request" counts as none), against the bands
   * - yes_no: full points if the answer starts with yes
   */
  how: "check_iso" | "check_test_report" | "number" | "count" | "yes_no";
  /** number / count: the first band that holds gives its points; none holding gives 0. */
  bands?: Band[];
  /** What the number is, for the marking text, e.g. "t a month", "days", "%". */
  unit?: string;
  /** Extra points when the answer names this, and does not negate it (e.g. "FSC", not "FSC not certified"). */
  bonus?: { word: string; pts: number }[];
  /** Set when the last change to this row came from the plain-words box. */
  changedByChat?: boolean;
}

export interface QualityScheme { passMark: number; rules: MarkRule[] }

export const SCHEME_KEY = "parakh-quality-scheme";

/** Parakh's draft for the eight questions in the SE-2026-041 questionnaire. 100 points; pass mark 70. */
export const DEFAULT_SCHEME: QualityScheme = {
  passMark: 70,
  rules: [
    { id: "Q1", mandatory: true, points: 15, how: "check_iso" },
    { id: "Q2", mandatory: true, points: 15, how: "check_test_report" },
    { id: "Q3", mandatory: false, points: 15, how: "number", unit: "t a month", bands: [{ atLeast: 400, pts: 15 }, { atLeast: 300, pts: 10 }, { atLeast: 150, pts: 5 }] },
    { id: "Q4", mandatory: false, points: 10, how: "number", unit: "days", bands: [{ atMost: 14, pts: 10 }, { atMost: 21, pts: 5 }] },
    { id: "Q5", mandatory: false, points: 20, how: "number", unit: "%", bands: [{ atMost: 0.5, pts: 20 }, { atMost: 1, pts: 15 }, { atMost: 1.5, pts: 10 }, { atMost: 2, pts: 5 }] },
    { id: "Q6", mandatory: false, points: 5, how: "yes_no" },
    { id: "Q7", mandatory: false, points: 10, how: "number", unit: "% recycled", bands: [{ atLeast: 50, pts: 5 }], bonus: [{ word: "FSC", pts: 5 }] },
    { id: "Q8", mandatory: false, points: 10, how: "count", unit: "references", bands: [{ atLeast: 2, pts: 10 }, { atLeast: 1, pts: 5 }] },
  ],
};

const fmt = (n: number) => String(n);
const unitSuffix = (u?: string) => (!u ? "" : u.startsWith("%") ? u.replace(/^% ?/, "% ").trimEnd() : ` ${u}`);

/** The marking in words, generated from the rule so the table always says what code does. */
export function markingText(r: MarkRule): string {
  if (r.how === "check_iso") return "Valid ISO 9001 certificate on the RFQ date — pass / fail";
  if (r.how === "check_test_report") return "Test report dated within 12 months of the RFQ — pass / fail";
  if (r.how === "yes_no") return `Yes: ${r.points} · no: 0`;
  const u = unitSuffix(r.unit);
  const parts = (r.bands ?? []).map((b) =>
    b.atLeast != null && b.atMost != null ? `${fmt(b.atLeast)}–${fmt(b.atMost)}${u}: ${b.pts}`
    : b.atLeast != null ? `≥ ${fmt(b.atLeast)}${u}: ${b.pts}`
    : `≤ ${fmt(b.atMost!)}${u}: ${b.pts}`);
  for (const x of r.bonus ?? []) parts.push(`${x.word} named: +${x.pts}`);
  parts.push(r.how === "count" ? "none named: 0" : "otherwise or not stated: 0");
  if (r.how === "count") return parts.join(" · ").replace(/≥ 1 (\w+?)s:/, "≥ 1 $1:");
  return parts.join(" · ");
}

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, single: 1 };

/** The number an answer states, or null. Commas are thousands separators. */
export function numberIn(answer: string): number | null {
  const m = answer.replace(/(\d),(\d{3})/g, "$1$2").match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** How many items an answer names: digits or number words; "on request" alone names none. */
export function countIn(answer: string): number {
  const n = answer.match(/\b(\d+)\b/)?.[1];
  if (n) return Number(n);
  const w = answer.toLowerCase().match(/\b(one|two|three|four|five|six|single)\b/)?.[1];
  if (w) return WORDS[w];
  return 0;
}

/** True if the answer names the word in a clause that does not negate it. */
export function names(answer: string, word: string): boolean {
  return answer.split(/[;,.]/).some((clause) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(clause) && !/\b(not|no|without|none)\b/i.test(clause));
}

const holds = (b: Band, x: number) => (b.atLeast == null || x >= b.atLeast) && (b.atMost == null || x <= b.atMost);

/** Marks one answer. `check` is the result of the document check for the two check rules. */
export function markAnswer(r: MarkRule, answer: string | null, check?: { pass: boolean; why: string }): { pts: number; why: string } {
  if (r.how === "check_iso" || r.how === "check_test_report") {
    return check?.pass ? { pts: r.points, why: check.why } : { pts: 0, why: check?.why ?? "not answered" };
  }
  if (!answer) return { pts: 0, why: "not answered" };
  if (r.how === "yes_no") return /^\s*yes\b/i.test(answer) ? { pts: r.points, why: "yes" } : { pts: 0, why: "no" };
  const x = r.how === "count" ? countIn(answer) : numberIn(answer);
  let pts = 0;
  const why: string[] = [];
  if (x == null) why.push("no number stated");
  else {
    const band = (r.bands ?? []).find((b) => holds(b, x));
    pts += band?.pts ?? 0;
    why.push(r.how === "count" ? `${fmt(x)} named` : `${fmt(x)}${unitSuffix(r.unit)}`);
  }
  for (const b of r.bonus ?? []) if (names(answer, b.word)) { pts += b.pts; why.push(`${b.word} named`); }
  return { pts: Math.min(pts, r.points), why: why.join(", ") };
}

/** A scheme as stored or proposed, checked before code uses it. Returns problems in words. */
export function schemeProblems(s: QualityScheme, questionIds: string[]): string[] {
  const out: string[] = [];
  if (!(s.passMark >= 0 && s.passMark <= 100)) out.push("The pass mark must be between 0 and 100.");
  const total = s.rules.reduce((a, r) => a + (Number.isFinite(r.points) ? r.points : 0), 0);
  if (total !== 100) out.push(`Points add up to ${total}, not 100.`);
  for (const r of s.rules) {
    if (!questionIds.includes(r.id)) out.push(`${r.id} is not a question in this RFQ.`);
    if (!(r.points >= 0)) out.push(`${r.id}: points must be zero or more.`);
    for (const b of r.bands ?? []) {
      if (b.atLeast == null && b.atMost == null) out.push(`${r.id}: a band needs a lower or upper limit.`);
      if (b.pts > r.points) out.push(`${r.id}: a band gives ${b.pts} points, more than the question's ${r.points}.`);
    }
  }
  for (const id of questionIds) if (!s.rules.some((r) => r.id === id)) out.push(`${id} has no marking.`);
  return out;
}

export function loadScheme(): QualityScheme {
  try {
    const s = localStorage.getItem(SCHEME_KEY);
    if (s) return JSON.parse(s) as QualityScheme;
  } catch { /* none saved */ }
  return DEFAULT_SCHEME;
}
