"use client";
// Comparison (design: "Comparison - Ledger"). Every line by every vendor on one basis, built in
// code from the readings. Click a price to see where it came from and how it was converted.
import { useMemo, useState } from "react";
import {
  CaretDown, CaretRight, Camera, ChatsCircle, Export, SealCheck, EnvelopeSimple, File, FileDoc, FileMagnifyingGlass, FilePdf, FileXls, X,
} from "@phosphor-icons/react";
import { Rail } from "@/components/Rail";
import { SourceDoc } from "@/components/SourceDoc";
import { Conversation, type ChatMsg } from "@/components/Conversation";
import { DECISIONS_KEY, DoubtsView } from "@/components/DoubtsView";
import { freeze, SNAPSHOT_KEY, type Snapshot } from "@/lib/award";
import { download } from "@/lib/download";
import { useRouter } from "next/navigation";
import { runScenario, type ScenarioResult, type ScenarioRules } from "@/lib/scenario";
import { useReadings } from "@/components/useReadings";
import { findDoubts, type Doubt, type DoubtReport } from "@/lib/doubts";
import { qualityOf, type Quality } from "@/lib/quality";
import { buildGrid, cellKey, type Award, type Grid, type GridCell } from "@/lib/compare";
import { crore, day, inr, lakh, num2, where } from "@/lib/format";
import type { ReplyReading } from "@/lib/reader/pipeline";
import { mainFile } from "@/lib/summary";
import { USD_REFERENCE } from "@/lib/config";

const FORMAT_ICON: Record<string, typeof File> = { Excel: FileXls, PDF: FilePdf, Word: FileDoc, Photo: Camera, Email: EnvelopeSimple };
const COLS = "40px minmax(170px,1fr) 44px 64px repeat(5, minmax(76px,96px)) 104px";
const label11 = { fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--color-neutral-700)" };

const tabS = (on: boolean): React.CSSProperties => ({
  whiteSpace: "nowrap", background: "none", border: 0, padding: "6px 0", font: "inherit", fontSize: 15,
  color: on ? "var(--color-text)" : "var(--color-neutral-700)", fontWeight: on ? 600 : 400, boxShadow: on ? "inset 0 -2px 0 var(--color-text)" : "none",
});

const pill = (on: boolean): React.CSSProperties => ({
  flex: "none", whiteSpace: "nowrap", background: on ? "var(--color-accent)" : "transparent", color: on ? "var(--color-bg)" : "var(--color-accent-800)",
  border: 0, boxShadow: on ? "none" : "inset 0 0 0 1px var(--color-divider)", padding: "5px 10px", font: "inherit", fontSize: 13, borderRadius: "var(--radius-md)",
});
const segS = (on: boolean): React.CSSProperties => ({ border: 0, padding: "6px 12px", font: "inherit", fontSize: 13, background: on ? "var(--color-accent)" : "transparent", color: on ? "var(--color-bg)" : "inherit", whiteSpace: "nowrap" });
const paneS = (on: boolean): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", background: "none", border: 0, padding: "4px 0", font: "inherit", fontSize: 14,
  color: on ? "var(--color-text)" : "var(--color-neutral-700)", fontWeight: on ? 600 : 400, boxShadow: on ? "inset 0 -2px 0 var(--color-text)" : "none",
});

function ScenarioStrip({ r, n, grid, askedBy, onBack }: { r: ScenarioResult; n: number; grid: Grid; askedBy: string; onBack: () => void }) {
  const d = r.award.total - r.base.total;
  const lbl = { ...label11, color: "var(--color-accent-800)" };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.8fr) minmax(0,1fr) auto", gap: 24, padding: "10px 28px 12px 8px", fontSize: 12.5, background: "var(--color-accent-100)", marginBottom: 4 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={lbl}>Scenario {n} · rules applied</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: "4px 18px" }}>
          {r.rules.map((t, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "24px 1fr", gap: 4, lineHeight: 1.35 }}>
              <span style={{ color: "var(--color-accent-800)", fontWeight: 600 }}>R{i + 1}</span><span>{t}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={lbl}>Excluded, and why</span>
        {r.excluded.length ? r.excluded.map((x) => <div key={x.vendorId}><span style={{ fontWeight: 600 }}>{x.name}</span>: {x.why}</div>) : <div>No vendor excluded.</div>}
        {r.notes.map((t, i) => <div key={i} style={{ color: "var(--color-neutral-800)" }}>{t}</div>)}
        <span style={{ fontSize: 12, color: "var(--color-neutral-700)", paddingTop: 4 }}>Asked by {askedBy}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", textAlign: "right" }}>
        <span style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.15 }}>{crore(r.award.total)}</span>
        <span style={{ color: "var(--color-accent-800)" }}>{d >= 0 ? "+" : "−"}{lakh(Math.abs(d))} ({d >= 0 ? "+" : "−"}{Math.abs((d / r.base.total) * 100).toFixed(1)}%) vs as quoted</span>
        <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{grid.vendors.filter((v) => r.award.byVendor[v.id].lines).map((v) => `${v.short} ${r.award.byVendor[v.id].lines}`).join(" · ")} lines</span>
        <button className="btn btn-ghost" onClick={onBack}>Back to as quoted</button>
      </div>
    </div>
  );
}

