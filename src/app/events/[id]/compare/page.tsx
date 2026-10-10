"use client";
// Comparison (design: "Comparison - Ledger"). Every line by every vendor on one basis, built in
// code from the readings. Click a price to see where it came from and how it was converted.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CaretDown, CaretRight, ChatsCircle, Export, SealCheck, FileMagnifyingGlass, X,
} from "@phosphor-icons/react";
import { Rail } from "@/components/Rail";
import { Kpis, PageHead, QualityLabel, tabStyle } from "@/components/ui";
import { AWARD_BY } from "@/lib/routes";
import { SourceDoc } from "@/components/SourceDoc";
import { Conversation, VP_QUESTION, type AnswerMeta, type ChatMsg, type Store } from "@/components/Conversation";
import type { BaselineKey } from "@/lib/baseline";
import { shares as sharesOf, yoyDrivers } from "@/lib/facts";
import { DoubtsView } from "@/components/DoubtsView";
import { useDecisions } from "@/components/useDecisions";
import { applyDecisions } from "@/lib/decisions";
import { freeze, OVERRIDES_KEY, SNAPSHOT_KEY, type Override, type Snapshot } from "@/lib/award";
import { download } from "@/lib/download";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LIBRARY, runScenario, sameRules, type ScenarioResult, type ScenarioRules } from "@/lib/scenario";
import { useScheme } from "@/components/useScheme";
import { useRole } from "@/components/useRole";
import { checkKey, stamp, useVerified, type Check, type Checks } from "@/components/useVerified";
import { useReadings } from "@/components/useReadings";
import { findDoubts, loggedLabel, withPatch, type Doubt, type DoubtReport } from "@/lib/doubts";
import { qualityOf, type Quality } from "@/lib/quality";
import type { SourcingEvent } from "@/lib/types";
import { buildGrid, cellKey, type Award, type Grid, type GridCell } from "@/lib/compare";
import { crore, day, inr, lakh, num2, where } from "@/lib/format";
import type { ReplyReading } from "@/lib/reader/pipeline";
import { mainFile } from "@/lib/summary";
import { USD_REFERENCE } from "@/lib/config";

const COLS = "minmax(240px,2.4fr) repeat(5, minmax(0,1fr))";
const label11 = { fontSize: 14, color: "var(--color-neutral-700)" };

const segS = (on: boolean): React.CSSProperties => ({ border: 0, padding: "6px 12px", font: "inherit", fontSize: 15, background: on ? "var(--color-accent)" : "transparent", color: on ? "var(--color-bg)" : "inherit", whiteSpace: "nowrap" });
const paneS = (on: boolean): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", background: "none", border: 0, padding: "4px 0 6px", font: "inherit", fontSize: 16, cursor: "pointer",
  color: on ? "var(--color-text)" : "var(--color-neutral-800)", fontWeight: on ? 600 : 400, boxShadow: on ? "inset 0 -3px 0 var(--color-accent)" : "none",
});

function ScenarioStrip({ r, title, grid, askedBy, onBack, backLabel }: { r: ScenarioResult; title: string; grid: Grid; askedBy: string | null; onBack: () => void; backLabel: string }) {
  const d = r.award.total - r.base.total;
  const lbl = { ...label11, color: "var(--color-accent-800)" };
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "10px 14px", fontSize: 15, background: "var(--color-accent-100)", borderRadius: "var(--radius-lg)" }}>
        <button onClick={() => setOpen(true)} aria-expanded={false} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: 0, padding: 0, font: "inherit", fontWeight: 600, color: "var(--color-accent-800)", cursor: "pointer" }}>
          <CaretRight weight="duotone" />{title}
        </button>
        <span style={{ color: "var(--color-neutral-800)" }}>
          {r.rules.length} rules · {r.excluded.length ? `${r.excluded.map((x) => grid.vendors.find((v) => v.id === x.vendorId)?.short ?? x.name).join(" and ")} excluded` : "no vendor excluded"} · {r.changed.length} line{r.changed.length === 1 ? "" : "s"} change hands
        </span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <b>{crore(r.award.total)}</b>
          <span style={{ color: "var(--color-accent-800)" }}>{d >= 0 ? "+" : "−"}{lakh(Math.abs(d))} vs cheapest overall</span>
          <button className="btn btn-ghost" style={{ padding: "2px 6px" }} onClick={onBack}>{backLabel}</button>
        </span>
      </div>
    );
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 24, padding: "12px 14px", fontSize: 15, background: "var(--color-accent-100)", borderRadius: "var(--radius-lg)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button onClick={() => setOpen(false)} aria-expanded style={{ ...lbl, display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: 0, padding: 0, font: "inherit", fontSize: 15, cursor: "pointer", alignSelf: "flex-start" }}>
            <CaretDown weight="duotone" />{title} · rules applied
          </button>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: "4px 18px" }}>
            {r.rules.map((t, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "26px 1fr", gap: 4, lineHeight: 1.35 }}>
                <span style={{ color: "var(--color-accent-800)", fontWeight: 600 }}>R{i + 1}</span><span>{t}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={lbl}>Excluded, and why</span>
          {r.excluded.length ? r.excluded.map((x) => <div key={x.vendorId}><span style={{ fontWeight: 600 }}>{x.name}</span>: {x.why}</div>) : <div>No vendor excluded.</div>}
          {r.notes.map((t, i) => <div key={i} style={{ color: "var(--color-neutral-800)" }}>{t}</div>)}
          {askedBy && <span style={{ fontSize: 14, color: "var(--color-neutral-700)", paddingTop: 4 }}>{askedBy}</span>}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", textAlign: "right" }}>
        <span style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.15 }}>{crore(r.award.total)}</span>
        <span style={{ color: "var(--color-accent-800)" }}>{d >= 0 ? "+" : "−"}{lakh(Math.abs(d))} ({d >= 0 ? "+" : "−"}{Math.abs((d / r.base.total) * 100).toFixed(1)}%) vs cheapest overall</span>
        <span style={{ fontSize: 14, color: "var(--color-neutral-700)", maxWidth: 220 }}>{grid.vendors.filter((v) => r.award.byVendor[v.id].lines).map((v) => `${v.short} ${r.award.byVendor[v.id].lines}`).join(" · ")} lines</span>
        <button className="btn btn-ghost" onClick={onBack}>{backLabel}</button>
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
        <div style={{ display: "flex", gap: 18, fontSize: 14, color: "var(--color-neutral-700)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 8, background: "var(--color-neutral-400)" }} />As quoted (cheapest overall)</span>
          {r && <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 8, background: "var(--color-accent)" }} />This scenario</span>}
        </div>
        {grid.vendors.map((v) => (
          <div key={v.id} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, alignItems: "center" }}>
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
              <span style={{ fontWeight: 600 }}>{v.short}</span>
              <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>{r?.excluded.some((e) => e.vendorId === v.id) ? "excluded" : `${award.byVendor[v.id].lines} lines`}</span>
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={bar(base.byVendor[v.id].value, "var(--color-neutral-400)")} /><span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>{base.byVendor[v.id].value ? lakh(base.byVendor[v.id].value) : "—"}</span></div>
              {r && <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={bar(award.byVendor[v.id].value, "var(--color-accent)")} /><span style={{ fontSize: 13 }}>{award.byVendor[v.id].value ? lakh(award.byVendor[v.id].value) : "—"}</span></div>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h3 style={{ fontSize: 20, margin: 0 }}>Lines that change hands</h3>
        {r && r.changed.length ? (
          <table className="table" style={{ fontSize: 15 }}>
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

/**
 * L29: an AI-drafted counter-offer to a vendor that is not winning a line, asking it to sharpen its
 * price toward a target set in code. The draft never names other vendors or whose price the target is.
 */
function CounterOffer({ vendorId, line, cell, target }: { vendorId: string; line: Grid["lines"][number]; cell: GridCell; target: number }) {
  const [d, setD] = useState<{ to: string; subject: string; body: string; model?: string } | { error: string } | "loading" | null>(null);
  const [sent, setSent] = useState(false);
  const draft = async () => {
    setD("loading");
    try {
      const r = await fetch("/api/draft", {
        method: "POST",
        body: JSON.stringify({
          vendorId,
          title: `Counter-offer on ${line.id} (${line.name})`,
          ask: `Ask the vendor to sharpen its price for ${line.id} (${line.name}, ${line.qty.toLocaleString("en-IN")} boxes) to ₹${target.toFixed(2)} per box delivered Chakan, ex-GST, our target for this line, and to confirm in writing. Do not say where the target comes from.`,
          lines: [`${line.id} ${line.name}: ${cell.norm.asWritten} → ₹${cell.perBox!.toFixed(2)} per box delivered`],
          howRead: cell.norm.flags.slice(0, 3),
        }),
      });
      setD(await r.json());
    } catch {
      setD({ error: "The draft could not be written just now. Try again in a minute." });
    }
  };
  return (
    <details>
      <summary style={{ cursor: "pointer", color: "var(--color-accent-800)" }}>Counter-offer: ask this vendor to sharpen {line.id} toward {inr(target)}</summary>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 6 }}>
        <span style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>The target is set in code from the line’s lowest price; the email does not say whose it is.</span>
        {sent ? <span style={{ color: "var(--color-accent-800)" }}>Approved by you and marked as sent. (Demo: no email server; nothing left this app.)</span>
          : !d ? <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={draft}>Draft the counter-offer</button>
          : d === "loading" ? <span style={{ color: "var(--color-neutral-700)" }}>Drafting with AI…</span>
          : "error" in d ? <span>{d.error} <button className="btn btn-ghost" onClick={draft}>Try again</button></span>
          : (
            <>
              <span style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>To {d.to} · {d.subject} · drafted by {d.model ?? "AI"}, for you to check</span>
              <textarea className="input" style={{ minHeight: 170, whiteSpace: "pre-wrap", background: "var(--color-bg)" }} value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} />
              <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => setSent(true)}>Approve &amp; send</button>
            </>
          )}
      </div>
    </details>
  );
}

