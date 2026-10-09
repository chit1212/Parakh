// Saved readings: the five demo replies (and the failure cases) read once by the real
// pipeline and committed in data/readings/, so the demo opens without spending the free
// quota. Each is stamped with when it was read and by which model, and with a fingerprint
// of the reply's files: if a file changes, its saved reading is no longer shown.
import fs from "node:fs/promises";
import path from "node:path";
import type { ReplyReading } from "./reader/pipeline";
import { hashOf } from "./reader/call";
import type { Reply } from "./types";

export const READINGS_DIR = path.join(process.cwd(), "data", "readings");

interface SavedFile {
  replyId: string;
  /** When the model read the reply, and which models answered. Repeated from the reading for anyone opening the file. */
  readAt: string | null;
  models: string[];
  /** Fingerprint of the reply's files at the time of reading. */
  files: string;
  reading: ReplyReading;
}

export function filesFingerprint(r: Reply): string {
  const all = [...(r.cover ? [r.cover] : []), ...r.files];
  return hashOf(JSON.stringify(all.map((f) => [f.name, f.bytes, f.text ?? f.base64 ?? f.parseError ?? ""])));
}

/** Saved readings for these replies, keyed by reply id. A reply whose files changed since is left out. */
export async function loadSavedReadings(replies: Reply[]): Promise<Record<string, ReplyReading>> {
  const out: Record<string, ReplyReading> = {};
  await Promise.all(
    replies.map(async (r) => {
      try {
        const s = JSON.parse(await fs.readFile(path.join(READINGS_DIR, `${r.id}.json`), "utf8")) as SavedFile;
        if (s.files === filesFingerprint(r)) out[r.id] = { ...s.reading, saved: true };
      } catch {
        // not saved yet
      }
    }),
  );
  return out;
}

/** Write one saved reading per reply. Only clean, model-read results are saved. */
export async function saveReadings(replies: Reply[], readings: ReplyReading[]): Promise<number> {
  await fs.mkdir(READINGS_DIR, { recursive: true });
  let n = 0;
  for (const reading of readings) {
    const reply = replies.find((r) => r.id === reading.replyId);
    if (!reply || reading.status === "error") continue;
    const { saved: _saved, ...clean } = reading;
    void _saved;
    const file: SavedFile = { replyId: reading.replyId, readAt: reading.readAt, models: reading.models, files: filesFingerprint(reply), reading: clean };
    await fs.writeFile(path.join(READINGS_DIR, `${reading.replyId}.json`), JSON.stringify(file, null, 1) + "\n");
    n++;
  }
  return n;
}
