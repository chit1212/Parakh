"use client";
// Loads the event and reads every reply through /api/read, a few at a time, with live progress.
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReplyReading, Stage } from "@/lib/reader/pipeline";
import type { ReplySummary } from "@/lib/summary";
import type { LastYearLine, SourcingEvent } from "@/lib/types";

export interface ReplyState {
  stage: Stage | "queued" | "waiting";
  reading: ReplyReading | null;
  error: string | null;
}

export interface EventData {
  event: SourcingEvent;
  lastYear: LastYearLine[];
  replies: ReplySummary[];
  keyConfigured: boolean;
}

const STORE = "parakh.readings.v1";
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
    /* storage full or blocked: readings just reload from the server cache */
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
    set(id, { stage: "opening", error: null, ...(fresh ? { reading: null } : {}) });
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
            set(id, { stage: "done", reading: r });
            if (r.status !== "error") {
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
      const kept = load();
      const todo: string[] = [];
      const init: Record<string, ReplyState> = {};
      for (const r of d.replies) {
        if (kept[r.id]) init[r.id] = { stage: "done", reading: kept[r.id], error: null };
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
      await Promise.all([worker(), worker(), worker(), worker()]);
    })();
  }, [readOne]);

  return { data, state, blocked, readOne };
}