/** L32: award a line to another vendor, with a reason; recorded with who and when. */
function OverrideBox({ line, grid, shown, current, buyer, onOverride }: {
  line: string; grid: Grid; shown: Award; current: Override | undefined; buyer: string; onOverride: (o: Override) => void;
}) {
  const [to, setTo] = useState("");
  const [why, setWhy] = useState("");
  const winner = shown.per[line]?.vendorId ?? null;
  const name = (v: string | null) => grid.vendors.find((x) => x.id === v)?.short ?? "nobody";
  if (current)
    return (
      <div style={{ display: "grid", gridTemplateColumns: "92px 1fr", gap: 10 }}>
        <span style={{ fontWeight: 600 }}>Override</span>
        <span>
          {current.who} moved {line} from {name(current.from)} to {name(current.to)} on {new Date(current.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })}: “{current.why}”.{" "}
          <button className="btn btn-ghost" style={{ padding: "0 4px" }} onClick={() => onOverride({ ...current, to: "" })}>Undo</button>
        </span>
      </div>
    );
  const options = grid.vendors.filter((v) => v.id !== winner && grid.cells[cellKey(v.id, line)].perBox != null);
  return (
    <details>
      <summary style={{ cursor: "pointer", color: "var(--color-accent-800)" }}>Override: award {line} to another vendor</summary>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 6 }}>
        <select className="input" value={to} onChange={(e) => setTo(e.target.value)} style={{ minHeight: 32, padding: "4px 8px" }}>
          <option value="">Choose a vendor…</option>
          {options.map((v) => <option key={v.id} value={v.id}>{v.short} at {inr(grid.cells[cellKey(v.id, line)].perBox!)}</option>)}
        </select>
        <input className="input" placeholder="Why (recorded with your name)" value={why} onChange={(e) => setWhy(e.target.value)} style={{ minHeight: 32 }} />
        <button className="btn btn-primary" disabled={!to || !why.trim()} style={{ alignSelf: "flex-start" }}
          onClick={() => onOverride({ lineId: line, from: winner, to, why: why.trim(), who: buyer, at: new Date().toISOString() })}>
          Record override
        </button>
      </div>
    </details>
  );
}

const STATE_LABEL: Record<GridCell["kind"], string> = {
  checked: "checked", converted: "converted", last_year: "last year’s rate", not_quoted: "not quoted", unclear: "not on the basis",
};

type Show = "all" | "doubts" | "changed" | "unverified";
interface Asked { title: string; rules: ScenarioRules; asker: "buyer" | "vp"; libKey: string | null; meta: AnswerMeta }
const SHOW: [Show, string][] = [["all", "All lines"], ["doubts", "With doubts"], ["changed", "Winner changed"], ["unverified", "Not approved by you"]];
const NO_FILTER = { show: "all" as Show, win: "" };
const DEFAULT_SCENARIO = "S1";
const GUIDE_KEY = "parakh-guide-open";
const START_KEY = "parakh-start-dismissed";

