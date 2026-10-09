"use client";
// Comparison (design: "Comparison - Ledger"). Every line by every vendor on one basis, built in
// code from the readings. Click a price to see where it came from and how it was converted.
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CaretDown, CaretRight, Camera, EnvelopeOpen, EnvelopeSimple, File, FileDoc, FileMagnifyingGlass, FilePdf, FileXls,
  NotePencil, SealCheck, Table, Tray, X,
} from "@phosphor-icons/react";
import { SourceDoc } from "@/components/SourceDoc";
import { useReadings } from "@/components/useReadings";
import { buildGrid, cellKey, type Grid, type GridCell } from "@/lib/compare";
import { crore, day, inr, lakh, num2, where } from "@/lib/format";
import type { ReplyReading } from "@/lib/reader/pipeline";
import { mainFile } from "@/lib/summary";
import { USD_REFERENCE } from "@/lib/config";

const EVENT = "SE-2026-041";
const FORMAT_ICON: Record<string, typeof File> = { Excel: FileXls, PDF: FilePdf, Word: FileDoc, Photo: Camera, Email: EnvelopeSimple };
const COLS = "40px minmax(170px,1fr) 44px 64px repeat(5, minmax(76px,96px)) 104px";
const label11 = { fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--color-neutral-700)" };

const STATE_LABEL: Record<GridCell["kind"], string> = {
  checked: "checked", converted: "converted", last_year: "last year’s rate", not_quoted: "not quoted", unclear: "not on the basis",
};

export default function ComparePage() {
  const { data, state } = useReadings();
  const [sel, setSel] = useState<{ v: string; l: string } | null>(null);
  const [legend, setLegend] = useState(true);

  const readings = useMemo(
    () => (data ? data.replies.map((r) => state[r.id]?.reading).filter((r): r is ReplyReading => Boolean(r && r.status !== "error")) : []),
    [data, state],
  );
  const grid = useMemo(() => {
    if (!data) return null;
    const files = Object.fromEntries(data.replies.map((r) => [r.id, mainFile(r, state[r.id]?.reading ?? null) ?? undefined]));
    return buildGrid(data.event, readings, { sheets: data.historySheets }, files);
  }, [data, readings, state]);

  // Where each file lives, to link "Open original".
  const paths: Record<string, string> = {};
  for (const r of data?.replies ?? []) for (const f of [...(r.cover ? [r.cover] : []), ...r.files]) paths[`${r.id}|${f.name.toLowerCase()}`] = f.path;
  paths[`history|se-2025-037_award_summary.xlsx`] = "dataset/04_history/SE-2025-037_Award_Summary.xlsx";

  if (!data || !grid) return <div style={{ padding: 40, color: "var(--color-neutral-700)" }}>Loading the event…</div>;
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
        </header>

        <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "0 28px 0 8px" }}>
          <span style={{ padding: "6px 0", fontSize: 15, fontWeight: 600, boxShadow: "inset 0 -2px 0 var(--color-text)" }}>Comparison</span>
          {pending > 0 && <span style={{ color: "var(--color-neutral-700)" }}>Reading {pending} more repl{pending === 1 ? "y" : "ies"}…</span>}
        </div>

        <Legend open={legend} toggle={() => setLegend(!legend)} />

        <div style={{ display: "flex", alignItems: "center", gap: "10px 14px", padding: "2px 28px 8px 8px" }}>
          <span style={{ ...label11, flex: "none" }}>Table shows</span>
          <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 8, overflowX: "auto", padding: 2 }}>
            <span style={{ flex: "none", whiteSpace: "nowrap", background: "var(--color-accent)", color: "var(--color-bg)", padding: "5px 10px", fontSize: 13, borderRadius: "var(--radius-md)" }}>As quoted</span>
          </div>
        </div>

        <div style={{ flex: "1 0 460px", minHeight: 460, display: "flex" }}>
          <div style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "0 20px 0 8px" }}>
            <GridTable grid={grid} sel={sel} onSelect={(v, l) => setSel({ v, l })} />
          </div>
        </div>
      </main>

      <aside style={{ width: 440, flex: "none", background: "var(--color-surface)", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ display: "flex", gap: 22, padding: "22px 22px 0" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", fontSize: 14, fontWeight: 600, boxShadow: "inset 0 -2px 0 var(--color-text)" }}>
            <FileMagnifyingGlass size={16} weight="duotone" />
            {sel ? `Source · ${sel.l} ${grid.vendors.find((v) => v.id === sel.v)?.short}` : "Source"}
          </span>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "16px 22px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {sel ? (
            <SourcePanel grid={grid} sel={sel} readings={readings} paths={paths} onSelect={(v) => setSel({ v, l: sel.l })} onClose={() => setSel(null)} />
          ) : (
            <p style={{ margin: 0, color: "var(--color-neutral-700)", maxWidth: 320 }}>
              Click any price in the table to see where it was read, what the vendor wrote, and the arithmetic that put it on our basis.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function Rail() {
  const items = [
    { icon: Tray, label: "Events", href: null },
    { icon: NotePencil, label: "RFQ", href: null },
    { icon: EnvelopeOpen, label: "Replies", href: `/events/${EVENT}/replies` },
    { icon: Table, label: "Compare", href: `/events/${EVENT}/compare`, on: true },
    { icon: SealCheck, label: "Award", href: null },
  ];
  return (
    <nav style={{ width: 68, flex: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "18px 0" }}>
      <Link href={`/events/${EVENT}/replies`} style={{ fontSize: 22, fontWeight: 600, color: "var(--color-text)", textDecoration: "none", marginBottom: 18 }}>P</Link>
      {items.map((r) => {
        const s = { display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 2, padding: "8px 0", width: 56, textDecoration: "none",
          color: r.on ? "var(--color-accent)" : r.href ? "var(--color-neutral-700)" : "var(--color-neutral-400)" };
        const body = <><r.icon size={20} weight="duotone" /><span style={{ fontSize: 10 }}>{r.label}</span></>;
        return r.href ? <Link key={r.label} href={r.href} style={s}>{body}</Link> : <span key={r.label} style={s} title="Coming in a later milestone">{body}</span>;
      })}
    </nav>
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
      {item(<span style={{ ...chip, fontWeight: 600 }}>24.60</span>, "Lowest", "bold = cheapest on the line")}
    </div>
  );
}

function GridTable({ grid, sel, onSelect }: { grid: Grid; sel: { v: string; l: string } | null; onSelect: (v: string, l: string) => void }) {
  const award = grid.asQuoted;
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
            <div key={v.id} style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", textAlign: "right", gap: 1, paddingRight: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.15 }}>{v.short}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, ...muted }}><Icon weight="duotone" />{v.format}</span>
              <span style={{ fontSize: 11 }}>{v.questionnaire.returned ? `Questionnaire ${v.questionnaire.answers}/${grid.questions}` : "No questionnaire"}</span>
              <span style={{ fontSize: 10.5, color: "var(--color-neutral-700)", lineHeight: 1.25 }}>{v.note}</span>
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
              <Cell key={v.id} c={grid.cells[cellKey(v.id, l.id)]} win={w?.vendorId === v.id} selected={sel?.v === v.id && sel.l === l.id} onClick={() => onSelect(v.id, l.id)} tip={`${v.short} · ${l.id}: ${grid.cells[cellKey(v.id, l.id)].norm.asWritten}`} />
            ))}
            <span style={{ display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: 12, lineHeight: 1.2 }}>
              <span>{w ? grid.vendors.find((v) => v.id === w.vendorId)?.short : "—"}</span>
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

