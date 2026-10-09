"use client";
// Doubts (design: Comparison - Ledger, #doubts). Only doubts that change a winner, ranked by rupees.
// Vendor-routed doubts get an AI-drafted email the buyer edits and approves (sending is stubbed);
// buyer judgements get options. Nothing goes to a vendor without approval.
import { useEffect, useState } from "react";
import { cellKey, type Grid } from "@/lib/compare";
import type { Doubt, DoubtReport } from "@/lib/doubts";
import { lakh } from "@/lib/format";

const label11 = { fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--color-neutral-700)" };
const COLS = "40px minmax(0,1fr) 120px 110px 120px";
export const DECISIONS_KEY = "parakh.decisions.v1";

type Draft = { to: string; subject: string; body: string; model?: string } | { error: string } | "loading";

export function DoubtsView({ grid, report, onSee }: { grid: Grid; report: DoubtReport; onSee: (vendorId: string, lineId: string) => void }) {
  const [open, setOpen] = useState<string | null>(report.raised[0]?.id ?? null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  // Decisions persist in this browser (by doubt title) so the award record can show them.
  const [done, setDoneState] = useState<Record<string, string>>({});
  useEffect(() => {
    try { setDoneState(JSON.parse(localStorage.getItem(DECISIONS_KEY) ?? "{}")); } catch { /* none yet */ }
  }, []);
  const setDone = (f: (s: Record<string, string>) => Record<string, string>) =>
    setDoneState((s) => {
      const n = f(s);
      try { localStorage.setItem(DECISIONS_KEY, JSON.stringify(n)); } catch { /* storage blocked: kept for this visit */ }
      return n;
    });
  const decided = Object.fromEntries(report.raised.map((d) => [d.id, done[d.title]]).filter(([, v]) => v));
  const [choice, setChoice] = useState<Record<string, number>>({});
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
                  {decided[d.id] ? (
                    <span style={{ color: "var(--color-accent-800)" }}>{decided[d.id]}</span>
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
                          <button className="btn btn-primary" onClick={() => setDone((s) => ({ ...s, [d.title]: `Approved by you and marked as sent to ${dr.to}. (Demo: no email server; nothing left this app.)` }))}>Approve &amp; send</button>
                          <button className="btn btn-ghost" onClick={() => setDone((s) => ({ ...s, [d.title]: "You will call instead. The doubt stays open until you record the answer." }))}>I’ll call instead</button>
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
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-primary" disabled={choice[d.id] === undefined} onClick={() => setDone((s) => ({ ...s, [d.title]: `Decision recorded: ${d.options![choice[d.id]]}.` }))}>Record decision</button>
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
