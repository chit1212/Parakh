"use client";
// L25 conversation panel (design: right panel, "Conversation"). Shared by the buyer and the VP;
// every question is labelled with who asked it. Answers that produced a scenario carry a result card.
import { useEffect, useRef } from "react";
import { ChartBarHorizontal, PaperPlaneRight, Table } from "@phosphor-icons/react";
import { crore, lakh } from "@/lib/format";
import type { ScenarioResult } from "@/lib/scenario";

export interface ChatMsg {
  role: "user" | "assistant";
  text: string;
  asker?: "buyer" | "vp";
  /** Indexes of scenarios this answer produced. */
  scenarios?: number[];
  model?: string;
  error?: boolean;
  /** While the answer is on its way: what Parakh is doing. */
  status?: string;
}

export interface People { buyer: string; vp: string }

const label = { fontSize: 16 };
const SUGGESTIONS = [
  "What if we split it, cheapest per line, but only among vendors who cleared the quality questionnaire?",
  "Same split, but assume every open doubt goes against us.",
  "Keep it to quality-cleared vendors, but don’t let any one vendor take more than 40% of the value.",
];

export function Conversation({ msgs, results, titles, people, asker, busy, q, setQ, onAsk, onShow, opening, vendorNames }: {
  msgs: ChatMsg[]; results: ScenarioResult[]; titles: string[]; people: People; asker: "buyer" | "vp";
  busy: boolean; q: string; setQ: (s: string) => void; onAsk: (text: string) => void; onShow: (i: number, view: "table" | "chart") => void;
  opening: string; vendorNames: Record<string, string>;
}) {
  const thread = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = thread.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, busy]);
  const asked = new Set(msgs.filter((m) => m.role === "user").map((m) => m.text));

  return (
    <>
      <div ref={thread} style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "16px 22px", display: "flex", flexDirection: "column", gap: 18 }}>
        <Bot text={opening} />
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", paddingLeft: 44 }}>
              <span style={{ ...label, display: "flex", gap: 6, alignItems: "center", color: "var(--color-neutral-700)" }}>
                {m.asker === "vp" ? people.vp : people.buyer}
                <span className={m.asker === "vp" ? "tag tag-accent-2" : "tag tag-neutral"} style={{ letterSpacing: "0.04em", padding: "1px 6px" }}>{m.asker === "vp" ? "VP" : "Buyer"}</span>
              </span>
              <p style={{ margin: 0, fontSize: 15, fontStyle: "italic", textAlign: "right" }}>{m.text}</p>
            </div>
          ) : (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Bot text={m.text || m.status || "…"} muted={m.error || (!m.text && !!m.status)} model={m.model} />
              {(m.scenarios ?? []).map((si) => {
                const r = results[si];
                if (!r) return null;
                const d = r.award.total - r.base.total;
                return (
                  <div key={si} style={{ background: "var(--color-bg)", boxShadow: "var(--shadow-sm)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ ...label, color: "var(--color-accent-800)" }}>{titles[si]} · applied to the table</span>
                    <span style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 20, fontWeight: 600 }}>{crore(r.award.total)}</span>
                      <span style={{ color: "var(--color-accent-800)" }}>{d >= 0 ? "+" : "−"}{lakh(Math.abs(d))} vs cheapest overall</span>
                    </span>
                    <span style={{ color: "var(--color-neutral-800)" }}>{Object.entries(r.award.byVendor).filter(([, b]) => b.lines).map(([v, b]) => `${vendorNames[v]} ${b.lines}`).join(" · ")} lines</span>
                    <span style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>{r.rules.length} rules · {r.excluded.length ? `${r.excluded.length} vendor${r.excluded.length > 1 ? "s" : ""} excluded` : "no vendors excluded"} · {r.changed.length} lines change hands</span>
                    <div style={{ display: "flex", gap: 6, paddingTop: 2 }}>
                      <button className="btn btn-secondary" onClick={() => onShow(si, "table")} style={{ padding: "4px 10px", fontSize: 14 }}><Table size={14} weight="duotone" />Table</button>
                      <button className="btn btn-secondary" onClick={() => onShow(si, "chart")} style={{ padding: "4px 10px", fontSize: 14 }}><ChartBarHorizontal size={14} weight="duotone" />Chart</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ),
        )}
        {busy && msgs[msgs.length - 1]?.role === "user" && <Bot text="Working it out: choosing the rules, then solving them in code…" muted />}
      </div>
      <div style={{ padding: "10px 22px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {SUGGESTIONS.filter((s) => !asked.has(s)).map((s) => (
            <button key={s} disabled={busy} onClick={() => onAsk(s)} style={{ background: "var(--color-bg)", border: 0, padding: "4px 10px", font: "inherit", fontSize: 14, color: "var(--color-accent-800)", borderRadius: "var(--radius-md)", textAlign: "left" }}>{s}</button>
          ))}
        </div>
        <span style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>
          Asking as {asker === "vp" ? `${people.vp}, VP` : `${people.buyer}, buyer`} · switch in the P menu
        </span>
        <form style={{ display: "flex", gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (q.trim() && !busy) onAsk(q.trim()); }}>
          <textarea className="input" style={{ minHeight: 58, background: "var(--color-bg)" }} placeholder="Ask a what-if, e.g. cap any one vendor at 40%" value={q}
            onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (q.trim() && !busy) onAsk(q.trim()); } }} />
          <button className="btn btn-primary btn-icon" type="submit" disabled={busy || !q.trim()} style={{ alignSelf: "flex-end" }} title="Ask"><PaperPlaneRight size={18} weight="duotone" /></button>
        </form>
      </div>
    </>
  );
}

function Bot({ text, muted, model }: { text: string; muted?: boolean; model?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ ...label, color: "var(--color-accent-700)" }}>Parakh{model ? <span style={{ color: "var(--color-neutral-500)", letterSpacing: 0, textTransform: "none" }}> · {model}</span> : null}</span>
      <p style={{ margin: 0, fontSize: 16, color: muted ? "var(--color-neutral-700)" : undefined, whiteSpace: "pre-wrap" }}>{text}</p>
    </div>
  );
}
