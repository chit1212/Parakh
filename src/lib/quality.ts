// Quality questionnaire (pass rule from the RFQ), checked in code from what was read.
// Code checks Q1 (a valid ISO 9001 certificate) and Q2 (a test report within 12 months of the RFQ)
// itself, and marks every answer against the buyer's marking scheme for a score out of 100 (L26).
import { DEFAULT_SCHEME, markAnswer, type QualityScheme } from "./qualityScheme";
import type { ReplyReading } from "./reader/pipeline";
import type { SourcingEvent } from "./types";

export interface Quality {
  vendorId: string;
  returned: boolean;
  iso: { pass: boolean; why: string };
  testReport: { pass: boolean; why: string };
  /** Score out of 100 against the marking scheme; null if the questionnaire was not returned. */
  score: number | null;
  passMark: number;
  /** Each question as marked: points earned, points possible, and what was read. */
  items: { id: string; pts: number; of: number; why: string; mandatory: boolean }[];
  /** Mandatory items that failed. */
  mandatoryFailed: number;
  cleared: boolean;
  /** One line for the buyer: why the vendor is or is not quality-cleared. */
  why: string;
}

const DATE = /(\d{1,2}\s+[A-Z][a-z]{2,8}\s+\d{4})/;
const when = (s: string | null | undefined) => {
  const m = s?.match(DATE)?.[1];
  const t = m ? Date.parse(m) : NaN;
  return Number.isNaN(t) ? null : { t, text: m! };
};

export function qualityOf(ev: SourcingEvent, vendorId: string, readings: ReplyReading[], scheme: QualityScheme = DEFAULT_SCHEME): Quality {
  const mine = readings.filter((r) => r.vendorId === vendorId && r.status !== "error");
  const answers = mine.flatMap((r) => r.questionnaire);
  const docs = mine.flatMap((r) => r.qualityDocs);
  const returned = answers.length > 0;
  const issued = Date.parse(ev.issued);

  // Q1: an ISO 9001 certificate valid on the RFQ date (attached, or its number and expiry stated).
  const cert = docs.find((d) => d.kind === "iso_certificate");
  const q1 = answers.find((a) => a.question_id === "Q1");
  const certValid = when(cert?.valid_until) ?? when(q1?.answer.match(/valid (?:to|until|till)\s+(.+)/i)?.[1]);
  const iso = !returned ? { pass: false, why: "no questionnaire" }
    : certValid && certValid.t >= issued ? { pass: true, why: `ISO 9001 valid to ${certValid.text}` }
    : certValid ? { pass: false, why: `ISO 9001 expired ${certValid.text}` }
    : { pass: false, why: `no ISO 9001 certificate${q1 ? ` (“${q1.answer}”)` : ""}` };

  // Q2: a strength test report dated within 12 months before the RFQ.
  const report = docs.find((d) => d.kind === "test_report");
  const q2 = answers.find((a) => a.question_id === "Q2");
  const tested = when(report?.date) ?? when(q2?.answer);
  const yearBefore = issued - 365 * 864e5;
  const testReport = !returned ? { pass: false, why: "no questionnaire" }
    : tested && tested.t >= yearBefore ? { pass: true, why: `test report ${tested.text}` }
    : tested ? { pass: false, why: `test report dated ${tested.text}, older than 12 months` }
    : { pass: false, why: "no test report" };

  // Mark every answer against the scheme. Code does the sums; the answers are as read.
  const items = scheme.rules.map((r) => {
    const a = answers.find((x) => x.question_id === r.id)?.answer ?? null;
    const m = !returned ? { pts: 0, why: "not returned" } : markAnswer(r, a, r.how === "check_iso" ? iso : r.how === "check_test_report" ? testReport : undefined);
    return { id: r.id, pts: m.pts, of: r.points, why: m.why, mandatory: r.mandatory };
  });
  const score = returned ? items.reduce((t, x) => t + x.pts, 0) : null;
  const failed = items.filter((x) => x.mandatory && x.pts === 0);
  const cleared = returned && !failed.length && score! >= scheme.passMark;
  const why = !returned ? "questionnaire not returned"
    : cleared ? `scored ${score} of 100 (pass mark ${scheme.passMark}); ${iso.why}; ${testReport.why}`
    : [
        score! < scheme.passMark ? `scored ${score}, below the pass mark of ${scheme.passMark}` : `scored ${score}`,
        ...failed.map((x) => (x.id === scheme.rules.find((r) => r.how === "check_iso")?.id ? iso.why : x.id === scheme.rules.find((r) => r.how === "check_test_report")?.id ? testReport.why : `${x.id} (mandatory): ${x.why}`)),
      ].join("; ");
  return { vendorId, returned, iso, testReport, score, passMark: scheme.passMark, items, mandatoryFailed: failed.length, cleared, why };
}
