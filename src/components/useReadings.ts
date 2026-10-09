"use client";
// Loads the event with its saved readings (made once, on the free AI tier). A reply with no saved
// reading, or one the buyer asks to read again, is read live through /api/read with progress.
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReplyReading, Stage } from "@/lib/reader/pipeline";
import type { SavedReading } from "@/lib/saved";
import type { ReplySummary } from "@/lib/summary";
import type { LastYearLine, SourcingEvent } from "@/lib/types";

export interface ReplyState {
  stage: Stage | "queued" | "waiting";
  reading: ReplyReading | null;
  error: string | null;
  /** Where the reading came from: saved (with its date) or read live in this session. */
  source: { kind: "saved"; readAt: string } | { kind: "live"; readAt: string } | null;
}

export interface EventData {
  event: SourcingEvent;
  lastYear: LastYearLine[];
  replies: ReplySummary[];
  keyConfigured: boolean;
  saved: Record<string, SavedReading>;
}

type Kept = { reading: ReplyReading; readAt: string };
const STORE = "parakh.readings.v2";
const load = (): Record<string, Kept> => {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) ?? "{}");
  } catch {
    return {};
  }
};
const save = (r: Record<string, Kept>) => {
  try {
    sessionStorage.setItem(STORE, JSON.stringify(r));
  } catch {
    /* storage full or blocked: readings just reload from the server cache */
  }
};

export function useReadings() {
  const [data, setData] = useState<EventData | null>(null);
  const [state, setState] = useState<Record<string, ReplyState>>({});
  const [blocked, setBlocked] = useState<string | null>(null);
  const started = useRef(false);

  const set = (id: string, patch: Partial<ReplyState>) =>
    setState((s) => ({ ...s, [id]: { ...(s[id] ?? { stage: "queued", reading: null, error: null, source: null }), ...patch } }));

  const readOne = useCallback(async (id: string, fresh = false) => {
    set(id, { stage: "opening", error: null });
    try {
      const res = await fetch("/api/read", { method: "POST", body: JSON.stringify({ replyId: id, fresh }) });
      if (!res.body) throw new Error(`Server answered ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const msg = JSON.parse(buf.slice(0, nl));
          buf = buf.slice(nl + 1);
          if (msg.type === "progress") set(id, { stage: msg.stage });
          else if (msg.type === "blocked") setBlocked(msg.message);
          else if (msg.type === "error") set(id, { stage: "done", error: msg.message });
          else if (msg.type === "result") {
            const r = msg.reading as ReplyReading;
            if (r.status === "error") {
              // Keep whatever reading was showing; say calmly why this attempt did not finish.
              set(id, { stage: "done", error: r.error ?? r.headline });
            } else {
              const readAt = new Date().toISOString();
              set(id, { stage: "done", reading: r, source: { kind: "live", readAt } });
              const all = load();
              all[id] = { reading: r, readAt };
              save(all);
            }
          }
        }
      }
    } catch {
      set(id, { stage: "done", error: "The connection dropped while reading. Try again in a minute." });
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const d = (await (await fetch("/api/event")).json()) as EventData;
      setData(d);
      const kept = load();
      const init: Record<string, ReplyState> = {};
      for (const r of d.replies) {
        const live = kept[r.id];
        const saved = d.saved[r.id];
        if (live) init[r.id] = { stage: "done", reading: live.reading, error: null, source: { kind: "live", readAt: live.readAt } };
        else if (saved) init[r.id] = { stage: "done", reading: saved.reading, error: null, source: { kind: "saved", readAt: saved.readAt } };
        // Not read yet: waits for the buyer to ask, so page visits never spend the free AI quota.
        else init[r.id] = { stage: "waiting", reading: null, error: null, source: null };
      }
      setState(init);
    })();
  }, [readOne]);

  return { data, state, blocked, readOne };
}