function ChartView({ grid, r }: { grid: Grid; r: ScenarioResult | null }) {
  const base = grid.asQuoted;
  const award = r?.award ?? base;
  const mx = Math.max(1, ...grid.vendors.map((v) => Math.max(base.byVendor[v.id].value, award.byVendor[v.id].value)));
  const bar = (x: number, c: string): React.CSSProperties => ({ display: "block", height: 12, width: `${Math.max(0.5, (x / mx) * 100)}%`, maxWidth: "calc(100% - 70px)", background: c });
  return (
    <div style={{ padding: "16px 8px 24px", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 40 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h3 style={{ fontSize: 20, margin: 0 }}>Award value by vendor</h3>
        <div style={{ display: "flex", gap: 18, fontSize: 12, color: "var(--color-neutral-700)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 8, background: "var(--color-neutral-400)" }} />As quoted (cheapest overall)</span>
          {r && <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 8, background: "var(--color-accent)" }} />This scenario</span>}
        </div>
        {grid.vendors.map((v) => (
          <div key={v.id} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, alignItems: "center" }}>
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
              <span style={{ fontWeight: 600 }}>{v.short}</span>
              <span style={{ fontSize: 11, color: "var(--color-neutral-700)" }}>{r?.excluded.some((e) => e.vendorId === v.id) ? "excluded" : `${award.byVendor[v.id].lines} lines`}</span>
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={bar(base.byVendor[v.id].value, "var(--color-neutral-400)")} /><span style={{ fontSize: 11, color: "var(--color-neutral-700)" }}>{base.byVendor[v.id].value ? lakh(base.byVendor[v.id].value) : "—"}</span></div>
              {r && <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={bar(award.byVendor[v.id].value, "var(--color-accent)")} /><span style={{ fontSize: 11 }}>{award.byVendor[v.id].value ? lakh(award.byVendor[v.id].value) : "—"}</span></div>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h3 style={{ fontSize: 20, margin: 0 }}>Lines that change hands</h3>
        {r && r.changed.length ? (
          <table className="table" style={{ fontSize: 13 }}>
            <thead><tr><th>Line</th><th>From</th><th>To</th><th style={{ textAlign: "right" }}>+ ₹/box</th><th style={{ textAlign: "right" }}>+ value</th></tr></thead>
            <tbody>
              {r.changed.map((x) => (
                <tr key={x.lineId}>
                  <td>{x.lineId}</td><td>{grid.vendors.find((v) => v.id === x.from)?.short ?? "—"}</td><td>{grid.vendors.find((v) => v.id === x.to)?.short ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>{x.delta >= 0 ? "+" : "−"}{num2(Math.abs(x.delta))}</td>
                  <td style={{ textAlign: "right" }}>{x.deltaValue >= 0 ? "+" : "−"}{lakh(Math.abs(x.deltaValue))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <span style={{ color: "var(--color-neutral-700)" }}>No lines change hands: this is the as-quoted view.</span>
        )}
      </div>
    </div>
  );
}

const STATE_LABEL: Record<GridCell["kind"], string> = {
  checked: "checked", converted: "converted", last_year: "last year’s rate", not_quoted: "not quoted", unclear: "not on the basis",
};

export default function ComparePage() {
  const { data, state } = useReadings();
  const [sel, setSel] = useState<{ v: string; l: string } | null>(null);
  const [legend, setLegend] = useState(true);
  const [tab, setTab] = useState<"compare" | "doubts">("compare");
  const [pane, setPane] = useState<"conv" | "src">("conv");
  const [view, setView] = useState<"table" | "chart">("table");
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [asked, setAsked] = useState<{ title: string; rules: ScenarioRules; asker: "buyer" | "vp" }[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [asker, setAsker] = useState<"buyer" | "vp">("vp");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const router = useRouter();

  const readings = useMemo(
    () => (data ? data.replies.map((r) => state[r.id]?.reading).filter((r): r is ReplyReading => Boolean(r && r.status !== "error")) : []),
    [data, state],
  );
  const grid = useMemo(() => {
    if (!data) return null;
    const files = Object.fromEntries(data.replies.map((r) => [r.id, mainFile(r, state[r.id]?.reading ?? null) ?? undefined]));
    return buildGrid(data.event, readings, { sheets: data.historySheets }, files, data.lastYear);
  }, [data, readings, state]);

  // Quality (code, from the questionnaire as read) and the doubts that could change a winner.
  const quality = useMemo(() => (data ? data.event.vendors.map((v) => qualityOf(data.event, v.id, readings)) : []), [data, readings]);
  const report = useMemo(
    () => (data && grid ? findDoubts(data.event, grid, quality.filter((q) => q.cleared).map((q) => q.vendorId)) : null),
    [data, grid, quality],
  );
  // Each cell a raised doubt is about, on the lines where it would change the winner.
  const doubtAt = useMemo(() => {
    const m = new Map<string, { d: Doubt; rank: number }>();
    report?.raised.forEach((d, i) => {
      const changed = new Set(d.changes.map((c) => c.lineId));
      for (const l of d.lineIds) if (changed.has(l) && !m.has(cellKey(d.vendorId, l))) m.set(cellKey(d.vendorId, l), { d, rank: i + 1 });
    });
    return m;
  }, [report]);

  // Every scenario asked so far, solved in code (the chat only chose the rules).
  const results = useMemo<ScenarioResult[]>(
    () => (data && grid ? asked.map((a) => runScenario(data.event, grid, quality, a.rules)) : []),
    [data, grid, quality, asked],
  );
  const cur = active != null ? results[active] ?? null : null;

  const ask = async (text: string) => {
    const who = asker;
    const next: ChatMsg[] = [...msgs, { role: "user", text, asker: who }];
    setMsgs(next);
    setQ("");
    setBusy(true);
    setPane("conv");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, text: m.text, asker: m.asker === "vp" ? `${data!.event.vp} (VP)` : m.asker ? `${data!.event.buyer} (buyer)` : undefined })) }),
      });
      const j = await res.json();
      if (j.error) { setMsgs((m) => [...m, { role: "assistant", text: j.error, error: true }]); return; }
      const added = (j.scenarios as (ScenarioRules & { title: string })[]).map(({ title, ...rules }) => ({ title, rules, asker: who }));
      const first = asked.length;
      setAsked((a) => [...a, ...added]);
      setMsgs((m) => [...m, { role: "assistant", text: j.answer, model: j.model, scenarios: added.map((_, i) => first + i) }]);
      if (added.length) { setActive(first + added.length - 1); setView(j.view ?? "table"); setLegend(false); setTab("compare"); }
    } catch {
      setMsgs((m) => [...m, { role: "assistant", text: "Something went wrong while answering. Nothing was changed; try again in a minute.", error: true }]);
    } finally {
      setBusy(false);
    }
  };

  // The table as shown (as quoted, or the active scenario), frozen with every number's source.
  const snapshotNow = (): Snapshot => {
    let decisions: Record<string, string> = {};
    try { decisions = JSON.parse(localStorage.getItem(DECISIONS_KEY) ?? "{}"); } catch { /* none */ }
    return freeze({ ev: data!.event, grid: grid!, quality, report: report!, lastYear: data!.lastYear, decisions,
      scenario: cur && active != null ? { title: asked[active].title, result: cur } : null });
  };

  // Where each file lives, to link "Open original".
  const paths: Record<string, string> = {};
  for (const r of data?.replies ?? []) for (const f of [...(r.cover ? [r.cover] : []), ...r.files]) paths[`${r.id}|${f.name.toLowerCase()}`] = f.path;
  paths[`history|se-2025-037_award_summary.xlsx`] = "dataset/04_history/SE-2025-037_Award_Summary.xlsx";

  if (!data || !grid || !report) return <div style={{ padding: 40, color: "var(--color-neutral-700)" }}>Loading the event…</div>;
  const ev = data.event;
  const pending = data.replies.filter((r) => !state[r.id] || state[r.id].stage !== "done").length;

  return (
    <div style={{ display: "flex", height: "100vh", minWidth: 1360, fontSize: 13, lineHeight: 1.4, fontVariantNumeric: "tabular-nums", overflow: "hidden" }}>
      <Rail />
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <header style={{ display: "flex", alignItems: "flex-end", gap: 24, padding: "18px 28px 10px 8px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginRight: "auto" }}>
            <span style={label11}>{ev.id} · {ev.buyerCo.replace(/ Pvt\. Ltd\.$/, "")}, Chakan · {ev.buyer}</span>
            <h1 style={{ fontSize: 26, margin: 0 }}>{ev.title}</h1>
          </div>
          <span style={{ color: "var(--color-neutral-700)", maxWidth: 330, textAlign: "right" }}>
            Every price per box, in rupees, delivered Chakan, GST extra.
          </span>
          <button className="btn btn-secondary" onClick={() => download(snapshotNow(), "xlsx")} title="Download the table as shown (Excel)"><Export size={16} weight="duotone" />Export</button>
          <button className="btn btn-primary" style={{ whiteSpace: "nowrap" }} onClick={() => {
            const s = snapshotNow();
            try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
            router.push(`/events/${ev.id}/award`);
          }}><SealCheck size={16} weight="duotone" />Freeze for award</button>
        </header>

        <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "0 28px 0 8px" }}>
          <button onClick={() => setTab("compare")} style={tabS(tab === "compare")}>Comparison</button>
          <button onClick={() => setTab("doubts")} style={tabS(tab === "doubts")}>
            Doubts <span style={{ color: "var(--color-accent-2-700)" }}>{report.raised.length}</span> · {lakh(report.raised.reduce((a, d) => a + d.stake, 0))} at stake
          </button>
          {pending > 0 && <span style={{ color: "var(--color-neutral-700)" }}>Reading {pending} more repl{pending === 1 ? "y" : "ies"}…</span>}
        </div>

        {tab === "doubts" ? (
          <DoubtsView grid={grid} report={report} onSee={(v, l) => { setSel({ v, l }); setTab("compare"); }} />
        ) : (
        <>
        <Legend open={legend} toggle={() => setLegend(!legend)} />

        <div style={{ display: "flex", alignItems: "center", gap: "10px 14px", padding: "2px 28px 8px 8px" }}>
          <span style={{ ...label11, flex: "none" }}>Table shows</span>
          <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 8, overflowX: "auto", padding: 2 }}>
            <button onClick={() => setActive(null)} style={pill(active == null)}>As quoted</button>
            {asked.map((a, i) => <button key={i} onClick={() => setActive(i)} style={pill(active === i)}>Scenario {i + 1} · {a.title}</button>)}
          </div>
          <div style={{ flex: "none", display: "inline-flex", border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
            <button onClick={() => setView("table")} style={segS(view === "table")}>Table</button>
            <button onClick={() => setView("chart")} style={segS(view === "chart")}>Chart</button>
          </div>
        </div>

        {cur && active != null && (
          <ScenarioStrip r={cur} n={active + 1} grid={grid} askedBy={asked[active].asker === "vp" ? `${ev.vp}, ${ev.vpRole}` : `${ev.buyer}, buyer`} onBack={() => setActive(null)} />
        )}

        <div style={{ flex: "1 0 460px", minHeight: 460, display: "flex" }}>
          <div style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "0 20px 0 8px" }}>
            {view === "chart" ? (
              <ChartView grid={grid} r={cur} />
            ) : (
              <GridTable grid={grid} sel={sel} quality={quality} doubtAt={doubtAt} award={cur?.award ?? grid.asQuoted} base={cur ? grid.asQuoted : null}
                excluded={new Set(cur?.excluded.map((e) => e.vendorId) ?? [])} scenarioNo={active != null ? active + 1 : null} onSelect={(v, l) => { setSel({ v, l }); setPane("src"); }} />
            )}
          </div>
        </div>
        </>
        )}
      </main>

      <aside style={{ width: 440, flex: "none", background: "var(--color-surface)", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ display: "flex", gap: 22, padding: "22px 22px 0" }}>
          <button onClick={() => setPane("conv")} style={paneS(pane === "conv")}><ChatsCircle size={16} weight="duotone" />Conversation</button>
          <button onClick={() => setPane("src")} style={paneS(pane === "src")}>
            <FileMagnifyingGlass size={16} weight="duotone" />
            {sel ? `Source · ${sel.l} ${grid.vendors.find((v) => v.id === sel.v)?.short}` : "Source"}
          </button>
        </div>
        {pane === "conv" ? (
          <Conversation msgs={msgs} results={results} titles={asked.map((a) => a.title)} people={{ buyer: ev.buyer, vp: ev.vp }} asker={asker} setAsker={setAsker}
            busy={busy} q={q} setQ={setQ} onAsk={ask} onShow={(i, v) => { setActive(i); setView(v); setTab("compare"); }}
            vendorNames={Object.fromEntries(grid.vendors.map((v) => [v.id, v.short]))}
            opening={`Quotes from ${new Set(readings.filter((r) => r.status === "read" && r.vendorId).map((r) => r.vendorId)).size} of ${ev.vendors.length} vendors are read and on one basis. ${report.raised.length} doubts could change a winner (${lakh(report.raised.reduce((a, d) => a + d.stake, 0))} at stake); see the Doubts tab. Ask me anything about this table; every answer is solved in code and applied to it as a scenario you can keep, compare and switch between.`} />
        ) : (
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "16px 22px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {sel ? (
            <SourcePanel grid={grid} sel={sel} readings={readings} paths={paths} doubt={doubtAt.get(cellKey(sel.v, sel.l))} report={report} onSelect={(v) => setSel({ v, l: sel.l })} onClose={() => setSel(null)} />
          ) : (
            <p style={{ margin: 0, color: "var(--color-neutral-700)", maxWidth: 320 }}>
              Click any price in the table to see where it was read, what the vendor wrote, and the arithmetic that put it on our basis.
            </p>
          )}
        </div>
        )}
      </aside>
    </div>
  );
}


