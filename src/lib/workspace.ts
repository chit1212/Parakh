// L28 events workspace. The demo has one live event (SE-2026-041) and last year's (SE-2025-037),
// both from dataset/. These other rows are display-only stubs (plumbing may be stubbed) so the
// home screen looks like a buyer's real workspace; they open nothing.
export interface StubEvent {
  id: string;
  name: string;
  cat: string;
  status: "Drafting" | "Collecting replies" | "Comparing" | "Awaiting approval" | "Awarded" | "Closed";
  lines: number;
  replies: string;
  valueInr: number | null;
  due: string;
  note: string;
}

export const STUB_EVENTS: StubEvent[] = [
  { id: "SE-2026-044", name: "BOPP tape & stretch film", cat: "Packaging", status: "Collecting replies", lines: 12, replies: "3 of 6 replied", valueInr: 3820000, due: "Closes 14 Oct", note: "3 awaiting" },
  { id: "SE-2026-046", name: "EPS foam inserts, fans", cat: "Packaging", status: "Drafting", lines: 18, replies: "Not sent", valueInr: null, due: "Send by 12 Oct", note: "RFQ 70% drafted" },
  { id: "SE-2026-038", name: "Moulded pulp trays", cat: "Packaging", status: "Awaiting approval", lines: 6, replies: "4 of 4 replied", valueInr: 2140000, due: "With VP since 6 Oct", note: "Split award, 2 vendors" },
  { id: "SE-2026-029", name: "Printed manuals & warranty cards", cat: "Print", status: "Awarded", lines: 22, replies: "5 of 5 replied", valueInr: 1960000, due: "Awarded 21 Aug 2026", note: "Kalpana Offset" },
  { id: "SE-2026-019", name: "Pallets, heat-treated", cat: "Logistics", status: "Closed", lines: 3, replies: "2 of 5 replied", valueInr: null, due: "Closed 2 Jun 2026", note: "Re-run as SE-2026-026" },
];
