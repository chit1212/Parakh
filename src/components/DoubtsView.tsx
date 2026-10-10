"use client";
// Doubts (design: Comparison - Ledger, #doubts). Only doubts that change a winner, ranked by rupees.
// Vendor-routed doubts get an AI-drafted email the buyer edits and approves (sending is stubbed);
// buyer judgements get options. Nothing goes to a vendor without approval.
import { useState } from "react";
import { cellKey, type Grid } from "@/lib/compare";
import type { Override } from "@/lib/award";
import { acceptable, decisionKey, type Decision } from "@/lib/decisions";
import type { Doubt, DoubtReport } from "@/lib/doubts";
import { lakh } from "@/lib/format";
import { stamp } from "./useVerified";

const label11 = { fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--color-neutral-700)" };
const COLS = "40px minmax(0,1fr) 120px 110px 120px";

type Draft = { to: string; subject: string; body: string; model?: string } | { error: string } | "loading";

/** The buyer's choices on a doubt they can settle themselves; "accept" lets the held price compete. */
function choicesFor(d: Doubt): { label: string; effect: Decision["effect"] }[] {
  if (d.kind === "substitute_spec") return [{ label: "Accept the substitute for this award", effect: "accept" }, { label: "Reject: hold to the RFQ spec", effect: "hold" }];
  if (d.kind === "far_below_should_cost") return [{ label: "Approve the price as written: I have confirmed it", effect: "accept" }, { label: "Hold it until the vendor confirms", effect: "hold" }];
  return [];
}