function Legend({ open, toggle }: { open: boolean; toggle: () => void }) {
  const btn = { display: "flex", alignItems: "center", gap: 6, background: "none", border: 0, padding: 0, font: "inherit", ...label11 };
  if (!open)
    return (
      <div style={{ padding: "12px 28px 6px 8px" }}>
        <button onClick={toggle} style={{ ...btn, color: "var(--color-accent-800)" }}><CaretRight weight="duotone" />How to read a price</button>
      </div>
    );
  const chip = { minWidth: 50, padding: "3px 6px", textAlign: "right" as const, boxShadow: "inset 0 0 0 1px var(--color-divider)" };
  const item = (sample: React.ReactNode, name: string, meaning: string, nameColor?: string) => (
    <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {sample}
      <span style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontWeight: 600, color: nameColor }}>{name}</span>
        <span style={{ color: "var(--color-neutral-700)" }}>{meaning}</span>
      </span>
    </span>
  );
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 26px", padding: "14px 28px 10px 8px", fontSize: 12, lineHeight: 1.25 }}>
      <button onClick={toggle} style={btn}><CaretDown weight="duotone" />How to read a price</button>
      {item(<span style={chip}>24.60</span>, "Checked", "as written, passed the code checks")}
      {item(<span style={chip}><span style={{ textDecoration: "underline dotted var(--color-neutral-600)", textUnderlineOffset: 3 }}>24.60</span></span>, "Converted", "dotted line = a sum, click it")}
      {item(<span style={{ ...chip, fontStyle: "italic", color: "var(--color-neutral-800)" }}>24.60<sup style={{ fontSize: 8, fontStyle: "normal", letterSpacing: "0.04em", marginLeft: 1 }}>LY</sup></span>, "Last year’s price", "italic, from SE-2025-037")}
      {item(<span style={chip}>24.60<sup style={{ fontSize: 10, fontWeight: 600, marginLeft: 1 }}>↑</sup></span>, "Unusual price", "↑ or ↓ over 12% from should-cost")}
      {item(<span style={{ ...chip, color: "var(--color-neutral-500)" }}>—</span>, "Not quoted", "vendor skipped this line")}
      {item(<span style={{ ...chip, boxShadow: "none", background: "var(--color-accent-2-100)", color: "var(--color-accent-2-800)", fontWeight: 600 }}>24.60?</span>, "Doubt", "could change who wins", "var(--color-accent-2-800)")}
      {item(<span style={{ ...chip, fontWeight: 600 }}>24.60</span>, "Lowest", "bold = cheapest on the line")}
    </div>
  );
}

