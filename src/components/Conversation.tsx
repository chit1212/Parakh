"use client";
// L25 conversation panel (design: right panel, "Conversation"). Shared by the buyer and the VP;
// every question is labelled with who asked it. Answers that produced a scenario carry a result card.
import { useEffect, useRef, useState } from "react";
import { CaretDown, CaretRight, ChartBarHorizontal, PaperPlaneRight, Table } from "@phosphor-icons/react";
import type { Doubt } from "@/lib/doubts";
import { crore, lakh } from "@/lib/format";
import type { Quality } from "@/lib/quality";
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

const label = { fontSize: 14 };
const KEEP = 3;
/** The VP's question from the brief; the "Start here" strip asks it as Meera. */
export const VP_QUESTION = "What if we split it, cheapest per line, but only among vendors who cleared the quality questionnaire?";
const SUGGESTIONS = [
  VP_QUESTION,
  "Same split, but assume every open doubt goes against us.",
  "Keep it to quality-cleared vendors, but don’t let any one vendor take more than 40% of the value.",
];

/**
 * The short form of a scenario answer, built in code from the solver's result (the model never does
 * the sums): a lead line with the total, then at most three bullets — who is out and why, the biggest
 * lines that change hands, and an open doubt that still matters.
 */
function summary(r: ScenarioResult, title: string, names: Record<string, string>, quality: Quality[], doubts: Doubt[], open: number[]) {
  const d = r.award.total - r.base.total;
  const lead = `${title}: ${crore(r.award.total)}${Math.abs(d) < 1 ? ", the same as as quoted." : `, ${lakh(Math.abs(d))} ${d > 0 ? "more" : "less"} than as quoted.`}`;
  const short = (v: string) => names[v] ?? v;
  const reason = (x: ScenarioResult["excluded"][number]) => {
    const q = quality.find((y) => y.vendorId === x.vendorId);
    if (q && x.why === q.why) return !q.returned ? "didn’t return the questionnaire" : q.mandatoryFailed ? `failed ${q.mandatoryFailed} mandatory item${q.mandatoryFailed > 1 ? "s" : ""}` : `scored ${q.score}, below the pass mark of ${q.passMark}`;
    return x.why;
  };
  const bullets: string[] = [];
  if (r.excluded.length)
    bullets.push(`${r.excluded.map((x) => short(x.vendorId)).join(" and ")} excluded: ${r.excluded.map((x) => `${short(x.vendorId)} ${reason(x)}`).join("; ")}.`);
  const big = [...r.changed].sort((a, b) => Math.abs(b.deltaValue) - Math.abs(a.deltaValue)).slice(0, 3);
  if (big.length)
    bullets.push(`${r.changed.length} line${r.changed.length > 1 ? "s" : ""} change hands; biggest: ${big.map((c) => `${c.lineId} ${c.from ? short(c.from) : "—"} → ${c.to ? short(c.to) : "—"} (${c.deltaValue >= 0 ? "+" : "−"}${lakh(Math.abs(c.deltaValue))})`).join(", ")}.`);
  // Open doubts whose other reading would change a winner under these rules (tested in code), highest stake first.
  const caveats = open.slice(0, 2).map((k) => ({ x: doubts[k], n: k + 1 })).filter(({ x }) => x);
  const say = (x: Doubt) => x.kind === "conditional_discount" ? `${short(x.vendorId)}’s discount is still unconfirmed`
    : x.kind === "freight_unknown" ? `${short(x.vendorId)}’s freight is still unknown`
    : x.kind === "substitute_spec" ? `${short(x.vendorId)}’s substitute on ${x.lineIds[0]} is undecided`
    : `${short(x.vendorId)} ${x.lineIds[0]} is unconfirmed`;
  if (caveats.length) bullets.push(`${caveats.map(({ x, n }) => `${say(x)} (Doubt ${n})`).join("; ")}.`);
  return { lead, bullets };
}