export default function ComparePage() {
  const { data, state, empty } = useReadings();
  const [scheme] = useScheme();
  const [role] = useRole();
  const [checks, setCheck] = useVerified();
  const [decisions, recordDecision, undoDecision] = useDecisions();
  const [sel, setSel] = useState<{ v: string; l: string } | null>(null);
  // "How to read a price": open by default; the buyer's toggle is remembered in this browser.
  const [guideOpen, setGuideOpenState] = useState(true);
  useEffect(() => { try { if (localStorage.getItem(GUIDE_KEY) === "0") setGuideOpenState(false); } catch { /* default */ } }, []);
  const setGuideOpen = (v: boolean) => { setGuideOpenState(v); try { localStorage.setItem(GUIDE_KEY, v ? "1" : "0"); } catch { /* kept for this visit */ } };
  const [tab, setTab] = useState<"compare" | "doubts">("compare");
  const [pane, setPane] = useState<"conv" | "src">("conv");
  const [view, setView] = useState<"table" | "chart">("table");
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [asked, setAsked] = useState<Asked[]>([]);
  // The view on screen: a library strategy ("base", "S1", …) or a scenario asked in chat ("asked:3").
  // Opens on the VP's view (quality-cleared only); a #scenario=<key> link wins. "As quoted" stays first in the list as the reference.
  const [scen, setScen] = useState<string>(DEFAULT_SCENARIO);
  useEffect(() => {
    const h = window.location.hash.match(/scenario=([\w:]+)/)?.[1];
    if (h && LIBRARY.some((x) => x.key === h)) setScen(h);
  }, []);
  const [f, setF] = useState<{ show: Show; win: string }>(NO_FILTER);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const router = useRouter();
  const asker: "buyer" | "vp" = role === "VP" ? "vp" : "buyer";

  const readings = useMemo(
    () => (data ? data.replies.map((r) => state[r.id]?.reading).filter((r): r is ReplyReading => Boolean(r && r.status !== "error")) : []),
    [data, state],
  );
  const grid = useMemo(() => {
    if (!data) return null;
    const files = Object.fromEntries(data.replies.map((r) => [r.id, mainFile(r, state[r.id]?.reading ?? null) ?? undefined]));
    // The buyer's recorded decisions apply on top of the table as read (accepted prices may win).
    return applyDecisions(data.event, buildGrid(data.event, readings, { sheets: data.historySheets }, files, data.lastYear), decisions);
  }, [data, readings, state, decisions]);

  // Quality (code, from the questionnaire as read, marked against the buyer's scheme) and the doubts that could change a winner.
  const quality = useMemo(() => (data ? data.event.vendors.map((v) => qualityOf(data.event, v.id, readings, scheme)) : []), [data, readings, scheme]);
  const report = useMemo(
    () => (data && grid ? findDoubts(data.event, grid, quality.filter((q) => q.cleared).map((q) => q.vendorId)) : null),
    [data, grid, quality],
  );
  // Every scenario asked so far, solved in code (the chat only chose the rules).
  const results = useMemo<ScenarioResult[]>(
    () => (data && grid ? asked.map((a) => runScenario(data.event, grid, quality, a.rules)) : []),
    [data, grid, quality, asked],
  );
  // For each answer's scenario: the open doubts whose other reading would change a winner under its rules (the chat's caveat bullet).
  const openFor = useMemo<number[][]>(
    () => (data && grid && report ? asked.map((a, i) => {
      const now = results[i]?.award;
      if (!now) return [];
      return report.raised.map((d, k) => ({ d, k })).filter(({ d }) => {
        const alt = runScenario(data.event, withPatch(grid, d.patch), quality, a.rules).award;
        return data.event.lines.some((l) => alt.per[l.id]?.vendorId !== now.per[l.id]?.vendorId);
      }).map(({ k }) => k);
    }) : []),
    [data, grid, report, quality, asked, results],
  );
  // The panel reads the same computed store as the table: one solver, one fact set.
  const store = useMemo<Store | null>(() => {
    if (!data || !grid) return null;
    const cache = new Map<string, ScenarioResult>();
    return {
      solve: (rules) => { const k = JSON.stringify(rules); if (!cache.has(k)) cache.set(k, runScenario(data.event, grid, quality, rules)); return cache.get(k)!; },
      yoy: (r, n) => yoyDrivers(data.event, r.award, data.lastYear, n),
      shares: (r) => sharesOf(grid, r.award),
      lyLines: data.lastYear.length,
    };
  }, [data, grid, quality]);
  // L32: buyer overrides with an audit trail (who, from, to, why, when), kept in this browser.
  const [overrides, setOverridesState] = useState<Override[]>([]);
  useEffect(() => {
    try { setOverridesState(JSON.parse(localStorage.getItem(OVERRIDES_KEY) ?? "[]")); } catch { /* none yet */ }
  }, []);
  const setOverrides = (o: Override[]) => {
    setOverridesState(o);
    try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(o)); } catch { /* kept for this visit */ }
  };

  // The active strategy: its title, rules, and who asked for it in chat (if anyone).
  const active = useMemo(() => {
    if (scen.startsWith("asked:")) {
      const a = asked[Number(scen.slice(6))];
      if (a) return { title: a.title, desc: "Asked in chat; solved in code with the rules below.", rules: a.rules, asker: a.asker as "buyer" | "vp" | null };
    }
    const lib = LIBRARY.find((x) => x.key === scen) ?? LIBRARY[0];
    const by = [...asked].reverse().find((a) => a.libKey === lib.key);
    return { title: lib.title, desc: lib.desc, rules: lib.rules, asker: by?.asker ?? null };
  }, [scen, asked]);
  const isScenario = scen !== "base";
  // The view on screen, with the buyer's overrides applied on top.
  // The rules on screen: the active strategy, with lines it fixes (e.g. "award L01 to Shree Balaji") kept and the buyer's own overrides winning on the same line.
  const rulesNow = useMemo<ScenarioRules>(() => {
    const mine = overrides.map((o) => ({ lineId: o.lineId, vendorId: o.to }));
    const fixed = [...(active.rules.overrides ?? []).filter((x) => !mine.some((m) => m.lineId === x.lineId)), ...mine];
    return { ...active.rules, overrides: fixed };
  }, [active, overrides]);
  const cur = useMemo<ScenarioResult | null>(() => {
    if (!data || !grid) return null;
    if (!isScenario && !overrides.length) return null;
    return runScenario(data.event, grid, quality, rulesNow);
  }, [data, grid, quality, rulesNow, isScenario, overrides]);
  // Every doubt (raised or logged) re-solved under the view on screen: the lines whose winner flips if its other reading holds.
  const flips = useMemo(() => {
    const m = new Map<string, Set<string>>();
    if (!data || !grid || !report) return m;
    const now = cur?.award ?? grid.asQuoted;
    for (const d of [...report.raised, ...report.logged]) {
      const alt = runScenario(data.event, withPatch(grid, d.patch), quality, rulesNow).award;
      m.set(d.id, new Set(data.event.lines.filter((l) => alt.per[l.id]?.vendorId !== now.per[l.id]?.vendorId).map((l) => l.id)));
    }
    return m;
  }, [data, grid, report, quality, rulesNow, cur]);
  // A cell carries "?" only where its doubt would change the winner in this view (scenario and overrides).
  const doubtAt = useMemo(() => {
    const m = new Map<string, { d: Doubt; rank: number }>();
    report?.raised.forEach((d, i) => {
      const f = flips.get(d.id);
      for (const l of d.lineIds) if (f?.has(l) && !m.has(cellKey(d.vendorId, l))) m.set(cellKey(d.vendorId, l), { d, rank: i + 1 });
    });
    return m;
  }, [report, flips]);

  const ask = async (text: string, as?: "buyer" | "vp") => {
    const who = as ?? asker;
    const next: ChatMsg[] = [...msgs, { role: "user", text, asker: who }];
    setMsgs(next);
    setQ("");
    setBusy(true);
    setPane("conv");
    // The answer streams in: rules first (the table switches at once), then the words.
    const at = next.length;
    const put = (patch: Partial<ChatMsg>) => setMsgs((m) => {
      const cur = m[at] ?? { role: "assistant" as const, text: "" };
      const out = [...m];
      out[at] = { ...cur, ...patch };
      return out;
    });
    // Scenarios this answer adds go after the ones already asked.
    const base = asked.length;
    let added = 0;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          scheme, readings, decisions, prior: asked.map((a) => ({ title: a.title, ...a.rules })), active: rulesNow,
          messages: next.map((m) => ({ role: m.role, text: m.text, asker: m.asker === "vp" ? `${data!.event.vp} (VP)` : m.asker ? `${data!.event.buyer} (buyer)` : undefined })),
        }),
      });
      if (!res.body || !res.ok) throw new Error(`Server answered ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "", textSoFar = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const msg = JSON.parse(buf.slice(0, nl));
          buf = buf.slice(nl + 1);
          if (msg.type === "status") put({ status: msg.text });
          else if (msg.type === "scenario" || msg.type === "yoy") {
            const { title, ...rules } = msg.scenario as ScenarioRules & { title: string };
            const lib = LIBRARY.find((x) => sameRules(x.rules, rules));
            const meta: AnswerMeta = msg.type === "yoy" ? { kind: "yoy", n: msg.n } : { kind: "scenario", baseline: msg.baseline as BaselineKey, cap: rules.cap ?? null };
            const a: Asked = { title: lib?.title ?? title, rules, asker: who, libKey: lib?.key ?? null, meta };
            const index = base + added++;
            setAsked((xs) => [...xs, a]);
            put({ scenarios: [...Array(added).keys()].map((k) => base + k) });
            setScen(a.libKey ?? `asked:${index}`);
            setView(msg.view === "chart" ? "chart" : "table"); setTab("compare");
          } else if (msg.type === "export") {
            // Exported after the table has switched to the answer's view.
            setTimeout(() => exportRef.current?.(), 300);
          } else if (msg.type === "delta") { textSoFar += msg.text; put({ text: textSoFar, status: undefined }); }
          else if (msg.type === "done") put({ model: msg.model, status: undefined });
          else if (msg.type === "error") put({ text: msg.message, error: true, status: undefined });
        }
      }
    } catch {
      put({ text: "Something went wrong while answering. Nothing was changed; try again in a minute.", error: true, status: undefined });
    } finally {
      setBusy(false);
    }
  };

  // "‡" on a vendor whose prices carry a condition: said once, in the header; the cells mark it only where it changes a winner.
  const vendorNote = useMemo(() => {
    const out: Record<string, string> = {};
    if (!data || !grid || !report) return out;
    const plan = Object.values(data.event.terms).join(" ").match(/monthly PO value per vendor\s+INR\s*([\d.]+)\s*[-–]\s*([\d.]+)\s*lakh/i);
    for (const v of grid.vendors) {
      const disc = data.event.lines.map((l) => grid.cells[cellKey(v.id, l.id)].norm.variants.conditionalDiscount).find(Boolean);
      if (!disc) continue;
      const pct = disc.calc.match(/less ([\d.]+)%/)?.[1];
      const rank = report.raised.findIndex((d) => d.kind === "conditional_discount" && d.vendorId === v.id) + 1;
      out[v.id] = `Prices are shown without ${v.short}’s ${pct}% discount, which applies only ${disc.when.replace(/^if (provided )?(that )?(the value of )?/i, "if ")}.`
        + (plan ? ` The RFQ plans monthly POs of ₹${plan[1]}–${plan[2]} L per vendor.` : "")
        + (rank ? ` Doubt ${rank}.` : " Logged: it does not change a winner.");
    }
    return out;
  }, [data, grid, report]);
  // A cell read two ways: both readings, the one in use, and whether it is logged or a doubt in this view.
  const readNote = useMemo(() => {
    const out = new Map<string, string>();
    if (!grid || !report) return out;
    for (const c of Object.values(grid.cells)) {
      if (c.perBox == null || !c.norm.alternatives.length) continue;
      const k = cellKey(c.vendorId, c.lineId);
      const raised = report.raised.findIndex((d) => d.kind === "hard_to_read" && d.vendorId === c.vendorId && d.lineIds.includes(c.lineId));
      const how = c.norm.legibility === "corrected_by_hand" ? "hand-corrected" : "hard to read";
      out.set(k, `Two readings: ${[c.perBox, ...c.norm.alternatives.map((a) => a.perBox)].map((x) => `₹${x.toFixed(2)}`).join(" · ")} (${how}). Using ₹${c.perBox.toFixed(2)}. `
        + (raised < 0 ? "Logged." : doubtAt.has(k) ? `Doubt ${raised + 1}.` : `Doubt ${raised + 1}; no winner changes in this view.`));
    }
    return out;
  }, [grid, report, doubtAt]);
  const twoReadingsNote = (v: string, l: string) => {
    if (!report) return null;
    const i = report.raised.findIndex((d) => d.kind === "hard_to_read" && d.vendorId === v && d.lineIds.includes(l));
    const d = i >= 0 ? report.raised[i] : report.logged.find((x) => x.kind === "hard_to_read" && x.vendorId === v && x.lineIds.includes(l));
    if (!d) return null;
    const flipsHere = flips.get(d.id)?.has(l);
    return flipsHere ? `${i >= 0 ? `Doubt ${i + 1}` : "Logged"}, but the other reading changes the winner in this scenario: settle it before you award.`
      : i >= 0 ? `Doubt ${i + 1}. It doesn’t change a winner in this scenario.` : "Logged. It doesn’t change a winner in this scenario.";
  };
  // "Start here" (dismissible): three things a reviewer can do in two minutes. Dismissal is remembered; Reset demo clears it.
  const [startOn, setStartOn] = useState(false);
  useEffect(() => { try { setStartOn(localStorage.getItem(START_KEY) !== "1"); } catch { setStartOn(true); } }, []);
  const [startDone, setStartDone] = useState<Record<number, boolean>>({});
  const [vendorPop, setVendorPop] = useState<string | null>(null);
  const [pulse, setPulse] = useState<string | null>(null);

  const award = cur?.award ?? grid?.asQuoted ?? null;
  const excluded = useMemo(() => new Set(cur?.excluded.map((e) => e.vendorId) ?? []), [cur]);

  // Report toolbar: which lines show, in what order. Filters test the active view's winners and ignore excluded vendors.
  const tests = useMemo(() => {
    if (!grid || !award) return null;
    const live = grid.vendors.filter((v) => !excluded.has(v.id));
    const base = grid.asQuoted;
    return {
      doubts: (l: string) => live.some((v) => doubtAt.has(cellKey(v.id, l))),
      changed: (l: string) => !!cur && award.per[l]?.vendorId !== base.per[l]?.vendorId,
      unverified: (l: string) => !!award.per[l] && !checks[checkKey(award.per[l]!.vendorId, l)],
    } as Record<Exclude<Show, "all">, (l: string) => boolean>;
  }, [grid, award, cur, excluded, doubtAt, checks]);

  const pre = grid && award ? grid.lines.filter((l) => !f.win || award.per[l.id]?.vendorId === f.win) : [];
  const counts = Object.fromEntries(SHOW.map(([k]) => [k, k === "all" ? pre.length : pre.filter((l) => tests?.[k](l.id)).length])) as Record<Show, number>;
  const shown = pre.filter((l) => f.show === "all" || tests?.[f.show](l.id));
  const filtered = f.show !== "all" || !!f.win;

  // "Approved by you": winners in the active view.
  const winners = grid && award ? grid.lines.filter((l) => award.per[l.id]) : [];
  const winChecked = winners.filter((l) => checks[checkKey(award!.per[l.id]!.vendorId, l.id)]).length;
  const nextWinner = (after?: string) => {
    if (!award) return;
    const order = shown.length ? shown : grid!.lines;
    const i = after ? order.findIndex((l) => l.id === after) : -1;
    const rest = [...order.slice(i + 1), ...order.slice(0, i + 1)];
    const l = rest.find((x) => award.per[x.id] && !checks[checkKey(award.per[x.id]!.vendorId, x.id)] && x.id !== after);
    if (l) { setSel({ v: award.per[l.id]!.vendorId, l: l.id }); setPane("src"); setTab("compare"); }
  };
  const me = role === "VP" ? `${data?.event.vp}` : `${data?.event.buyer}`;

  // The chat's "export this": the latest render's snapshot, so it includes a scenario the same answer just applied.
  const exportRef = useRef<(() => void) | null>(null);
  // The table as shown (as quoted, or the active strategy), frozen with every number's source.
  const snapshotNow = (only?: string[]): Snapshot => {
    return freeze({ ev: data!.event, grid: grid!, quality, report: report!, lastYear: data!.lastYear, decisions, checks, only,
      scenario: cur ? { title: `${isScenario ? active.title : "As quoted"}${overrides.length ? `, with ${overrides.length} override${overrides.length > 1 ? "s" : ""}` : ""}`, result: cur } : null,
      overrides });
  };
  exportRef.current = () => { if (data && grid && report) download(snapshotNow(), "xlsx"); };

  // Where each file lives, to link "Open original".
  const paths: Record<string, string> = {};
  for (const r of data?.replies ?? []) for (const f of [...(r.cover ? [r.cover] : []), ...r.files]) paths[`${r.id}|${f.name.toLowerCase()}`] = f.path;
  paths[`history|se-2025-037_award_summary.xlsx`] = "dataset/04_history/SE-2025-037_Award_Summary.xlsx";

  if (!data || !grid || !report || !award) return <div style={{ padding: 40, color: "var(--color-neutral-700)" }}>Loading the event…</div>;
  const ev = data.event;
  const pending = data.replies.filter((r) => !state[r.id] || state[r.id].stage !== "done").length;
  const shownValue = shown.reduce((a, l) => a + (award.per[l.id] ? award.per[l.id]!.perBox * l.qty : 0), 0);
  const askedLabel = (a: Asked) => (a.asker === "vp" ? `Asked by ${ev.vp}, ${ev.vpRole}` : `Asked by ${ev.buyer}, buyer`);
  const sel11 = { ...label11, display: "flex", flexDirection: "column" as const, gap: 4 };
  const selS: React.CSSProperties = { minHeight: 36, height: 36, padding: "4px 8px", fontSize: 15, background: "var(--color-bg)" };
  const stake = report.raised.reduce((a, d) => a + d.stake, 0);
  // Like for like with last year: the lines that had a price last year, at this view's winners.
  const lyLines = grid.lines.filter((l) => award.per[l.id] && data.lastYear.some((x) => x.lineId === l.id));
  const lyThis = lyLines.reduce((a, l) => a + award.per[l.id]!.perBox * l.qty, 0);
  const lyThen = lyLines.reduce((a, l) => a + data.lastYear.find((x) => x.lineId === l.id)!.price * l.qty, 0);
  const lyDelta = lyThis - lyThen;
  const split = grid.vendors.filter((v) => award.byVendor[v.id].lines).map((v) => `${v.short} ${award.byVendor[v.id].lines}`).join(" · ");

  return (
    <div style={{ display: "flex", height: "100vh", minWidth: 1360, fontSize: 16, lineHeight: 1.45, fontVariantNumeric: "tabular-nums", overflow: "hidden" }}>
      <Rail />
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", padding: "20px 24px 28px 12px" }}>
        <PageHead
          meta={<>{ev.id} · award by {AWARD_BY}</>}
          title={ev.title}
          beside={
            <span style={{ display: "flex", gap: 22 }}>
              <button onClick={() => setTab("compare")} style={tabStyle(tab === "compare")}>Compare</button>
              <button onClick={() => setTab("doubts")} style={tabStyle(tab === "doubts")}>Doubts <span style={{ color: "var(--color-accent-2-700)", fontWeight: 600 }}>{report.raised.length}</span></button>
            </span>
          }>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <button className="btn btn-primary" style={{ whiteSpace: "nowrap" }} onClick={() => {
              const s = snapshotNow();
              try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
              router.push(`/events/${ev.id}/award`);
            }}><SealCheck size={16} weight="duotone" />Freeze for award</button>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, whiteSpace: "nowrap" }}>
              <span title="Winning prices you have approved against the original document"><b>{winChecked}/{winners.length}</b> approved</span>
              <button className="btn btn-ghost" style={{ padding: "0 2px", fontSize: 15, color: "var(--color-accent-700)" }} disabled={winChecked === winners.length} onClick={() => nextWinner(sel?.l)}>
                Next to approve →
              </button>
            </span>
          </span>
        </PageHead>

        {startOn && readings.length > 0 && (
          <StartStrip
            intro={`${numberWord(new Set(readings.filter((r) => r.status === "read" && r.vendorId).map((r) => r.vendorId)).size)} vendor replies in ${numberWord(new Set(grid.vendors.filter((v) => readings.some((r) => r.vendorId === v.id && r.status === "read")).map((v) => v.format)).size).toLowerCase()} formats, read into one comparison you can check.`}
            doubts={report.raised.length} done={startDone}
            onPrice={() => {
              // The first cell with a doubt in this view, else the first line's winner.
              const order = shown.length ? shown : grid.lines;
              const hit = order.flatMap((l) => grid.vendors.map((v) => cellKey(v.id, l.id))).find((k) => doubtAt.has(k));
              const first = order.find((l) => award.per[l.id]);
              const k = hit ?? (first ? cellKey(award.per[first.id]!.vendorId, first.id) : null);
              if (!k) return;
              const [v, l] = k.split("|");
              setTab("compare"); setView("table"); setSel({ v, l }); setPane("src"); setPulse(k);
              setTimeout(() => document.querySelector(`[data-cell="${k}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
              setTimeout(() => setPulse(null), 1300);
              setStartDone((d) => ({ ...d, 1: true }));
            }}
            onDoubts={() => { setTab("doubts"); setStartDone((d) => ({ ...d, 2: true })); }}
            onAsk={() => { setPane("conv"); setStartDone((d) => ({ ...d, 3: true })); if (!busy) ask(VP_QUESTION, "vp"); }}
            onDismiss={() => { setStartOn(false); try { localStorage.setItem(START_KEY, "1"); } catch { /* this visit only */ } }} />
        )}

        <Kpis items={[
          { label: `Award total · ${isScenario ? active.title : overrides.length ? "as quoted, with your overrides" : "as quoted, all vendors"}`, value: award.total >= 1e7 ? crore(award.total) : lakh(award.total), title: split ? `${split} lines` : undefined,
            sub: !readings.length ? "No prices read yet" : !cur ? (split ? `${split} lines` : "")
              : Math.abs(award.total - grid.asQuoted.total) < 1 ? "Same as as quoted, all vendors"
              : `${lakh(Math.abs(award.total - grid.asQuoted.total))} ${award.total > grid.asQuoted.total ? "more" : "less"} than as quoted, all vendors` },
          { label: `vs last year, same ${lyLines.length} boxes`, value: lyLines.length ? <span style={{ color: "var(--color-accent-800)" }}>{lyDelta >= 0 ? "+" : "−"}{lakh(Math.abs(lyDelta))}</span> : "—",
            sub: lyLines.length ? `${lyDelta >= 0 ? "+" : "−"}${Math.abs((lyDelta / lyThen) * 100).toFixed(1)}% on ${lakh(lyThen)} last year` : "No line has a price from last year",
            title: "Like for like: the lines with a price from last year (SE-2025-037), at this view's winners" },
          { label: "Doubts that could change a winner", value: `${report.raised.length} · ${lakh(stake)}`, doubt: true, onClick: () => setTab("doubts"), title: "Open the Doubts tab",
            sub: `at stake · ${loggedLabel(report)}` },
        ]} />

        {(pending > 0 || !readings.length) && (
          <span style={{ color: "var(--color-neutral-800)" }}>
            {pending > 0 && `Reading ${pending} more repl${pending === 1 ? "y" : "ies"}… `}
            {!readings.length && <>{empty ? "No replies yet. " : "Nothing read yet. "}<Link href={`/events/${ev.id}/replies`}>Upload a reply on Replies</Link> and it joins this table when it is read.</>}
          </span>
        )}

        {tab === "doubts" ? (
          <div className="sheet" style={{ padding: "8px 20px" }}>
            <DoubtsView grid={grid} report={report} overrides={overrides} onSee={(v, l) => { setSel({ v, l }); setTab("compare"); }}
              decisions={decisions} onRecord={recordDecision} onUndo={undoDecision} me={me} flips={flips} view={isScenario ? `“${active.title}”` : "the view on screen"} />
          </div>
        ) : (
        <div className="sheet" style={{ display: "flex", flexDirection: "column", gap: 10, padding: "14px 20px 4px" }}>
          {/* One toolbar row; the filters fold away. */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen}
              style={{ flex: "none", display: "flex", alignItems: "center", gap: 6, background: "none", border: 0, padding: 0, font: "inherit", fontSize: 16, fontWeight: 600, cursor: "pointer", color: filtersOpen ? "var(--color-text)" : "var(--color-accent-800)" }}>
              {filtersOpen ? <CaretDown weight="duotone" /> : <CaretRight weight="duotone" />}Filters
            </button>
            {/* "How to read a price" folds away the same way as Filters. */}
            <button onClick={() => setGuideOpen(!guideOpen)} aria-expanded={guideOpen}
              style={{ flex: "none", display: "flex", alignItems: "center", gap: 6, background: "none", border: 0, padding: 0, marginLeft: 12, font: "inherit", fontSize: 16, fontWeight: 600, cursor: "pointer", color: guideOpen ? "var(--color-text)" : "var(--color-accent-800)" }}>
              {guideOpen ? <CaretDown weight="duotone" /> : <CaretRight weight="duotone" />}How to read a price
            </button>
            {filtered && <button className="btn btn-ghost" onClick={() => setF(NO_FILTER)} style={{ padding: "2px 8px", flex: "none", whiteSpace: "nowrap" }}>Clear filters</button>}
            <div style={{ marginLeft: "auto", flex: "none", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: "var(--color-neutral-700)", whiteSpace: "nowrap", fontSize: 15 }}>Showing {shown.length} of {grid.lines.length} lines · {shownValue >= 1e7 ? crore(shownValue) : lakh(shownValue)}</span>
              <div style={{ flex: "none", display: "inline-flex", boxShadow: "inset 0 0 0 1px var(--color-neutral-400)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                <button onClick={() => setView("table")} style={segS(view === "table")}>Table</button>
                <button onClick={() => setView("chart")} style={segS(view === "chart")}>Chart</button>
              </div>
              <button className="btn btn-ghost" style={{ whiteSpace: "nowrap" }} title="Download the lines shown, as shown (Excel)" onClick={() => download(snapshotNow(shown.map((l) => l.id)), "xlsx")}><Export size={16} weight="duotone" />Export</button>
            </div>
          </div>
          {filtersOpen && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap", paddingBottom: 4 }}>
              <label style={sel11}>Scenario
                <select className="input" style={{ ...selS, width: 300 }} value={scen} title={active.desc} onChange={(e) => { setScen(e.target.value); setView("table"); }}>
                  {LIBRARY.map((x) => <option key={x.key} value={x.key} title={x.desc}>{x.title}{asked.some((a) => a.libKey === x.key) ? " · asked in chat" : ""}</option>)}
                  {asked.map((a, i) => (a.libKey ? null : <option key={`a${i}`} value={`asked:${i}`}>{a.title} · asked in chat</option>))}
                </select>
              </label>
              <label style={sel11}>Won by
                <select className="input" style={{ ...selS, width: 160 }} value={f.win} onChange={(e) => setF({ ...f, win: e.target.value })}>
                  <option value="">Any vendor</option>
                  {grid.vendors.map((v) => <option key={v.id} value={v.id}>{v.short}</option>)}
                </select>
              </label>
              <div style={sel11}>Show
                <div style={{ display: "flex", alignItems: "center", gap: 6, height: 36 }}>
                  {SHOW.filter(([k]) => k !== "changed" || isScenario || overrides.length > 0).map(([k, t]) => (
                    <button key={k} className={f.show === k ? "chip chip-on" : "chip"} onClick={() => setF({ ...f, show: k })}>
                      {t} <span style={{ opacity: 0.75 }}>{counts[k]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {guideOpen && <CellGuide />}

          {cur && (isScenario || overrides.length > 0) && (
            <ScenarioStrip r={cur} title={isScenario ? active.title : "As quoted, with your overrides"} grid={grid}
              askedBy={isScenario ? (active.asker ? askedLabel({ asker: active.asker } as Asked) : null) : `Overrides by ${ev.buyer}, buyer`}
              onBack={() => (isScenario ? setScen("base") : setOverrides([]))} backLabel={isScenario ? "Back to as quoted" : "Clear overrides"} />
          )}

          {view === "chart" ? (
            <ChartView grid={grid} r={cur} />
          ) : (
            <GridTable grid={grid} lines={shown} filtered={filtered} sel={sel} quality={quality} doubtAt={doubtAt} award={award} base={cur ? grid.asQuoted : null}
              excluded={excluded} checks={checks} onSelect={(v, l) => { setSel({ v, l }); setPane("src"); }}
              vendorNote={vendorNote} readNote={readNote} pulse={pulse} onVendor={setVendorPop} showWas={f.show === "changed"} />
          )}
        </div>
        )}
      </main>
      {vendorPop && <VendorPopover ev={ev} vendorId={vendorPop} grid={grid} quality={quality} readings={readings} paths={paths} onClose={() => setVendorPop(null)} />}

      <aside style={{ width: 440, flex: "none", background: "var(--color-surface)", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ display: "flex", gap: 22, padding: "22px 22px 0" }}>
          <button onClick={() => setPane("conv")} style={paneS(pane === "conv")}><ChatsCircle size={18} weight="duotone" />Conversation</button>
          <button onClick={() => setPane("src")} style={paneS(pane === "src")}>
            <FileMagnifyingGlass size={18} weight="duotone" />
            {sel ? `Source · ${sel.l} ${grid.vendors.find((v) => v.id === sel.v)?.short}` : "Source"}
          </button>
        </div>
        {pane === "conv" ? (
          <Conversation msgs={msgs} results={results} titles={asked.map((a) => a.title)} metas={asked.map((a) => a.meta)} store={store!}
            onBaseline={(i, b) => setAsked((xs) => xs.map((x, k) => (k === i ? { ...x, meta: { ...x.meta, baseline: b } } : x)))}
            onFindCheaper={(i) => setAsked((xs) => xs.map((x, k) => (k === i ? { ...x, rules: { ...x.rules, solveMs: 20000 } } : x)))} people={{ buyer: ev.buyer, vp: ev.vp }} asker={asker}
            busy={busy} q={q} setQ={setQ} onAsk={ask} onShow={(i, v) => { setScen(asked[i]?.libKey ?? `asked:${i}`); setView(v); setTab("compare"); }}
            vendorNames={Object.fromEntries(grid.vendors.map((v) => [v.id, v.short]))} quality={quality} doubts={report.raised} openFor={openFor}
            opening={!readings.length ? `No replies are read yet, so there is nothing to compare. Upload a reply on the Replies screen; as soon as it is read it joins this table, and you can ask me about it.` : `Quotes from ${new Set(readings.filter((r) => r.status === "read" && r.vendorId).map((r) => r.vendorId)).size} of ${ev.vendors.length} vendors are read and on one basis. ${report.raised.length} doubts could change a winner (${lakh(stake)} at stake); see the Doubts tab. Ask me anything about this table; every answer is solved in code and added to the Scenario list, so you can keep, compare and switch between them.`} />
        ) : (
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "16px 22px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {sel ? (
            <SourcePanel grid={grid} sel={sel} readings={readings} paths={paths} doubt={doubtAt.get(cellKey(sel.v, sel.l))} report={report} twoReadings={twoReadingsNote(sel.v, sel.l)}
              shown={award} override={overrides.find((o) => o.lineId === sel.l)} buyer={ev.buyer}
              check={checks[checkKey(sel.v, sel.l)] ?? null} me={me}
              onCheck={(c, next) => { setCheck(checkKey(sel.v, sel.l), c); if (next) nextWinner(sel.l); }}
              onOverride={(o) => setOverrides([...overrides.filter((x) => x.lineId !== o.lineId), ...(o.to ? [o] : [])])} onSelect={(v) => setSel({ v, l: sel.l })} onClose={() => setSel(null)} />
          ) : (
            <p style={{ margin: 0, color: "var(--color-neutral-700)", maxWidth: 340 }}>
              Click any price in the table to see where it was read, what the vendor wrote, and the arithmetic that put it on our basis.
            </p>
          )}
        </div>
        )}
      </aside>
    </div>
  );
}

/** "How to read a price" (collapsible): every cell state, shown on the same number. */
function CellGuide() {
  const item = (sample: React.ReactNode, name: string, meaning: string) => (
    <span style={{ display: "flex", gap: 8, alignItems: "center", whiteSpace: "nowrap" }}>
      <span style={{ minWidth: 58, textAlign: "right" }}>{sample}</span>
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{name}</span>
        <span style={{ color: "var(--color-neutral-700)", fontSize: 14 }}>{meaning}</span>
      </span>
    </span>
  );
  const fill = (bg: string, color: string): React.CSSProperties => ({ background: bg, color, fontWeight: 700, padding: "2px 6px", borderRadius: "var(--radius-sm)" });
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 22px", padding: "10px 12px", background: "var(--color-bg)", borderRadius: "var(--radius-lg)", fontSize: 15 }}>
      {item(<span style={fill("var(--color-accent-200)", "var(--color-text)")}>24.60</span>, "Winner", "lowest that can win")}
      {item(<span style={fill("var(--color-accent-2-100)", "var(--color-accent-2-800)")}>24.60?</span>, "Winner with a doubt", "the doubt could change it")}
      {item(<span style={{ color: "var(--color-accent-2-800)", fontWeight: 600 }}>24.60?</span>, "Doubt", "could take the line")}
      {item(<span style={{ textDecoration: "underline dotted var(--color-neutral-600)", textUnderlineOffset: 3 }}>24.60</span>, "Converted", "dotted = a sum, click it")}
      {item(<span style={{ fontStyle: "italic", color: "var(--color-neutral-800)" }}>24.60<sup style={{ fontSize: 9, fontStyle: "normal", marginLeft: 1 }}>LY</sup></span>, "Last year’s", "from SE-2025-037")}
      {item(<span>24.60<sup style={{ fontSize: 12, fontWeight: 600, marginLeft: 1 }}>↑</sup></span>, "Unusual", "12%+ off should-cost")}
      {item(<span style={{ color: "var(--color-neutral-700)" }}>—</span>, "Not quoted", "line skipped")}
      {item(<span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><SealCheck size={14} weight="duotone" color="var(--color-accent-700)" />24.60</span>, "Approved by you", "checked against the file")}
    </div>
  );
}

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const numberWord = (n: number) => WORDS[n] ?? String(n);

function StartStrip({ intro, doubts, done, onPrice, onDoubts, onAsk, onDismiss }: {
  intro: string; doubts: number; done: Record<number, boolean>; onPrice: () => void; onDoubts: () => void; onAsk: () => void; onDismiss: () => void;
}) {
  const items: [number, string, () => void][] = [
    [1, "Click any price to see where it came from", onPrice],
    [2, `Open Doubts: only the ${doubts} that could change a winner`, onDoubts],
    [3, "Ask the VP’s question in the chat", onAsk],
  ];
  return (
    <div style={{ flex: "none", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px 20px", minHeight: 44, padding: "10px 16px", background: "var(--color-accent-100)", borderRadius: "var(--radius-lg)", fontSize: 15 }}>
      <span><b>Start here</b> {intro}</span>
      {items.map(([n, label, act]) => (
        <button key={n} onClick={act} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: 0, padding: 0, font: "inherit", fontSize: 15, color: "var(--color-accent-700)", cursor: "pointer", textAlign: "left" }}>
          <span aria-hidden style={{ flex: "none", width: 20, height: 20, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700,
            background: done[n] ? "var(--color-accent-700)" : "var(--color-accent)", color: "var(--color-bg)" }}>{done[n] ? "✓" : n}</span>
          {label}
        </button>
      ))}
      <button className="btn btn-ghost btn-icon" aria-label="Dismiss" title="Dismiss" onClick={onDismiss} style={{ marginLeft: "auto" }}><X size={16} weight="duotone" /></button>
    </div>
  );
}

/** A small focusable mark with a tooltip (max 280 px), shown on hover or keyboard focus. */
function Tip({ text, label, children }: { text: string; label: string; children: React.ReactNode }) {
  const [on, setOn] = useState(false);
  return (
    <span tabIndex={0} role="note" aria-label={`${label}. ${text}`} onMouseEnter={() => setOn(true)} onMouseLeave={() => setOn(false)} onFocus={() => setOn(true)} onBlur={() => setOn(false)}
      style={{ position: "relative", fontSize: 14, fontWeight: 700, color: "var(--color-accent-2-800)", cursor: "help", padding: "0 2px" }}>
      {children}
      {on && (
        <span role="tooltip" style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, zIndex: 20, width: "max-content", maxWidth: 280, textAlign: "left", fontSize: 14, fontWeight: 400, lineHeight: 1.4,
          color: "var(--color-text)", background: "var(--color-bg)", boxShadow: "var(--shadow-md)", borderRadius: "var(--radius-lg)", padding: "8px 10px" }}>{text}</span>
      )}
    </span>
  );
}

