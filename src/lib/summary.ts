// What the browser gets about a reply: names and kinds, never file contents.
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