export function Conversation({ msgs, results, titles, people, asker, busy, q, setQ, onAsk, onShow, opening, vendorNames, quality, doubts, openFor }: {
  msgs: ChatMsg[]; results: ScenarioResult[]; titles: string[]; people: People; asker: "buyer" | "vp";
  busy: boolean; q: string; setQ: (s: string) => void; onAsk: (text: string) => void; onShow: (i: number, view: "table" | "chart") => void;
  opening: string; vendorNames: Record<string, string>; quality: Quality[]; doubts: Doubt[];
  /** Per scenario: indexes of the open doubts that would change a winner under its rules. */
  openFor: number[][];
}) {
  const [working, setWorking] = useState<Record<number, boolean>>({});
  const thread = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = thread.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, busy]);
  const asked = new Set(msgs.filter((m) => m.role === "user").map((m) => m.text));
  // v2: the last three messages, with the earlier ones one click away.
  const [all, setAll] = useState(false);
  const hidden = all ? 0 : Math.max(0, msgs.length - KEEP);

  return (
    <>
      <div ref={thread} style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "16px 22px", display: "flex", flexDirection: "column", gap: 18 }}>
        {hidden > 0 ? (
          <button className="btn btn-ghost" style={{ alignSelf: "flex-start", fontSize: 15, color: "var(--color-accent-700)", padding: "2px 0" }} onClick={() => setAll(true)}>
            Show {hidden + 1} earlier message{hidden ? "s" : ""}
          </button>
        ) : <Bot text={opening} />}
        {msgs.map((m, i) => i < hidden ? null :
          m.role === "user" ? (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", paddingLeft: 44 }}>
              <span style={{ ...label, display: "flex", gap: 6, alignItems: "center", color: "var(--color-neutral-700)" }}>
                {m.asker === "vp" ? people.vp : people.buyer}
                <span className={m.asker === "vp" ? "tag tag-accent-2" : "tag tag-neutral"} style={{ letterSpacing: "0.04em", padding: "1px 6px" }}>{m.asker === "vp" ? "VP" : "Buyer"}</span>
              </span>
              <p style={{ margin: 0, fontSize: 15, fontStyle: "italic", textAlign: "right" }}>{m.text}</p>
            </div>
          ) : (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(() => {
                const rs = (m.scenarios ?? []).map((si) => ({ si, r: results[si] })).filter((x) => x.r);
                if (!rs.length || m.error) return <Bot text={m.text || m.status || "…"} muted={m.error || (!m.text && !!m.status)} model={m.model} />;
                const sm = summary(rs[rs.length - 1].r, titles[rs[rs.length - 1].si], vendorNames, quality, doubts, openFor[rs[rs.length - 1].si] ?? []);
                return (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ ...label, color: "var(--color-accent-700)" }}>Parakh{m.model ? <span style={{ color: "var(--color-neutral-700)" }}> · {m.model}</span> : null}</span>
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{sm.lead}</p>
                      {sm.bullets.length > 0 && (
                        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4, fontSize: 15 }}>
                          {sm.bullets.map((b, k) => <li key={k}>{b}</li>)}
                        </ul>
                      )}
                    </div>
                    {rs.map(({ si, r }) => {
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
                    <button onClick={() => setWorking((w) => ({ ...w, [i]: !w[i] }))} aria-expanded={!!working[i]}
                      style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: 0, padding: 0, font: "inherit", fontSize: 15, color: "var(--color-accent-700)", cursor: "pointer" }}>
                      {working[i] ? <CaretDown size={14} weight="duotone" /> : <CaretRight size={14} weight="duotone" />}Show working
                    </button>
                    {working[i] && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 15, borderLeft: "2px solid var(--color-neutral-300)", paddingLeft: 12 }}>
                        {(m.text || m.status) && <p style={{ margin: 0, whiteSpace: "pre-wrap", color: m.text ? undefined : "var(--color-neutral-700)" }}>{m.text || m.status}</p>}
                        {rs.map(({ si, r }) => (
                          <div key={si} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <b>{titles[si]}: rules applied</b>
                            {r.rules.map((t, k) => <span key={k}>R{k + 1}. {t}</span>)}
                            <b style={{ paddingTop: 4 }}>Eligibility, vendor by vendor</b>
                            {Object.keys(vendorNames).map((v) => {
                              const x = r.excluded.find((e) => e.vendorId === v);
                              return <span key={v}>{vendorNames[v]}: {x ? `out: ${x.why}` : "eligible"}</span>;
                            })}
                            {r.changed.length > 0 && <b style={{ paddingTop: 4 }}>Lines that change hands</b>}
                            {r.changed.map((c) => <span key={c.lineId}>{c.lineId}: {c.from ? vendorNames[c.from] : "—"} → {c.to ? vendorNames[c.to] : "—"} ({c.delta >= 0 ? "+" : "−"}₹{Math.abs(c.delta).toFixed(2)}/box, {c.deltaValue >= 0 ? "+" : "−"}{lakh(Math.abs(c.deltaValue))})</span>)}
                            {r.notes.length > 0 && <b style={{ paddingTop: 4 }}>Solver notes</b>}
                            {r.notes.map((t, k) => <span key={k}>{t}</span>)}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ),
        )}
        {busy && msgs[msgs.length - 1]?.role === "user" && <Bot text="Working it out: choosing the rules, then solving them in code…" muted />}
      </div>
      <div style={{ padding: "10px 22px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {SUGGESTIONS.filter((s) => !asked.has(s)).slice(0, 3).map((s) => (
            <button key={s} disabled={busy} onClick={() => onAsk(s)} style={{ background: "var(--color-neutral-100)", boxShadow: "var(--shadow-sm)", border: 0, padding: "5px 10px", font: "inherit", fontSize: 14, color: "var(--color-accent-800)", borderRadius: "var(--radius-lg)", textAlign: "left", cursor: "pointer" }}>{s}</button>
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
