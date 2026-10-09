// What the browser gets about a reply: names and kinds, never file contents.
import type { ReplyReading } from "./reader/pipeline";
import type { Reply, SourcingEvent } from "./types";

export interface FileSummary {
  name: string;
  kind: string;
  path: string;
  bytes: number;
  broken: boolean;
  pages: number | null;
}

export interface ReplySummary {
  id: string;
  vendorId: string | null;
  vendorName: string | null;
  contact: string | null;
  receivedAt: string | null;
  from: string | null;
  subject: string | null;
  cover: FileSummary | null;
  files: FileSummary[];
  origin: "demo" | "upload";
}

const fs = (f: Reply["files"][number]): FileSummary => ({
  name: f.name, kind: f.kind, path: f.path, bytes: f.bytes, broken: Boolean(f.parseError), pages: f.pdfPages?.length ?? null,
});

export function summarise(r: Reply, ev: SourcingEvent): ReplySummary {
  const v = ev.vendors.find((x) => x.id === r.vendorId);
  return {
    id: r.id, vendorId: r.vendorId, vendorName: v?.name ?? null, contact: v?.contact ?? null,
    receivedAt: r.receivedAt, from: r.from, subject: r.subject,
    cover: r.cover ? fs(r.cover) : null, files: r.files.map(fs), origin: r.origin,
  };
}

/** The file that carries the quote: the first attachment the sorter called a quote, else the first file. */
export function mainFile(r: ReplySummary, reading: ReplyReading | null): FileSummary | null {
  const quoteName = reading?.classification?.files.find((f) => f.role === "quote")?.name;
  if (quoteName) return r.files.find((f) => f.name === quoteName) ?? r.files[0] ?? r.cover;
  // Before the reply is sorted: skip files whose names say they are supporting documents.
  const support = /certificate|test.?report|questionnaire|iso/i;
  return r.files.find((f) => !support.test(f.name)) ?? r.files[0] ?? r.cover;
}