export function DoubtsView({ grid, report, overrides, onSee, decisions, onRecord, onUndo, me }: {
  grid: Grid; report: DoubtReport; overrides: Override[]; onSee: (vendorId: string, lineId: string) => void;
  decisions: Decision[]; onRecord: (d: Decision) => void; onUndo: (key: string) => void; me: string;
}) {
  const [open, setOpen] = useState<string | null>(report.raised[0]?.id ?? null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [choice, setChoice] = useState<Record<string, number>>({});
  const [why, setWhy] = useState<Record<string, string>>({});
  const decisionOf = (d: Doubt) => decisions.find((x) => x.key === decisionKey(d));
  const record = (d: Doubt, choiceText: string, effect: Decision["effect"], reason: string) =>
    onRecord({ key: decisionKey(d), title: d.title, vendorId: d.vendorId, lineIds: d.lineIds, choice: choiceText, effect, who: me, at: new Date().toISOString(), why: reason });
  const name = (v: string) => grid.vendors.find((x) => x.id === v)?.short ?? v;
  const logged = report.logged.length + report.checks.length;

  const draft = async (d: Doubt) => {
    setDrafts((s) => ({ ...s, [d.id]: "loading" }));
    const lines = d.lineIds.map((l) => {
      const c = grid.cells[cellKey(d.vendorId, l)];
      const line = grid.lines.find((x) => x.id === l)!;
      return `${l} ${line.name}: ${c.norm.asWritten}${c.perBox != null ? ` → ₹${c.perBox.toFixed(2)} per box delivered` : ""}`;
    });
    const v = grid.vendors.find((x) => x.id === d.vendorId);
    const howRead = [v?.note ? `Read as: ${v.note}` : "", ...(grid.cells[cellKey(d.vendorId, d.lineIds[0])]?.norm.flags ?? [])].filter(Boolean);
    try {
      const r = await fetch("/api/draft", { method: "POST", body: JSON.stringify({ vendorId: d.vendorId, ask: d.ask, title: d.title, lines, howRead }) });
      const j = await r.json();
      setDrafts((s) => ({ ...s, [d.id]: j }));
    } catch {
      setDrafts((s) => ({ ...s, [d.id]: { error: "The draft could not be written just now. Try again in a minute." } }));
    }
  };

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "18px 28px 32px 8px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 1180 }}>
      <p style={{ margin: 0, maxWidth: 760, color: "var(--color-neutral-800)" }}>
        Only doubts that could change who wins a line, ranked by rupees at stake. {logged} more were checked and logged; none of them changes a winner.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: COLS, gap: "0 16px", ...label11, paddingBottom: 6, borderBottom: "1px solid var(--color-text)" }}>
        <span>Rank</span><span>Doubt</span><span>Lines</span><span>Goes to</span><span style={{ textAlign: "right" }}>At stake</span>
      </div>
      {report.raised.map((d, i) => {
        const changed = [...new Set(d.changes.map((c) => c.lineId))];
        const views = [...new Set(d.changes.map((c) => (c.view === "cleared" ? "quality-cleared" : "cheapest overall")))].join(" and ");
        const dr = drafts[d.id];
        return (
          <div key={d.id} style={{ display: "flex", flexDirection: "column", borderBottom: "1px solid var(--color-divider)", paddingBottom: 14 }}>
            <button onClick={() => setOpen(open === d.id ? null : d.id)} style={{ display: "grid", gridTemplateColumns: COLS, gap: "0 16px", alignItems: "baseline", background: "none", border: 0, padding: "4px 0", textAlign: "left", font: "inherit", color: "inherit" }}>
              <span style={{ fontSize: 22, fontWeight: 600, color: "var(--color-accent-2-700)" }}>{i + 1}</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{d.title}</span>
                <span style={{ color: "var(--color-neutral-800)" }}>{d.why} If it goes the other way, {changed.length} line{changed.length === 1 ? "" : "s"} change hands in the {views} view.</span>
              </span>
              <span>{changed.join(", ")}</span>
              <span>{d.route === "vendor" ? `${name(d.vendorId)}, email` : "You, judgement"}</span>
              <span style={{ textAlign: "right", fontSize: 16, fontWeight: 600 }}>{lakh(d.stake)}</span>
            </button>
            {open === d.id && (
              <div style={{ display: "grid", gridTemplateColumns: "40px minmax(0,1fr)", gap: "0 16px", paddingTop: 10 }}>
                <span />
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 820 }}>
                  <span style={{ fontWeight: 600 }}>{d.ask}</span>
                  <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
                    Checked by code: {d.tested}. Changes: {d.changes.map((c) => `${c.lineId} ${c.from ? name(c.from.vendorId) : "—"} → ${c.to ? name(c.to.vendorId) : "—"} (${c.view === "cleared" ? "quality-cleared" : "all vendors"})`).join("; ")}.
                  </span>
                  {decisionOf(d) ? (
                    <span style={{ color: "var(--color-accent-800)" }}>
                      {decisionOf(d)!.choice} · {decisionOf(d)!.who}, {stamp(decisionOf(d)!.at)} · “{decisionOf(d)!.why}”{" "}
                      <button className="btn btn-ghost" style={{ padding: "0 4px" }} onClick={() => onUndo(decisionKey(d))}>Undo</button>
                    </span>
                  ) : acceptable(d) ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {choicesFor(d).map((o, k) => (
                        <label key={k} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input type="radio" name={d.id} checked={choice[d.id] === k} onChange={() => setChoice((s) => ({ ...s, [d.id]: k }))} />{o.label}
                        </label>
                      ))}
                      <input className="input" style={{ minHeight: 32, maxWidth: 560 }} placeholder="Why (recorded with your name and the time on the award)" value={why[d.id] ?? ""} onChange={(e) => setWhy((s) => ({ ...s, [d.id]: e.target.value }))} />
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="btn btn-primary" disabled={choice[d.id] === undefined || !(why[d.id] ?? "").trim()}
                          onClick={() => { const o = choicesFor(d)[choice[d.id]]; record(d, o.label, o.effect, why[d.id].trim()); }}>Record decision</button>
                        <button className="btn btn-ghost" onClick={() => onSee(d.vendorId, d.lineIds[0])}>See source</button>
                        {d.route === "vendor" && !dr && <button className="btn btn-ghost" onClick={() => draft(d)}>Or ask the vendor by email</button>}
                      </div>
                      <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
                        {choicesFor(d)[0].label.split(":")[0]} lets this price compete in the comparison, every scenario and the chat. You can undo it until the award is frozen.
                      </span>
                      {dr && dr !== "loading" && !("error" in dr) && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>To {dr.to} · {dr.subject} · drafted by {dr.model ?? "AI"}, for you to check</span>
                          <textarea className="input" style={{ minHeight: 190, whiteSpace: "pre-wrap" }} value={dr.body} onChange={(e) => setDrafts((s) => ({ ...s, [d.id]: { ...dr, body: e.target.value } }))} />
                          <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => record(d, `Asked ${name(d.vendorId)} by email (${dr.to}); held until they reply`, "asked", `To settle: ${d.ask}`)}>Approve &amp; send</button>
                        </div>
                      )}
                      {dr === "loading" && <span style={{ color: "var(--color-neutral-700)" }}>Drafting with AI…</span>}
                    </div>
                  ) : d.route === "vendor" ? (
                    !dr ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-primary" onClick={() => draft(d)}>Draft the email</button>
                        <button className="btn btn-ghost" onClick={() => onSee(d.vendorId, d.lineIds[0])}>See source</button>
                      </div>
                    ) : dr === "loading" ? (
                      <span style={{ color: "var(--color-neutral-700)" }}>Drafting with AI…</span>
                    ) : "error" in dr ? (
                      <span style={{ color: "var(--color-neutral-800)" }}>{dr.error} <button className="btn btn-ghost" onClick={() => draft(d)}>Try again</button></span>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>To {dr.to} · {dr.subject} · drafted by {dr.model ?? "AI"}, for you to check</span>
                        <textarea className="input" style={{ minHeight: 190, whiteSpace: "pre-wrap" }} value={dr.body} onChange={(e) => setDrafts((s) => ({ ...s, [d.id]: { ...dr, body: e.target.value } }))} />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn btn-primary" onClick={() => record(d, `Asked ${name(d.vendorId)} by email (${dr.to}); open until they reply. (Demo: nothing left this app.)`, "asked", `To settle: ${d.ask}`)}>Approve &amp; send</button>
                          <button className="btn btn-ghost" onClick={() => record(d, `Will call ${name(d.vendorId)}; open until the answer is recorded`, "asked", `To settle: ${d.ask}`)}>I’ll call instead</button>
                        </div>
                      </div>
                    )
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {(d.options ?? []).map((o, k) => (
                        <label key={k} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input type="radio" name={d.id} checked={choice[d.id] === k} onChange={() => setChoice((s) => ({ ...s, [d.id]: k }))} />{o}
                        </label>
                      ))}
                      <input className="input" style={{ minHeight: 32, maxWidth: 560 }} placeholder="Why (recorded with your name and the time)" value={why[d.id] ?? ""} onChange={(e) => setWhy((s) => ({ ...s, [d.id]: e.target.value }))} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-primary" disabled={choice[d.id] === undefined || !(why[d.id] ?? "").trim()} onClick={() => record(d, d.options![choice[d.id]], "hold", why[d.id].trim())}>Record decision</button>
                        <button className="btn btn-ghost" onClick={() => onSee(d.vendorId, d.lineIds[0])}>See source</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {decisions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h3 style={{ fontSize: 18, margin: "8px 0 0" }}>Decisions on record</h3>
          {decisions.map((x) => (
            <div key={x.key}>
              <b>{x.title}</b>: {x.choice} · {x.who}, {stamp(x.at)} · “{x.why}”
              {x.effect === "accept" && <span style={{ color: "var(--color-neutral-700)" }}> · the price now competes</span>}{" "}
              <button className="btn btn-ghost" style={{ padding: "0 4px" }} onClick={() => onUndo(x.key)}>Undo</button>
            </div>
          ))}
        </div>
      )}
      {overrides.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h3 style={{ fontSize: 18, margin: "8px 0 0" }}>Overrides on record</h3>
          {overrides.map((o) => (
            <div key={o.lineId}>{o.lineId}: {name(o.from ?? "")} → {name(o.to)} · {o.who}, {new Date(o.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })} · “{o.why}”</div>
          ))}
        </div>
      )}
      <details style={{ color: "var(--color-neutral-800)" }}>
        <summary style={{ cursor: "pointer", color: "var(--color-accent-800)" }}>The {logged} checked and logged</summary>
        <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
          {report.logged.map((d) => <li key={d.id}>{d.title}: {d.tested}; no winner changes.</li>)}
          {report.checks.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      </details>
    </div>
  );
}