function Cell({ c, win, selected, onClick, tip }: { c: GridCell; win: boolean; selected: boolean; onClick: () => void; tip: string }) {
  const k = c.kind;
  const ns = {
    color: k === "not_quoted" || k === "unclear" ? "var(--color-neutral-500)" : k === "last_year" ? "var(--color-neutral-800)" : "var(--color-text)",
    fontStyle: k === "last_year" ? ("italic" as const) : ("normal" as const),
    fontWeight: win ? 600 : 400,
    textDecoration: k === "converted" ? "underline dotted var(--color-neutral-600)" : "none",
    textUnderlineOffset: 3,
  };
  const mark = k === "last_year" ? "LY" : c.band === "high" ? "↑" : c.band === "low" ? "↓" : "";
  return (
    <button
      onClick={onClick}
      title={tip}
      style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%", minHeight: 38, padding: "0 10px", border: 0, font: "inherit", fontSize: 13.5, background: "transparent", outline: selected ? "2px solid var(--color-accent)" : "none", outlineOffset: -2, color: "inherit" }}
    >
      <span style={ns}>
        {c.perBox == null ? (k === "unclear" ? "n/a" : "—") : num2(c.perBox)}
        {mark && <sup style={{ fontSize: k === "last_year" ? 8 : 10, fontStyle: "normal", fontWeight: 600, marginLeft: 1, letterSpacing: "0.04em", display: "inline-block" }}>{mark}</sup>}
      </span>
    </button>
  );
}

function SourcePanel({ grid, sel, readings, paths, onSelect, onClose }: {
  grid: Grid; sel: { v: string; l: string }; readings: ReplyReading[]; paths: Record<string, string>; onSelect: (v: string) => void; onClose: () => void;
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
        </>
      ),
    });
  }
  steps.push({
    stage: "Decide", who: "You",
    text: c.perBox == null ? "Nothing to decide on this cell."
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
