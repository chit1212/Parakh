// Saved readings of the demo replies (data/readings/, committed). The free AI tier allows few
// requests a day, so the demo opens with readings made once by the real pipeline, each stamped
// with when and by which model it was read. "Read again live" replaces one for the session.
import fs from "node:fs/promises";
import path from "node:path";
import type { ReplyReading } from "./reader/pipeline";

export const SAVED_DIR = path.join(process.cwd(), "data", "readings");

export interface SavedReading {
  replyId: string;
  /** ISO time the reading was made. */
  readAt: string;
  /** Models that produced it, from the reading itself. */
  models: string[];
  reading: ReplyReading;
}

const fileOf = (replyId: string) => path.join(SAVED_DIR, `${replyId.replace(/[^\w.-]/g, "_")}.json`);

export async function loadSavedReadings(): Promise<Record<string, SavedReading>> {
  const out: Record<string, SavedReading> = {};
  let names: string[] = [];
  try {
    names = await fs.readdir(SAVED_DIR);
  } catch {
    return out;
  }
  for (const n of names.filter((x) => x.endsWith(".json"))) {
    try {
      const s = JSON.parse(await fs.readFile(path.join(SAVED_DIR, n), "utf8")) as SavedReading;
      if (s.replyId && s.reading) out[s.replyId] = s;
    } catch {
      // A damaged file just means that reply shows as not read yet.
    }
  }
  return out;
}

export async function saveReading(reading: ReplyReading, readAt = new Date()): Promise<SavedReading> {
  const s: SavedReading = { replyId: reading.replyId, readAt: readAt.toISOString(), models: reading.models, reading };
  await fs.mkdir(SAVED_DIR, { recursive: true });
  await fs.writeFile(fileOf(reading.replyId), JSON.stringify(s, null, 1) + "\n");
  return s;
}
