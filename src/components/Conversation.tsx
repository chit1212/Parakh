"use client";
// L25 conversation panel (design: right panel, "Conversation"). Shared by the buyer and the VP;
// every question is labelled with who asked it. Answers that produced a scenario carry a result card.
import { useEffect, useRef, useState } from "react";
import { CaretDown, CaretRight, ChartBarHorizontal, PaperPlaneRight, SealCheck, Table, Warning } from "@phosphor-icons/react";
import { BASELINES, type BaselineKey } from "@/lib/baseline";
import type { Doubt } from "@/lib/doubts";
import type { yoyDrivers } from "@/lib/facts";
import { crore, lakh, rupees } from "@/lib/format";
import type { Quality } from "@/lib/quality";
import type { ScenarioResult, ScenarioRules } from "@/lib/scenario";
import { CostBars, RankBars, ShareBars, type ShareRow } from "./charts";

/** What an answer was: a scenario measured against a baseline, or last year's drivers. */
export interface AnswerMeta { kind: "scenario" | "yoy"; baseline?: BaselineKey; n?: number; cap?: number | null }
/** The same computed store the table uses, handed to the panel (it never builds its own numbers). */
export interface Store {
  solve: (rules: ScenarioRules) => ScenarioResult;
  yoy: (r: ScenarioResult, n: number) => ReturnType<typeof yoyDrivers>;
  shares: (r: ScenarioResult) => ShareRow[];
  lyLines: number;
}

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
function summary(r: ScenarioResult, base: ScenarioResult, baseTitle: string, title: string, names: Record<string, string>, quality: Quality[], doubts: Doubt[], open: number[], shareRows: ShareRow[]) {
  const d = r.award.total - base.award.total;
  const lead = Math.abs(d) < 1 ? `${title} costs the same as ${baseTitle.toLowerCase()}. Total ${rupees(r.award.total)}.`
    : `${title} costs ${lakh(Math.abs(d))} ${d > 0 ? "more" : "less"} than ${baseTitle.toLowerCase()}. Total ${rupees(r.award.total)}.`;
  const short = (v: string) => names[v] ?? v;
  const reason = (x: ScenarioResult["excluded"][number]) => {
    const q = quality.find((y) => y.vendorId === x.vendorId);
    if (q && x.why === q.why) return !q.returned ? "didn’t return the questionnaire" : q.mandatoryFailed ? `failed ${q.mandatoryFailed} mandatory item${q.mandatoryFailed > 1 ? "s" : ""}` : `scored ${q.score}, below the pass mark of ${q.passMark}`;
    return x.why;
  };
  const bullets: string[] = [];
  bullets.push(`Shares: ${shareRows.map((x) => `${x.name} ${(x.pct * 100).toFixed(1)}% (${x.lines} line${x.lines === 1 ? "" : "s"})`).join(" · ")}.`);
  // Lines that move against the baseline, biggest by value.
  const moves = Object.keys(r.award.per).filter((l) => r.award.per[l]?.vendorId !== base.award.per[l]?.vendorId).map((l) => {
    const a = r.award.per[l], b = base.award.per[l];
    const q = (a?.perBox ?? 0) - (b?.perBox ?? 0);
    const line = r.changed.find((c) => c.lineId === l);
    const qty = line && line.delta ? Math.abs(line.deltaValue / line.delta) : 0;
    return { l, from: b?.vendorId ?? null, to: a?.vendorId ?? null, value: q * qty };
  }).sort((x, y) => Math.abs(y.value) - Math.abs(x.value));
  if (moves.length)
    bullets.push(`${moves.length} line${moves.length > 1 ? "s" : ""} move against the baseline; biggest: ${moves.slice(0, 3).map((m) => `${m.l} ${m.from ? short(m.from) : "—"} → ${m.to ? short(m.to) : "—"}${m.value ? ` (${m.value >= 0 ? "+" : "−"}${lakh(Math.abs(m.value))})` : ""}`).join(", ")}.`);
  // Who is out and why, and open doubts whose other reading would change a winner under these rules (tested in code).
  const caveats = open.slice(0, 2).map((k) => ({ x: doubts[k], n: k + 1 })).filter(({ x }) => x);
  const say = (x: Doubt) => x.kind === "conditional_discount" ? `${short(x.vendorId)}’s discount is still unconfirmed`
    : x.kind === "freight_unknown" ? `${short(x.vendorId)}’s freight is still unknown`
    : x.kind === "substitute_spec" ? `${short(x.vendorId)}’s substitute on ${x.lineIds[0]} is undecided`
    : `${short(x.vendorId)} ${x.lineIds[0]} is unconfirmed`;
  const parts = [
    ...(r.excluded.length ? [`${r.excluded.map((x) => `${short(x.vendorId)} ${reason(x)}`).join("; ")}`] : []),
    ...caveats.map(({ x, n }) => `${say(x)} (Doubt ${n})`),
  ];
  if (parts.length) bullets.push(`${parts.join("; ")}.`);
  return { lead, bullets };
}