function GridTable({ grid, sel, quality, doubtAt, award, base, excluded, scenarioNo, onSelect }: {
  grid: Grid; sel: { v: string; l: string } | null; quality: Quality[]; doubtAt: Map<string, { d: Doubt; rank: number }>;
  award: Award; base: Award | null; excluded: Set<string>; scenarioNo: number | null; onSelect: (v: string, l: string) => void;
}) {
  const muted = { fontSize: 11, color: "var(--color-neutral-700)" };
  return (
    <>
      <div style={{ position: "sticky", top: 0, zIndex: 2, background: "var(--color-bg)", display: "grid", gridTemplateColumns: COLS, alignItems: "end", padding: "8px 0", borderBottom: "1px solid var(--color-text)" }}>
        <span style={muted}>Line</span>
        <span style={muted}>Box &amp; spec</span>
        <span style={{ ...muted, textAlign: "right" }}>Qty</span>
        <span style={{ ...muted, textAlign: "right", paddingRight: 6 }}>Should-cost</span>
        {grid.vendors.map((v) => {
          const Icon = FORMAT_ICON[v.format] ?? File;
          return (
            <div key={v.id} style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", textAlign: "right", gap: 1, paddingRight: 10, opacity: excluded.has(v.id) ? 0.45 : 1 }}>
              <span style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.15 }}>{v.short}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, ...muted }}><Icon weight="duotone" />{v.format}</span>
              {(() => {
                const q = quality.find((x) => x.vendorId === v.id);
                return <span style={{ fontSize: 11 }} title={q?.why}>{!q?.returned ? "No questionnaire" : `Quality ${q.cleared ? "✓" : "✕"}`}</span>;
              })()}
              <span style={{ fontSize: 10.5, color: "var(--color-neutral-700)", lineHeight: 1.25 }}>{excluded.has(v.id) ? `Excluded in scenario ${scenarioNo}` : v.note}</span>
            </div>
          );
        })}
        <span style={{ ...muted, paddingLeft: 12 }}>Lowest</span>
      </div>

      {grid.lines.map((l) => {
        const w = award.per[l.id];
        return (
          <div key={l.id} style={{ display: "grid", gridTemplateColumns: COLS, alignItems: "stretch", borderBottom: "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)", background: sel?.l === l.id ? "var(--color-neutral-200)" : "transparent" }}>
            <span style={{ color: "var(--color-neutral-700)", alignSelf: "center" }}>{l.id}</span>
            <span style={{ display: "flex", flexDirection: "column", minWidth: 0, paddingRight: 8, alignSelf: "center" }}>
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</span>
              <span style={{ fontSize: 11, color: "var(--color-neutral-700)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.spec}</span>
            </span>
            <span style={{ textAlign: "right", color: "var(--color-neutral-700)", alignSelf: "center" }}>{Math.round(l.qty / 1000)}k</span>
            <span style={{ textAlign: "right", color: "var(--color-neutral-700)", paddingRight: 6, alignSelf: "center" }}>{num2(l.shouldCost)}</span>
            {grid.vendors.map((v) => (
              <Cell key={v.id} c={grid.cells[cellKey(v.id, l.id)]} out={excluded.has(v.id)} doubt={doubtAt.has(cellKey(v.id, l.id)) && !excluded.has(v.id)} win={w?.vendorId === v.id} selected={sel?.v === v.id && sel.l === l.id} onClick={() => onSelect(v.id, l.id)} tip={`${v.short} · ${l.id}: ${grid.cells[cellKey(v.id, l.id)].norm.asWritten}`} />
            ))}
            <span style={{ display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: 12, lineHeight: 1.2 }}>
              <span>{w ? grid.vendors.find((v) => v.id === w.vendorId)?.short : "—"}</span>
              {base && base.per[l.id]?.vendorId !== w?.vendorId && (
                <span style={{ fontSize: 11, color: "var(--color-accent-800)" }}>was {grid.vendors.find((v) => v.id === base.per[l.id]?.vendorId)?.short ?? "none"}</span>
              )}
            </span>
          </div>
        );
      })}

      <div style={{ display: "grid", gridTemplateColumns: COLS, padding: "10px 0 24px", borderTop: "1px solid var(--color-text)", alignItems: "baseline" }}>
        <span /><span style={{ fontWeight: 600 }}>Lines won · award value</span><span /><span />
        {grid.vendors.map((v) => {
          const b = award.byVendor[v.id];
          return (
            <span key={v.id} style={{ textAlign: "right", paddingRight: 10, display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: 600 }}>{b.lines || "—"}</span>
              <span style={{ fontSize: 11, color: "var(--color-neutral-700)" }}>{b.lines ? lakh(b.value) : ""}</span>
            </span>
          );
        })}
        <span style={{ paddingLeft: 12, fontWeight: 600 }}>{crore(award.total)}</span>
      </div>
    </>
  );
}

