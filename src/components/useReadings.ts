"use client";
// Loads the event with its saved readings. Replies without one (new uploads) are read live
// through /api/read, a few at a time, with progress; any reply can be read again live.
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReplyReading, Stage } from "@/lib/reader/pipeline";
import type { ReplySummary } from "@/lib/summary";
import type { Sheet } from "@/lib/files/xlsx";
import type { LastYearLine, SourcingEvent } from "@/lib/types";

export interface ReplyState {
  stage: Stage | "queued" | "waiting";
  reading: ReplyReading | null;
  error: string | null;
  /** A calm note about the last live read (e.g. the free quota was busy); the reading shown is unchanged. */
  notice?: string | null;
  /** While waiting on the free tier's rate limit: "retrying in 20s". */
  detail?: string | null;
}

export interface EventData {
  event: SourcingEvent;
  lastYear: LastYearLine[];
  historySheets: Sheet[];
  replies: ReplySummary[];
  /** Saved readings (data/readings), by reply id. */
  saved: Record<string, ReplyReading>;
  keyConfigured: boolean;
}

const STORE = "parakh.readings.v2";
const load = (): Record<string, ReplyReading> => {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) ?? "{}");
  } catch {
    return {};
  }
};
const save = (r: Record<string, ReplyReading>) => {
  try {
    sessionStorage.setItem(STORE, JSON.stringify(r));
  } catch {
    /* storage full or blocked: the saved readings still load from the server */
  }
};

export function useReadings() {
  const [data, setData] = useState<EventData | null>(null);
  const [state, setState] = useState<Record<string, ReplyState>>({});
  const [blocked, setBlocked] = useState<string | null>(null);
  const started = useRef(false);

  const set = (id: string, patch: Partial<ReplyState>) =>
    setState((s) => ({ ...s, [id]: { ...(s[id] ?? { stage: "queued", reading: null, error: null }), ...patch } }));

  const readOne = useCallback(async (id: string, fresh = false) => {
    // The current reading stays on screen until a new one arrives.
    set(id, { stage: "opening", error: null, notice: null, detail: null });
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
          if (msg.type === "progress") set(id, { stage: msg.stage, detail: msg.detail ?? null });
          else if (msg.type === "blocked") {
            setBlocked(msg.message);
            set(id, { stage: "done", notice: msg.message });
          } else if (msg.type === "error") set(id, { stage: "done", error: msg.message });
          else if (msg.type === "result") {
            const r = msg.reading as ReplyReading;
            if (r.status === "error") {
              // Keep what was there (a saved reading); say calmly why the live read did not finish.
              setState((s) => {
                const prev = s[id]?.reading;
                return { ...s, [id]: { ...s[id], stage: "done", detail: null, reading: prev ?? r, notice: prev ? r.headline : null, error: null } };
              });
            } else {
              set(id, { stage: "done", reading: r, detail: null });
              const all = load();
              all[id] = r;
              save(all);
            }
          }
        }
      }
    } catch (e) {
      set(id, { stage: "done", error: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const d = (await (await fetch("/api/event")).json()) as EventData;
      setData(d);
      const kept = load(); // live readings done in this browser session win over saved ones
      const todo: string[] = [];
      const init: Record<string, ReplyState> = {};
      for (const r of d.replies) {
        const have = kept[r.id] ?? d.saved[r.id];
        if (have) init[r.id] = { stage: "done", reading: have, error: null };
        else {
          init[r.id] = { stage: d.keyConfigured ? "queued" : "waiting", reading: null, error: null };
          todo.push(r.id);
        }
      }
      setState(init);
      if (!d.keyConfigured) return;
      // Read a few at a time, so every reply shows its own progress without flooding the API.
      const queue = [...todo];
      const worker = async () => {
        for (let id = queue.shift(); id; id = queue.shift()) await readOne(id);
      };
      await Promise.all([worker(), worker()]); // two at a time: the free tier allows only a few calls a minute
    })();
  }, [readOne]);

  return { data, state, blocked, readOne };
}
