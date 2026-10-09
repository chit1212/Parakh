// Quality questionnaire (pass rule from the RFQ), checked in code from what was read.
// The parts code can check on its own: returned, Q1 a valid ISO 9001 certificate, Q2 a test report
// within 12 months of the RFQ. The 0-100 score needs a marking scheme the RFQ does not give (L26).
import type { ReplyReading } from "./reader/pipeline";
import type { SourcingEvent } from "./types";

export interface Quality {
  vendorId: string;
  returned: boolean;
  iso: { pass: boolean; why: string };
  testReport: { pass: boolean; why: string };
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

export function qualityOf(ev: SourcingEvent, vendorId: string, readings: ReplyReading[]): Quality {
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

  const cleared = returned && iso.pass && testReport.pass;
  const why = !returned ? "questionnaire not returned"
    : cleared ? `${iso.why}; ${testReport.why}`
    : [iso, testReport].filter((x) => !x.pass).map((x) => x.why).join("; ");
  return { vendorId, returned, iso, testReport, cleared, why };
}