function Cell({ c, out, doubt, win, selected, onClick, tip }: { c: GridCell; out: boolean; doubt: boolean; win: boolean; selected: boolean; onClick: () => void; tip: string }) {
  const k = c.kind;
  const ns = {
    color: doubt ? "var(--color-accent-2-800)" : k === "not_quoted" || k === "unclear" ? "var(--color-neutral-500)" : k === "last_year" ? "var(--color-neutral-800)" : "var(--color-text)",
    fontStyle: k === "last_year" ? ("italic" as const) : ("normal" as const),
    fontWeight: win || doubt ? 600 : 400,
    textDecoration: k === "converted" ? "underline dotted var(--color-neutral-600)" : "none",
    textUnderlineOffset: 3,
  };
  const mark = doubt ? "?" : k === "last_year" ? "LY" : c.band === "high" ? "↑" : c.band === "low" ? "↓" : "";
  return (
    <button
      onClick={onClick}
      title={tip}
      style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%", minHeight: 38, padding: "0 10px", border: 0, font: "inherit", fontSize: 13.5, background: doubt ? "var(--color-accent-2-100)" : "transparent", outline: selected ? "2px solid var(--color-accent)" : "none", outlineOffset: -2, color: "inherit", opacity: out ? 0.4 : 1 }}
    >
      <span style={ns}>
        {c.perBox == null ? (k === "unclear" ? "n/a" : "—") : num2(c.perBox)}
        {mark && <sup style={{ fontSize: k === "last_year" ? 8 : 10, fontStyle: "normal", fontWeight: 600, marginLeft: 1, letterSpacing: "0.04em", display: "inline-block" }}>{mark}</sup>}
      </span>
    </button>
  );
}