export function Conversation({ msgs, results, titles, metas, store, people, asker, busy, q, setQ, onAsk, onShow, onBaseline, onFindCheaper, opening, vendorNames, quality, doubts, openFor }: {
  msgs: ChatMsg[]; results: ScenarioResult[]; titles: string[]; metas: AnswerMeta[]; store: Store; people: People; asker: "buyer" | "vp";
  busy: boolean; q: string; setQ: (s: string) => void; onAsk: (text: string) => void; onShow: (i: number, view: "table" | "chart") => void;
  onBaseline: (i: number, b: BaselineKey) => void; onFindCheaper: (i: number) => void;
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
  const toggle = (i: number) => setWorking((w) => ({ ...w, [i]: !w[i] }));

  return (
    <>
      <div ref={thread} style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
        {hidden > 0 ? (
          <button className="btn btn-ghost" style={{ alignSelf: "flex-start", fontSize: 15, color: "var(--color-accent-700)", padding: "2px 0" }} onClick={() => setAll(true)}>
            Show {hidden + 1} earlier messages
          </button>
        ) : <Bot text={opening} />}
        {msgs.map((m, i) => i < hidden ? null : m.role === "user" ? (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", paddingLeft: 36 }}>
            <span style={{ ...label, display: "flex", gap: 6, alignItems: "center", color: "var(--color-neutral-700)" }}>
              {m.asker === "vp" ? people.vp : people.buyer}
              <span className={m.asker === "vp" ? "tag tag-accent-2" : "tag tag-neutral"} style={{ padding: "1px 6px" }}>{m.asker === "vp" ? "VP" : "Buyer"}</span>
            </span>
            <p style={{ margin: 0, fontSize: 15, fontStyle: "italic", textAlign: "right" }}>{m.text}</p>
          </div>
        ) : (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(() => {
              const rs = (m.scenarios ?? []).map((si) => ({ si, r: results[si], meta: metas[si] })).filter((x) => x.r && x.meta);
              if (!rs.length || m.error) return <Bot text={m.text || m.status || "…"} muted={m.error || (!m.text && !!m.status)} model={m.model} />;
              const { si, r, meta } = rs[rs.length - 1];
              const head = <span style={{ ...label, color: "var(--color-accent-700)" }}>Parakh{m.model ? <span style={{ color: "var(--color-neutral-700)" }}> · {m.model}</span> : null}</span>;
              const working = (extra: React.ReactNode) => (
                <>
                  <button onClick={() => toggle(i)} aria-expanded={!!workingOpen(i)} style={showBtn}>
                    {workingOpen(i) ? <CaretDown size={14} weight="duotone" /> : <CaretRight size={14} weight="duotone" />}Show working
                  </button>
                  {workingOpen(i) && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14, borderLeft: "2px solid var(--color-neutral-300)", paddingLeft: 12 }}>
                      {extra}
                      {(m.text || m.status) && <p style={{ margin: 0, whiteSpace: "pre-wrap", color: m.text ? undefined : "var(--color-neutral-700)" }}>{m.text || m.status}</p>}
                    </div>
                  )}
                </>
              );
              if (meta.kind === "yoy") {
                const y = store.yoy(r, meta.n ?? 5);
                const top = y.top.reduce((a, d) => a + d.amount, 0);
                return (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {head}
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                        Net change against last year: {y.net >= 0 ? "+" : "−"}{lakh(Math.abs(y.net))} on {y.comparableLines} lines; the top {y.top.length} {top >= 0 ? "add" : "save"} {lakh(Math.abs(top))}.
                      </p>
                    </div>
                    <RankBars rows={y.top.map((d) => ({ key: d.lineId, label: `${d.lineId} ${d.name}`, amount: d.amount, amountText: `${d.amount >= 0 ? "+" : "−"}${lakh(Math.abs(d.amount))}`,
                      sub: `${vendorNames[d.vendorId] ?? d.vendorId} · ₹${d.lyPrice.toFixed(2)} → ₹${d.price.toFixed(2)} per box · ${d.qty.toLocaleString("en-IN")} boxes` }))} />
                    <span className="tag tag-neutral" style={{ alignSelf: "flex-start" }}>Same data as the Compare table · {y.comparableLines} lines have last year’s price</span>
                    {working(<span>Scenario: {titles[si]}. For each line with a last-year price: (this year’s winning price − last year’s price) × quantity. Ranked by rupees. Lines without a last-year price are left out. Last year {rupees(y.lastYear)} → this year {rupees(y.thisYear)}.</span>)}
                  </>
                );
              }
              const bk = meta.baseline ?? "as_quoted";
              const base = store.solve(BASELINES[bk].rules), bench = store.solve(BASELINES.as_quoted.rules);
              const shareRows = store.shares(r);
              const sm = summary(r, base, BASELINES[bk].title, titles[si], vendorNames, quality, doubts, openFor[si] ?? [], shareRows);
              const diff = r.award.total - base.award.total;
              return (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "8px 10px", background: "var(--color-bg)", borderRadius: "var(--radius-lg)", fontSize: 14 }}>
                    <span style={{ color: "var(--color-neutral-700)" }}>Compared with</span>
                    <b>{BASELINES[bk].title}</b>
                    <select className="input" aria-label="Change the baseline" value={bk} onChange={(e) => onBaseline(si, e.target.value as BaselineKey)} style={{ marginLeft: "auto", minHeight: 30, height: 30, width: "auto", padding: "2px 6px", fontSize: 14 }}>
                      {(Object.keys(BASELINES) as BaselineKey[]).map((k) => <option key={k} value={k}>{k === bk ? "Change" : BASELINES[k].title}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {head}
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{sm.lead}</p>
                  </div>
                  <CostBars rows={[
                    { label: "Benchmark · as quoted, all vendors", value: bench.award.total, text: crore(bench.award.total), tone: "neutral" as const },
                    ...(bk !== "as_quoted" ? [{ label: `Baseline · ${BASELINES[bk].title}`, value: base.award.total, text: crore(base.award.total), tone: "ink" as const }] : []),
                    { label: titles[si], value: r.award.total, text: crore(r.award.total), tone: "accent" as const },
                  ]} />
                  <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4, fontSize: 15 }}>
                    {sm.bullets.slice(0, 3).map((b, k) => <li key={k}>{b}</li>)}
                  </ul>
                  <ScenarioCard r={r} title={titles[si]} rows={shareRows} cap={meta.cap ?? null} onShow={(v) => onShow(si, v)} onFindCheaper={() => onFindCheaper(si)} />
                  {working(
                    <>
                      <span>Baseline {rupees(base.award.total)}. Scenario {rupees(r.award.total)}. Difference {diff >= 0 ? "+" : "−"}{rupees(Math.abs(diff))}. Shares are each vendor’s awarded value ÷ the scenario total.</span>
                      <b>Rules applied</b>
                      {r.rules.map((t, k) => <span key={k}>R{k + 1}. {t}</span>)}
                      <b>Eligibility, vendor by vendor</b>
                      {Object.keys(vendorNames).map((v) => { const x = r.excluded.find((e) => e.vendorId === v); return <span key={v}>{vendorNames[v]}: {x ? `out: ${x.why}` : "eligible"}</span>; })}
                      {r.changed.length > 0 && <b>Lines that change hands (against as quoted)</b>}
                      {r.changed.map((c) => <span key={c.lineId}>{c.lineId}: {c.from ? vendorNames[c.from] : "—"} → {c.to ? vendorNames[c.to] : "—"} ({c.delta >= 0 ? "+" : "−"}₹{Math.abs(c.delta).toFixed(2)}/box, {c.deltaValue >= 0 ? "+" : "−"}{lakh(Math.abs(c.deltaValue))})</span>)}
                      {r.notes.length > 0 && <b>Solver notes</b>}
                      {r.notes.map((t, k) => <span key={k}>{t}</span>)}
                    </>,
                  )}
                </>
              );
            })()}
          </div>
        ))}
        {busy && msgs[msgs.length - 1]?.role === "user" && <Bot text="Working it out: choosing the rules, then solving them in code…" muted />}
      </div>
      <div style={{ padding: "10px 20px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
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

  function workingOpen(i: number) { return !!working[i]; }
}

const showBtn: React.CSSProperties = { alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: 0, padding: 0, font: "inherit", fontSize: 15, color: "var(--color-accent-700)", cursor: "pointer" };

/** The scenario card (review fix 1b): proven cheapest or says so, supplier shares with the cap, the self-check, exact total. */
export function ScenarioCard({ r, title, rows, cap, onShow, onFindCheaper }: { r: ScenarioResult; title: string; rows: ShareRow[]; cap: number | null; onShow: (v: "table" | "chart") => void; onFindCheaper: () => void }) {
  return (
    <div style={{ background: "var(--color-bg)", boxShadow: "var(--shadow-sm)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8, borderRadius: "var(--radius-lg)" }}>
      <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ ...label, color: "var(--color-accent-800)", marginRight: "auto" }}>{title} · applied to the table</span>
      </span>
      <span style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 20, fontWeight: 600 }}>{crore(r.award.total)}</span>
        <span style={{ fontSize: 14, color: "var(--color-neutral-800)", fontVariantNumeric: "tabular-nums" }}>{rupees(r.award.total)} exactly</span>
      </span>
      <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {r.status === "proven_optimal" ? <span className="tag tag-accent" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><SealCheck size={14} weight="duotone" />Proven cheapest</span>
          : r.status === "feasible" ? <><span className="tag tag-outline" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Warning size={14} weight="duotone" />Meets the cap · not proven cheapest</span>
            <button className="btn btn-ghost" style={{ padding: "0 4px", fontSize: 14 }} onClick={onFindCheaper}>Find cheaper</button></>
          : <span className="tag tag-accent-2" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Warning size={14} weight="duotone" />Cap can’t be met</span>}
      </span>
      <ShareBars rows={rows} cap={cap} />
      <span style={{ fontSize: 14, color: r.selfCheck.passed ? "var(--color-neutral-800)" : "var(--color-accent-2-800)" }}>
        {r.selfCheck.passed ? `Self-check passed: no line can move to a cheaper vendor${cap != null ? " without breaking the cap" : ""}.` : `Self-check: ${r.selfCheck.move}.`}
      </span>
      <div style={{ display: "flex", gap: 6 }}>
        <button className="btn btn-secondary" onClick={() => onShow("table")} style={{ padding: "4px 10px", fontSize: 14 }}><Table size={14} weight="duotone" />Table</button>
        <button className="btn btn-secondary" onClick={() => onShow("chart")} style={{ padding: "4px 10px", fontSize: 14 }}><ChartBarHorizontal size={14} weight="duotone" />Chart</button>
      </div>
    </div>
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