/** Click a vendor's column header: how its quality score was worked out, every answer traceable to its source. */
function VendorPopover({ ev, vendorId, grid, quality, readings, paths, onClose }: {
  ev: SourcingEvent; vendorId: string; grid: Grid; quality: Quality[]; readings: ReplyReading[]; paths: Record<string, string>; onClose: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const v = grid.vendors.find((x) => x.id === vendorId)!;
  const q = quality.find((x) => x.vendorId === vendorId);
  const mine = readings.filter((r) => r.vendorId === vendorId);
  const answerOf = (id: string) => {
    for (const r of mine) { const a = r.questionnaire.find((x) => x.question_id === id); if (a) return { a, replyId: r.replyId }; }
    return null;
  };
  const mand = q?.items.filter((x) => x.mandatory) ?? [];
  const shown = src ? answerOf(src) : null;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "color-mix(in srgb, var(--color-text) 18%, transparent)" }} />
      <div role="dialog" aria-label={`${v.name}: quality score`} style={{ position: "fixed", zIndex: 51, top: 64, left: "50%", transform: "translateX(-50%)", width: 820, maxWidth: "calc(100vw - 40px)", maxHeight: "calc(100vh - 100px)", overflow: "auto",
        background: "var(--color-neutral-100)", boxShadow: "var(--shadow-lg)", borderRadius: "var(--radius-lg)", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12, fontSize: 15 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", marginRight: "auto" }}>
            <span style={{ fontSize: 21, fontWeight: 600 }}>{v.name}</span>
            <span style={{ color: "var(--color-neutral-700)" }}>{v.format}{v.note ? ` · ${v.note}` : ""}</span>
          </div>
          <QualityLabel returned={!!q?.returned} score={q?.score} cleared={!!q?.cleared} style={{ fontSize: 17, fontWeight: 600 }} />
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close"><X size={18} weight="duotone" /></button>
        </div>
        <span style={{ fontSize: 17, fontWeight: 600 }}>How this score was worked out</span>
        {!q?.returned ? <span style={{ color: "var(--color-neutral-800)" }}>{v.short} did not return the questionnaire, so it is not scored and does not clear quality.</span> : (
          <>
            <table className="table" style={{ fontSize: 15 }}>
              <thead><tr><th>#</th><th>Question</th><th>Type</th><th>Answer (as given)</th><th style={{ textAlign: "right" }}>Points</th></tr></thead>
              <tbody>
                {ev.questions.map((x) => {
                  const it = q.items.find((i) => i.id === x.id);
                  const a = answerOf(x.id);
                  return (
                    <tr key={x.id} style={{ background: src === x.id ? "var(--color-accent-100)" : undefined }}>
                      <td>{x.id}</td><td>{x.text}</td><td>{x.type}</td>
                      <td>{a ? <button onClick={() => setSrc(src === x.id ? null : x.id)} title="See where this answer was read" style={{ background: "none", border: 0, padding: 0, font: "inherit", textAlign: "left", color: "var(--color-accent-700)", cursor: "pointer" }}>“{a.a.answer}”</button> : <span style={{ color: "var(--color-neutral-700)" }}>no answer</span>}
                        {it && <div style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>{it.why}</div>}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap", fontWeight: 600, color: it?.mandatory && !it.pts ? "var(--color-accent-2-800)" : undefined }}>
                        {!it ? "—" : it.mandatory ? `${it.pts ? "Pass" : "Fail"} · ${it.pts}/${it.of}` : `${it.pts}/${it.of}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <span style={{ fontWeight: 600 }}>
              Total {q.score}/100 · pass mark {q.passMark} · mandatory {mand.length - q.mandatoryFailed}/{mand.length} passed → {q.cleared ? "Cleared" : "Not cleared"}
            </span>
            <span style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>Marked in code against the marking scheme on the RFQ’s Evaluation rules tab. Click an answer to see it in the vendor’s document.</span>
            {shown && <SourceDoc replyId={shown.replyId} source={shown.a.source} raw={null} lineId={src!} filePath={paths[`${shown.replyId}|${shown.a.source.file.toLowerCase()}`] ?? null} />}
          </>
        )}
      </div>
    </>
  );
}

function GridTable({ grid, lines, filtered, sel, quality, doubtAt, award, base, excluded, checks, onSelect, vendorNote, readNote, pulse, onVendor, showWas }: {
  grid: Grid; lines: Grid["lines"]; filtered: boolean; sel: { v: string; l: string } | null; quality: Quality[]; doubtAt: Map<string, { d: Doubt; rank: number }>;
  award: Award; base: Award | null; excluded: Set<string>; checks: Checks; onSelect: (v: string, l: string) => void;
  /** A "‡" note per vendor (a condition on its prices), and a status per cell with two readings. */
  vendorNote: Record<string, string>; readNote: Map<string, string>; pulse: string | null; onVendor: (v: string) => void;
  /** Show "was <vendor>" beside lines whose winner changed (the "Winner changed" filter). */
  showWas: boolean;
}) {
  const muted = { fontSize: 13, color: "var(--color-neutral-700)" };
  // The footer totals the lines shown.
  const foot = { byVendor: Object.fromEntries(grid.vendors.map((v) => [v.id, { lines: 0, value: 0 }])) as Award["byVendor"], total: 0 };
  for (const l of lines) {
    const w = award.per[l.id];
    if (!w) continue;
    foot.byVendor[w.vendorId].lines++; foot.byVendor[w.vendorId].value += w.perBox * l.qty; foot.total += w.perBox * l.qty;
  }
  const short = (id: string | undefined) => grid.vendors.find((v) => v.id === id)?.short ?? "none";
  return (
    <div>
      <div style={{ position: "sticky", top: 0, zIndex: 2, background: "var(--color-neutral-100)", display: "grid", gridTemplateColumns: COLS, alignItems: "end", padding: "8px 0", boxShadow: "inset 0 -2px 0 var(--color-text)" }}>
        <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-neutral-800)" }}>Line · ₹ per box</span>
          <span style={muted}>delivered Chakan, GST extra</span>
        </span>
        {grid.vendors.map((v) => {
          const q = quality.find((x) => x.vendorId === v.id);
          return (
            <div key={v.id} style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", textAlign: "right", gap: 1, paddingRight: 10 }}>
              <button onClick={() => onVendor(v.id)} title={`${v.name} · ${v.format}${v.note ? ` · ${v.note}` : ""}. Click for how the quality score was worked out.`}
                style={{ background: "none", border: 0, padding: 0, font: "inherit", textAlign: "right", cursor: "pointer", color: "inherit", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                <span style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.2, textDecoration: "underline dotted var(--color-neutral-500)", textUnderlineOffset: 3 }}>{v.short}</span>
              </button>
              <span style={{ ...muted, display: "flex", alignItems: "baseline", justifyContent: "flex-end", flexWrap: "wrap", gap: "0 3px", lineHeight: 1.3 }}>
                <QualityLabel returned={!!q?.returned} score={q?.score} cleared={!!q?.cleared} style={{ whiteSpace: "normal" }} />
                {vendorNote[v.id] && <Tip text={vendorNote[v.id]} label={`${v.short}: a condition on these prices`}>‡</Tip>}
              </span>
            </div>
          );
        })}
      </div>

      {!lines.length && <div style={{ padding: "28px 0", color: "var(--color-neutral-700)" }}>No lines match these filters.</div>}
      {lines.map((l) => {
        const w = award.per[l.id];
        const was = showWas && base && base.per[l.id]?.vendorId !== w?.vendorId ? short(base.per[l.id]?.vendorId) : null;
        return (
          <div key={l.id} className="hover-row" style={{ display: "grid", gridTemplateColumns: COLS, alignItems: "stretch", minHeight: 36, boxShadow: "inset 0 -1px 0 var(--color-neutral-200)", background: sel?.l === l.id ? "var(--color-bg)" : undefined }}>
            <span title={`${l.id} · ${l.name} · ${l.spec} · ${l.qty.toLocaleString("en-IN")} boxes · should-cost ₹${num2(l.shouldCost)}`} style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0, paddingRight: 8, alignSelf: "center" }}>
              <span style={{ fontSize: 13, color: "var(--color-neutral-700)", flex: "none", width: 30 }}>{l.id}</span>
              <span style={{ fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</span>
              {was && <span style={{ fontSize: 13, color: "var(--color-accent-800)", flex: "none", marginLeft: "auto" }}>was {was}</span>}
            </span>
            {grid.vendors.map((v) => (
              <Cell key={v.id} c={grid.cells[cellKey(v.id, l.id)]} checked={!!checks[checkKey(v.id, l.id)]} doubt={doubtAt.has(cellKey(v.id, l.id)) && !excluded.has(v.id)} win={w?.vendorId === v.id} selected={sel?.v === v.id && sel.l === l.id} pulse={pulse === cellKey(v.id, l.id)} onClick={() => onSelect(v.id, l.id)}
                tip={readNote.get(cellKey(v.id, l.id)) ?? `${v.short} · ${l.id}: ${grid.cells[cellKey(v.id, l.id)].norm.asWritten}`} />
            ))}
          </div>
        );
      })}

      <div style={{ display: "grid", gridTemplateColumns: COLS, padding: "10px 0 14px", boxShadow: "inset 0 2px 0 var(--color-text)", alignItems: "baseline" }}>
        <span style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontWeight: 600 }}>{filtered ? "Shown lines · value" : "Lines won · award value"}</span>
          <span style={{ fontSize: 15 }}>{foot.total >= 1e7 ? crore(foot.total) : lakh(foot.total)}</span>
        </span>
        {grid.vendors.map((v) => {
          const b = foot.byVendor[v.id];
          return (
            <span key={v.id} style={{ textAlign: "right", paddingRight: 10, display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: 600 }}>{b.lines || "—"}</span>
              <span style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>{b.lines ? lakh(b.value) : ""}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Cell({ c, checked, doubt, win, selected, pulse, onClick, tip }: { c: GridCell; checked: boolean; doubt: boolean; win: boolean; selected: boolean; pulse?: boolean; onClick: () => void; tip: string }) {
  const k = c.kind;
  // v2: the winner sits on a pale cyan fill; a doubt is magenta (filled only when it is the winner). Losing prices keep full ink.
  const ns: React.CSSProperties = {
    color: doubt ? "var(--color-accent-2-800)" : k === "not_quoted" || k === "unclear" ? "var(--color-neutral-700)" : k === "last_year" ? "var(--color-neutral-800)" : "var(--color-text)",
    fontStyle: k === "last_year" ? "italic" : "normal",
    fontWeight: win ? 700 : doubt ? 600 : 400,
    textDecoration: k === "converted" ? "underline dotted var(--color-neutral-600)" : "none",
    textUnderlineOffset: 3,
    ...(win ? { background: doubt ? "var(--color-accent-2-100)" : "var(--color-accent-200)", padding: "2px 6px", borderRadius: "var(--radius-sm)" } : { padding: "2px 0" }),
  };
  const mark = doubt ? "?" : k === "last_year" ? "LY" : c.band === "high" ? "↑" : c.band === "low" ? "↓" : "";
  return (
    <button
      onClick={onClick}
      title={checked ? `${tip} · approved by you` : tip}
      className={pulse ? "cell-pulse" : undefined}
      data-cell={`${c.vendorId}|${c.lineId}`}
      style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%", minHeight: 36, padding: "0 10px", border: 0, font: "inherit", fontSize: 15, background: "transparent", outline: selected ? "2px solid var(--color-accent)" : "none", outlineOffset: -2, color: "inherit", cursor: "pointer" }}
    >
      {checked && c.perBox != null && <SealCheck size={14} weight="duotone" color="var(--color-accent-700)" style={{ marginRight: 4, flex: "none" }} aria-label="Approved by you" />}
      <span style={ns}>
        {c.perBox == null ? (k === "unclear" ? "n/a" : "—") : num2(c.perBox)}
        {mark && <sup style={{ fontSize: k === "last_year" ? 9 : 11, fontStyle: "normal", fontWeight: 600, marginLeft: 1, letterSpacing: "0.04em", display: "inline-block" }}>{mark}</sup>}
      </span>
    </button>
  );
}

function SourcePanel({ grid, sel, readings, paths, doubt, report, shown, override, buyer, check, me, onCheck, onOverride, onSelect, onClose, twoReadings }: {
  /** For a cell read two ways: whether the other reading changes a winner in the view on screen. */
  twoReadings?: string | null;
  grid: Grid; sel: { v: string; l: string }; readings: ReplyReading[]; paths: Record<string, string>;
  doubt: { d: Doubt; rank: number } | undefined; report: DoubtReport; onSelect: (v: string) => void; onClose: () => void;
  shown: Award; override: Override | undefined; buyer: string; onOverride: (o: Override) => void;
  check: Check | null; me: string; onCheck: (c: Check | null, next: boolean) => void;
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
          {n.alternatives.map((a, i) => {
            const logged = report.logged.find((d) => d.kind === "hard_to_read" && d.vendorId === sel.v && d.lineIds.includes(sel.l));
            return (
              <span key={i} style={{ display: "block", marginTop: 4 }}>
                <b>Two readings: {n.raw?.text} or {a.value.toFixed(2)}.</b> {a.reason} At {a.value.toFixed(2)} this is {inr(a.perBox)} a box.
                {logged ? " Code re-solved the table at the other reading: no winner changes, so it is logged, not raised." : doubt ? " It could change a winner: see the Doubts tab." : ""}
              </span>
            );
          })}
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
          <span style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>{line.spec} · {Math.round(line.qty / 1000)}k boxes</span>
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
      {c.perBox != null && (check || shown.per[line.id]?.vendorId === sel.v) && (check ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--color-accent-100)", padding: "8px 10px" }}>
          <SealCheck size={22} weight="duotone" color="var(--color-accent-700)" />
          <span style={{ display: "flex", flexDirection: "column", marginRight: "auto", lineHeight: 1.3 }}>
            <span style={{ fontWeight: 600 }}>Approved by you</span>
            <span style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>{check.who} · {stamp(check.at)} · recorded on the award</span>
          </span>
          <button className="btn btn-ghost" onClick={() => onCheck(null, false)}>Undo</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={() => onCheck({ at: new Date().toISOString(), who: me }, false)}><SealCheck size={16} weight="duotone" />Approve this price</button>
            <button className="btn btn-secondary" onClick={() => onCheck({ at: new Date().toISOString(), who: me }, true)}>Approve &amp; open next winner</button>
          </div>
          <span style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>
            {doubt ? `Confirms the price matches the document. Doubt ${doubt.rank} stays open until you decide it on the Doubts tab.` : "Confirms the price matches the document. Recorded with your name and the time, and listed on the award when you freeze it."}
          </span>
        </div>
      ))}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={label11}>As written</span>
          {n.alternatives.length > 0 ? (
            // Two readings side by side: the one in use in bold, the other struck through.
            <span style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "baseline" }}>
              <span style={{ display: "flex", flexDirection: "column" }}>
                <b style={{ fontSize: 20, lineHeight: 1.2 }}>{n.raw?.text ?? n.asWritten}</b>
                <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>as read · {n.legibility === "corrected_by_hand" ? "hand-corrected" : "hard to read"} · in use</span>
              </span>
              {n.alternatives.map((a, i) => (
                <span key={i} style={{ display: "flex", flexDirection: "column" }}>
                  <s style={{ fontSize: 20, lineHeight: 1.2, color: "var(--color-neutral-700)" }}>{a.value.toFixed(2)}</s>
                  <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>{/Code's alternative/.test(a.reason) ? "code’s other reading" : "reader’s other reading"}</span>
                </span>
              ))}
            </span>
          ) : <span style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.2 }}>{n.asWritten}</span>}
          {twoReadings && <span style={{ fontSize: 14, color: "var(--color-neutral-800)" }}>{twoReadings}</span>}
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
              <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>{s.who}</span>
            </span>
            <span style={{ textWrap: "pretty" }}>{s.text}</span>
          </div>
        ))}
        <OverrideBox key={line.id} line={line.id} grid={grid} shown={shown} current={override} buyer={buyer} onOverride={onOverride} />
        {c.perBox != null && w && w.vendorId !== sel.v && c.canWin && (
          <CounterOffer key={`co-${sel.v}-${line.id}`} vendorId={sel.v} line={line} cell={c} target={w.perBox} />
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={label11}>Same line, every vendor</span>
        {grid.vendors.map((v) => {
          const pc = grid.cells[cellKey(v.id, line.id)];
          return (
            <button key={v.id} onClick={() => onSelect(v.id)} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px", gap: 8, padding: "5px 6px", background: v.id === sel.v ? "var(--color-accent-100)" : "transparent", border: 0, font: "inherit", color: "inherit", textAlign: "left" }}>
              <span>{v.short}</span>
              <span style={{ color: "var(--color-neutral-700)", fontSize: 14 }}>{STATE_LABEL[pc.kind]}{pc.band ? `, ${pc.band === "high" ? "↑" : "↓"} unusual` : ""}</span>
              <span style={{ textAlign: "right", fontWeight: 600 }}>{pc.perBox != null ? inr(pc.perBox) : "—"}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
