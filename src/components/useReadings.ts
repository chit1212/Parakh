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

const UPLOADS = "parakh.uploads.v1";
const loadUploads = (): ReplySummary[] => {
  try {
    return JSON.parse(sessionStorage.getItem(UPLOADS) ?? "[]");
  } catch {
    return [];
  }
};
const saveUploads = (u: ReplySummary[]) => {
  try {
    sessionStorage.setItem(UPLOADS, JSON.stringify(u));
  } catch {
    /* blocked: uploads last until the page is refreshed */
  }
};

/** Demo: start the event with no replies, so the buyer uploads them and watches the table build. */
const EMPTY = "parakh-empty-event";
export const isEmptyEvent = () => {
  try { return localStorage.getItem(EMPTY) === "1"; } catch { return false; }
};
export const setEmptyEvent = (on: boolean) => {
  try { if (on) localStorage.setItem(EMPTY, "1"); else localStorage.removeItem(EMPTY); } catch { /* blocked */ }
  window.location.reload();
};

export function useReadings() {
  const [data, setData] = useState<EventData | null>(null);
  const [state, setState] = useState<Record<string, ReplyState>>({});
  const [blocked, setBlocked] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  const started = useRef(false);

  const set = (id: string, patch: Partial<ReplyState>) =>
    setState((s) => ({ ...s, [id]: { ...(s[id] ?? { stage: "queued", reading: null, error: null }), ...patch } }));

  /** Follow a streamed reading (one JSON object per line) for reply `id0` (an upload learns its id from the stream). */
  const follow = useCallback(async (res: Response, id0: string | null) => {
    let id = id0 ?? "";
    try {
      if (!res.body) throw new Error(`Server answered ${res.status}`);
      if (!res.ok && res.headers.get("content-type")?.includes("json")) throw new Error((await res.json()).error ?? `Server answered ${res.status}`);
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
          if (msg.type === "reply") {
            // A new upload: it joins the event's replies for this session, newest first.
            const r = msg.reply as ReplySummary;
            id = r.id;
            setData((d) => (d ? { ...d, replies: [r, ...d.replies.filter((x) => x.id !== r.id)] } : d));
            const ups = loadUploads().filter((x) => x.id !== r.id);
            saveUploads([r, ...ups]);
            set(id, { stage: "opening", reading: null, error: null });
          } else if (msg.type === "progress") set(id, { stage: msg.stage, detail: msg.detail ?? null });
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
      if (id) set(id, { stage: "done", error: (e as Error).message });
      else setBlocked((e as Error).message);
    }
  }, []);

  const readOne = useCallback(async (id: string, fresh = false) => {
    // The current reading stays on screen until a new one arrives.
    set(id, { stage: "opening", error: null, notice: null, detail: null });
    try {
      await follow(await fetch("/api/read", { method: "POST", body: JSON.stringify({ replyId: id, fresh }) }), id);
    } catch (e) {
      set(id, { stage: "done", error: (e as Error).message });
    }
  }, [follow]);

  /** Upload a new reply: parsed in code, read live by the real pipeline. */
  const upload = useCallback(async (files: File[], vendorId: string) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    form.append("vendorId", vendorId);
    setBlocked(null);
    try {
      await follow(await fetch("/api/upload", { method: "POST", body: form }), null);
    } catch (e) {
      setBlocked((e as Error).message);
    }
  }, [follow]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const d0 = (await (await fetch("/api/event")).json()) as EventData;
      // Replies uploaded earlier in this session come first (newest), then the demo inbox,
      // unless the buyer chose to start the event empty.
      const none = isEmptyEvent();
      setEmpty(none);
      const d = { ...d0, replies: [...loadUploads(), ...(none ? [] : d0.replies)] };
      setData(d);
      const kept = load(); // live readings done in this browser session win over saved ones
      const todo: string[] = [];
      const init: Record<string, ReplyState> = {};
      for (const r of d.replies) {
        const have = kept[r.id] ?? d.saved[r.id];
        if (have) init[r.id] = { stage: "done", reading: have, error: null };
        else if (r.origin === "upload") init[r.id] = { stage: "done", reading: null, error: "This upload was not read; upload it again." };
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

  return { data, state, blocked, readOne, upload, empty };
}
