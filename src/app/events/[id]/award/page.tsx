"use client";
// Award record (design: Shared Screens #award, L27/L30). Shows the frozen snapshot only: later
// readings or revisions never change it. Every row traces to its source. The VP approves.
import { useEffect, useState } from "react";
import Link from "next/link";
import { FilePdf, FileXls, LockSimple } from "@phosphor-icons/react";
import { Rail } from "@/components/Rail";
import { SourceDoc } from "@/components/SourceDoc";
import { useReadings } from "@/components/useReadings";
import { SNAPSHOT_KEY, type Snapshot } from "@/lib/award";
import { download } from "@/lib/download";
import { crore, inr, lakh } from "@/lib/format";
import { HOME } from "@/lib/routes";
import { useRole } from "@/components/useRole";
import { stamp } from "@/components/useVerified";

const label11 = { fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--color-neutral-700)" };

export default function AwardPage() {
  const { data } = useReadings();
  const [role] = useRole();
  const [s, setS] = useState<Snapshot | null | undefined>(undefined);
  const [tr, setTr] = useState(0);
  useEffect(() => {
    try { setS(JSON.parse(localStorage.getItem(SNAPSHOT_KEY) ?? "null")); } catch { setS(null); }
  }, []);
  const save = (n: Snapshot) => { setS(n); try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(n)); } catch { /* blocked */ } };

  const frame = (body: React.ReactNode, aside?: React.ReactNode) => (
    <div style={{ display: "flex", minHeight: "100vh", minWidth: 1360, fontSize: 13, lineHeight: 1.45, fontVariantNumeric: "tabular-nums" }}>
      <Rail />
      <div style={{ flex: 1, minWidth: 0, padding: "18px 32px 40px 8px", display: "flex", flexDirection: "column", gap: 22 }}>{body}</div>
      {aside}
    </div>
  );
  if (s === undefined) return frame(<span style={{ color: "var(--color-neutral-700)" }}>Loading…</span>);
  if (!s)
    return frame(
      <>
        <span style={label11}>Award record · SE-2026-041</span>
        <h1 style={{ fontSize: 26, margin: 0 }}>Nothing frozen yet</h1>
        <p style={{ margin: 0, maxWidth: 640 }}>Open the comparison, pick the view you want to award (as quoted, or a scenario from the conversation), and press <b>Freeze for award</b>. The numbers are copied here with their sources and do not change afterwards.</p>
        <Link className="btn btn-primary" href={HOME} style={{ alignSelf: "flex-start", color: "var(--color-bg)" }}>Go to the comparison</Link>
      </>,
    );

  const ev = data?.event;
  const d = s.total - s.cheapestOverall;
  const awarded = s.rows.filter((r) => r.perBox != null);
  const checked = awarded.filter((r) => r.checked);
  const checkers = [...new Set(checked.map((r) => r.checked!.who.split(" ")[0]))];
  const lyPct = s.lastYear ? (s.lastYear.thisYear / s.lastYear.lastYear - 1) * 100 : null;
  const kpis = [
    { v: crore(s.total), t: "award value" },
    { v: `${d >= 0 ? "+" : "−"}${lakh(Math.abs(d))}`, t: "vs cheapest overall" },
    ...(lyPct != null ? [{ v: `${lyPct >= 0 ? "+" : "−"}${Math.abs(lyPct).toFixed(1)}%`, t: `vs last year, like for like (${s.lastYear!.lines} lines)` }] : []),
    { v: String(s.byVendor.length), t: s.byVendor.length === 1 ? "vendor" : "vendors" },
    { v: `${checked.length} of ${awarded.length}`, t: `awarded prices checked${checkers.length ? ` by ${checkers.join(" and ")}` : " against the document"}` },
  ];
  const summary = `${s.basis}. ${s.byVendor.map((v) => `${v.vendor} ${v.lines} line${v.lines === 1 ? "" : "s"} (${lakh(v.value)})`).join(", ")}. `
    + (s.excluded.length ? `Left out: ${s.excluded.map((x) => `${x.name} (${x.why})`).join("; ")}. ` : "")
    + `${s.decisions.filter((x) => x.status.startsWith("Open")).length} of ${s.decisions.length} doubts are still open. Parakh recommends; the buyer and the VP decide.`;
  const row = s.rows[tr];
  const paths: Record<string, string> = {};
  for (const r of data?.replies ?? []) for (const f of [...(r.cover ? [r.cover] : []), ...r.files]) paths[`${r.id}|${f.name.toLowerCase()}`] = f.path;

  return frame(
    <>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
        <div style={{ marginRight: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={label11}>Award record · {s.eventId} · for approval by {ev?.vp ?? "the VP"}, {ev?.vpRole ?? ""}</span>
          <h1 style={{ fontSize: 26, margin: 0 }}>{s.title}</h1>
        </div>
        <Link className="btn btn-secondary" href={HOME} style={{ whiteSpace: "nowrap" }}>Ask a what-if</Link>
        <button className="btn btn-secondary" style={{ whiteSpace: "nowrap" }} onClick={() => download(s, "xlsx")}><FileXls size={16} weight="duotone" />Excel</button>
        <button className="btn btn-secondary" style={{ whiteSpace: "nowrap" }} onClick={() => download(s, "pdf")}><FilePdf size={16} weight="duotone" />PDF memo</button>
        {s.approvedBy ? (
          <span className="tag tag-accent" style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>Approved by {s.approvedBy}</span>
        ) : role === "VP" ? (
          <button className="btn btn-primary" style={{ whiteSpace: "nowrap" }} onClick={() => save({ ...s, approvedBy: `${ev?.vp ?? "VP"} (${ev?.vpRole ?? "VP"})`, approvedAt: new Date().toISOString() })}>
            Approve award
          </button>
        ) : s.sentAt ? (
          <span className="tag tag-neutral" style={{ padding: "8px 12px", whiteSpace: "nowrap" }} title="Demo: nothing is sent; switch to the VP in the P menu to approve">Sent to {ev?.vp.split(" ")[0] ?? "the VP"} {stamp(s.sentAt)}</span>
        ) : (
          <button className="btn btn-primary" style={{ whiteSpace: "nowrap" }} onClick={() => save({ ...s, sentAt: new Date().toISOString() })}>
            Send to {ev?.vp.split(" ")[0] ?? "the VP"} for approval
          </button>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 16, maxWidth: 820 }}>{summary}</p>
      <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
        {kpis.map((k) => (
          <div key={k.t} style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.15 }}>{k.v}</span>
            <span style={{ color: "var(--color-neutral-700)" }}>{k.t}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 900 }}>
        <h3 style={{ fontSize: 20, margin: 0 }}>Rules applied</h3>
        {s.rules.map((t, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "26px 1fr", gap: 12 }}><span style={{ color: "var(--color-neutral-700)" }}>R{i + 1}</span><span>{t}</span></div>)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 900 }}>
        <h3 style={{ fontSize: 20, margin: 0 }}>Decisions on record</h3>
        {s.decisions.map((x, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "26px minmax(0,1fr) minmax(0,1fr)", gap: 12, padding: "6px 0" }}>
            <span style={{ color: "var(--color-neutral-700)" }}>{i + 1}</span><span>{x.title}</span>
            <span style={{ color: x.status.startsWith("Open") ? "var(--color-accent-2-700)" : "var(--color-neutral-800)" }}>{x.status}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h3 style={{ fontSize: 20, margin: 0 }}>Snapshot at decision</h3>
          <span style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--color-neutral-700)" }}>
            <LockSimple weight="duotone" />Frozen {new Date(s.frozenAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })} · snapshot {s.id} · later revisions will not change these numbers
          </span>
        </div>
        <table className="table" style={{ fontSize: 13 }}>
          <thead><tr><th>Line</th><th>Box</th><th>Awarded to</th><th style={{ textAlign: "right" }}>₹/box</th><th style={{ textAlign: "right" }}>Qty</th><th style={{ textAlign: "right" }}>Value</th><th>Source</th><th>Checked by you</th></tr></thead>
          <tbody>
            {s.rows.map((r, i) => (
              <tr key={r.lineId} onClick={() => setTr(i)} style={{ cursor: "pointer", background: i === tr ? "var(--color-accent-100)" : undefined }}>
                <td>{r.lineId}</td><td>{r.name}</td><td>{r.vendor ?? "—"}</td>
                <td style={{ textAlign: "right" }}>{r.perBox != null ? inr(r.perBox) : "—"}</td>
                <td style={{ textAlign: "right" }}>{r.qty.toLocaleString("en-IN")}</td>
                <td style={{ textAlign: "right" }}>{lakh(r.value)}</td>
                <td style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{r.where?.replace(/^[^,]+, /, "") ?? "—"}</td>
                <td style={{ whiteSpace: "nowrap", fontSize: 12, color: r.checked ? "var(--color-accent-800)" : "var(--color-neutral-600)" }} title={r.checked ? `${r.checked.who}` : undefined}>{r.perBox == null ? "" : r.checked ? `✓ ${stamp(r.checked.at)}` : "not yet"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>,
    <aside style={{ width: 470, flex: "none", background: "var(--color-surface)", padding: "22px 22px 30px", display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 0, alignSelf: "flex-start", maxHeight: "100vh", overflow: "auto" }}>
      <span style={label11}>Trace · {row.lineId} · {row.name}</span>
      {row.source && row.replyId ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><span style={label11}>As written</span><div style={{ fontSize: 18, fontWeight: 600 }}>{row.asWritten}</div></div>
            <div><span style={label11}>On our basis</span><div style={{ fontSize: 18, fontWeight: 600 }}>{row.perBox != null ? inr(row.perBox) : "—"}</div></div>
          </div>
          <span style={{ fontSize: 12.5 }}>{row.vendor} · {row.calc === "as written" ? "no conversion" : row.calc}</span>
          <SourceDoc replyId={row.replyId} source={row.source} raw={row.raw} lineId={row.lineId}
            filePath={paths[`${row.replyId}|${row.source.file.toLowerCase()}`] ?? (/award_summary/i.test(row.source.file) ? "dataset/04_history/SE-2025-037_Award_Summary.xlsx" : null)} />
        </>
      ) : (
        <span style={{ color: "var(--color-neutral-700)" }}>No price was awarded on this line.</span>
      )}
    </aside>,
  );
}