function SourcePanel({ grid, sel, readings, paths, doubt, report, onSelect, onClose }: {
  grid: Grid; sel: { v: string; l: string }; readings: ReplyReading[]; paths: Record<string, string>;
  doubt: { d: Doubt; rank: number } | undefined; report: DoubtReport; onSelect: (v: string) => void; onClose: () => void;
}) {
  const line = grid.lines.find((l) => l.id === sel.l)!;
  const c = grid.cells[cellKey(sel.v, sel.l)];
  const n = c.norm;
  const vendor = grid.vendors.find((v) => v.id === sel.v)!;
  const reading = readings.find((r) => r.replyId === n.replyId);
  const w = grid.asQuoted.per[line.id];
  const winner = w ? grid.vendors.find((v) => v.id === w.vendorId) : null;

  const steps: { stage: string; who: string; text: React.ReactNode }[] = [];
  if (n.source) {
    steps.push({
      stage: "Read", who: "AI read",
      text: (
        <>
          {vendor.short} wrote “{n.vendorWording ?? n.asWritten}”: {n.asWritten}, at {where(n.source)}.
          {n.matchReason && <> {n.matchReason}</>}
          {reading?.readAt && <span style={{ color: "var(--color-neutral-700)" }}> Read on {day(reading.readAt)} by {reading.models.join(" and ")}.</span>}
        </>
      ),
    });
  } else {
    steps.push({ stage: "Read", who: "AI read", text: n.flags[0] ?? "Not in the reply." });
  }
  if (c.perBox != null) {
    const usd = n.flags.find((f) => f.startsWith("quoted in USD"));
    steps.push({
      stage: "Calculate", who: "Code",
      text: (
        <>
          {n.calc === "as written" ? "Already per box, delivered, ex-GST. No conversion." : <>{n.calc} = <b>{inr(c.perBox)}</b> per box, delivered, ex-GST.</>}
          {usd && <> USD at ₹{USD_REFERENCE.rate} (reference rate, {USD_REFERENCE.date}).</>}
          {n.flags.filter((f) => !f.startsWith("quoted in USD") && !f.startsWith("priced")).map((f, i) => <span key={i}> {f[0].toUpperCase() + f.slice(1)}.</span>)}
          {n.variants.conditionalDiscount && <> Kept apart: {inr(n.variants.conditionalDiscount.value)} {n.variants.conditionalDiscount.when}.</>}
          {n.variants.lastYearFreight && <> Kept apart: {inr(n.variants.lastYearFreight.value)} {n.variants.lastYearFreight.when}.</>}
        </>
      ),
    });
  } else if (c.kind === "unclear") {
    steps.push({ stage: "Calculate", who: "Code", text: n.flags.join(" ") });
  }
  if (n.verification || c.deviation != null) {
    steps.push({
      stage: "Verify", who: "Independent check",
      text: (
        <>
          {n.verification && <>{n.verification.status === "photo" ? "Read from a photo: code cannot search an image, so this was read by eye." : n.verification.note}</>}
          {c.deviation != null && (
            <> Should-cost {inr(line.shouldCost)}; this is {Math.abs(Math.round(c.deviation * 100))}% {c.deviation >= 0 ? "above" : "below"}
              {c.band ? <b>, outside the ±12% band</b> : ", inside the ±12% band"}.</>
          )}
          {c.unitWarning && <b> {c.unitWarning}</b>}
          {c.perBox != null && (c.lastYear ? <> {c.lastYear.note}</> : <> No price on record from last year: a new item.</>)}
        </>
      ),
    });
  }
  steps.push({
    stage: "Decide", who: "You",
    text: doubt ? <>{doubt.d.ask} {doubt.d.route === "vendor" ? "An email is ready to draft on the Doubts tab." : "Decide on the Doubts tab."}</>
      : c.perBox == null ? "Nothing to decide on this cell."
      : !c.canWin ? <>Shown, but cannot win yet: {c.whyNot}.</>
      : w?.vendorId === sel.v ? "Lowest on the line as quoted."
      : <>{inr(c.perBox - (w?.perBox ?? 0))} a box above the lowest ({winner?.short}).</>,
  });

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginRight: "auto" }}>
          <span style={label11}>Source · {line.id}</span>
          <span style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.2 }}>{line.name}</span>
          <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{line.spec} · {Math.round(line.qty / 1000)}k boxes</span>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={onClose} title="Close"><X size={18} weight="duotone" /></button>
      </div>
      {doubt && (
        <div style={{ color: "var(--color-accent-2-800)", fontWeight: 600 }}>
          Doubt {doubt.rank} of {report.raised.length} · {lakh(doubt.d.stake)} at stake. {doubt.d.title}
        </div>
      )}

      {n.source && (
        <SourceDoc
          replyId={n.replyId}
          source={n.source}
          raw={n.raw}
          lineId={line.id}
          filePath={paths[`${n.replyId}|${n.source.file.toLowerCase()}`] ?? paths[`history|${n.source.file.toLowerCase()}`] ?? null}
        />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={label11}>As written</span>
          <span style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.2 }}>{n.asWritten}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={label11}>On our basis</span>
          <span style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.2 }}>{c.perBox != null ? inr(c.perBox) : "—"}</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {steps.map((s) => (
          <div key={s.stage} style={{ display: "grid", gridTemplateColumns: "92px 1fr", gap: 10 }}>
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
              <span style={{ fontWeight: 600 }}>{s.stage}</span>
              <span style={{ fontSize: 11, color: "var(--color-neutral-700)" }}>{s.who}</span>
            </span>
            <span style={{ textWrap: "pretty" }}>{s.text}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={label11}>Same line, every vendor</span>
        {grid.vendors.map((v) => {
          const pc = grid.cells[cellKey(v.id, line.id)];
          return (
            <button key={v.id} onClick={() => onSelect(v.id)} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px", gap: 8, padding: "5px 6px", background: v.id === sel.v ? "var(--color-accent-100)" : "transparent", border: 0, font: "inherit", color: "inherit", textAlign: "left" }}>
              <span>{v.short}</span>
              <span style={{ color: "var(--color-neutral-700)", fontSize: 12 }}>{STATE_LABEL[pc.kind]}{pc.band ? `, ${pc.band === "high" ? "↑" : "↓"} unusual` : ""}</span>
              <span style={{ textAlign: "right", fontWeight: 600 }}>{pc.perBox != null ? inr(pc.perBox) : "—"}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
