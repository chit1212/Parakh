// Browser only: ask the server to build an export, then save it.
import type { Snapshot } from "./award";

/** Ask the server to build the file, then hand it to the browser to save. */
export async function download(s: Snapshot, format: "xlsx" | "pdf") {
  const res = await fetch("/api/export", { method: "POST", body: JSON.stringify({ snapshot: s, format }) });
  if (!res.ok) return;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `${s.eventId}_award_${s.id}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}
