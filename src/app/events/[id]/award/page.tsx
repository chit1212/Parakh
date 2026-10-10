"use client";
// Award record (design: Shared Screens #award, L27/L30). Shows the frozen snapshot only: later
// readings or revisions never change it. Every row traces to its source. The VP approves.
import { useEffect, useState } from "react";
import Link from "next/link";
import { CaretRight, FilePdf, FileXls, LockSimple } from "@phosphor-icons/react";
import { Kpis, QualityLabel } from "@/components/ui";
import { Rail } from "@/components/Rail";
import { SourceDoc } from "@/components/SourceDoc";
import { useReadings } from "@/components/useReadings";
import { fmtAt, SNAPSHOT_KEY, type Snapshot } from "@/lib/award";
import { download } from "@/lib/download";
import { crore, inr, lakh } from "@/lib/format";
import { HOME } from "@/lib/routes";
import { useRole } from "@/components/useRole";
import { stamp } from "@/components/useVerified";

const label11 = { fontSize: 15, color: "var(--color-neutral-700)" };

/** A collapsed row (v2): caret, a 17 px title and a 15 px sub-line; the detail opens below. */
function Fold({ title, sub, open, children }: { title: string; sub: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="fold" style={{ padding: "12px 0", boxShadow: "inset 0 -1px 0 var(--color-neutral-300)" }}>
      <summary style={{ listStyle: "none", cursor: "pointer", display: "flex", alignItems: "baseline", gap: 10 }}>
        <CaretRight size={16} weight="duotone" className="fold-caret" style={{ alignSelf: "center", flex: "none" }} />
        <span style={{ fontSize: 17, fontWeight: 600 }}>{title}</span>
        <span style={{ fontSize: 15, color: "var(--color-neutral-700)" }}>{sub}</span>
      </summary>
      <div style={{ padding: "10px 0 4px 26px" }}>{children}</div>
    </details>
  );
}

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
    <div style={{ display: "flex", minHeight: "100vh", minWidth: 1360, fontSize: 16, lineHeight: 1.45, fontVariantNumeric: "tabular-nums" }}>
      <Rail />
      <div style={{ flex: 1, minWidth: 0, padding: "20px 28px 40px 12px", display: "flex", flexDirection: "column", gap: 18 }}>{body}</div>
      {aside}
    </div>
  );
  if (s === undefined) return frame(<span style={{ color: "var(--color-neutral-700)" }}>Loading…</span>);
  if (!s)
    return frame(
      <>
        <span style={label11}>Award record · SE-2026-041</span>
        <h1 style={{ fontSize: 30, fontWeight: 600, margin: 0 }}>Nothing frozen yet</h1>
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
    { label: "Award total", value: crore(s.total), sub: `${s.byVendor.length} vendor${s.byVendor.length === 1 ? "" : "s"} · ${awarded.length} lines` },
    { label: "vs last year", value: lyPct != null ? <span style={{ color: "var(--color-accent-800)" }}>{`${lyPct >= 0 ? "+" : "−"}${Math.abs(lyPct).toFixed(1)}%`}</span> : "—",
      sub: s.lastYear ? `like for like, ${s.lastYear.lines} lines` : "no line priced last year" },
    { label: "Cost of the rules applied", value: `${d >= 0 ? "+" : "−"}${lakh(Math.abs(d))}`, sub: "vs cheapest overall, any vendor" },
    { label: "Prices you approved", value: `${checked.length} of ${awarded.length}`, sub: checkers.length ? `by ${checkers.join(" and ")}` : "none approved yet" },
  ];
  const summary = `${s.basis}. ${s.byVendor.map((v) => `${v.vendor} ${v.lines} line${v.lines === 1 ? "" : "s"} (${lakh(v.value)})`).join(", ")}. `
    + (s.excluded.length ? `Left out: ${s.excluded.map((x) => `${x.name} (${x.why})`).join("; ")}. ` : "")
    + `${s.decisions.filter((x) => x.status.startsWith("Open")).length} of ${s.decisions.length} doubts are still open. Parakh recommends; the buyer and the VP decide.`;
  const row = s.rows[tr];
  const paths: Record<string, string> = {};
  for (const r of data?.replies ?? []) for (const f of [...(r.cover ? [r.cover] : []), ...r.files]) paths[`${r.id}|${f.name.toLowerCase()}`] = f.path;

  return frame(
    <>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
        <div style={{ marginRight: "auto", display: "flex", flexDirection: "column", gap: 2, flex: "1 0 100%", minWidth: 0 }}>
          <span style={label11}>Award record · {s.eventId} · for approval by {ev?.vp ?? "the VP"}, {ev?.vpRole ?? ""}</span>
          <h1 style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.15, margin: 0 }}>{s.title}</h1>
        </div>
        <Link className="btn btn-secondary" href={HOME} style={{ whiteSpace: "nowrap" }}>Ask a what-if</Link>
        <button className="btn btn-secondary" style={{ whiteSpace: "nowrap" }} onClick={() => download(s, "xlsx")}><FileXls size={16} weight="duotone" />Excel</button>
        <button className="btn btn-secondary" style={{ whiteSpace: "nowrap" }} onClick={() => download(s, "pdf")}><FilePdf size={16} weight="duotone" />PDF memo</button>
        {s.approvedBy ? (
          <span className="tag tag-accent" style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>Approved by {s.approvedBy}</span>
        ) : role === "VP" ? (
          <button className="btn btn-primary" style={{ whiteSpace: "nowrap" }} onClick={() => { const at = new Date().toISOString(); save({ ...s, approvedBy: `${ev?.vp ?? "VP"} (${ev?.vpRole ?? "VP"})`, approvedAt: at, audit: [...(s.audit ?? []), { at, who: ev?.vp ?? "VP", what: `Approved the award (${crore(s.total)}, snapshot ${s.id})`, why: "VP approval of the frozen award" }] }); }}>
            Approve award
          </button>
        ) : s.sentAt ? (
          <span className="tag tag-neutral" style={{ padding: "8px 12px", whiteSpace: "nowrap" }} title="Demo: nothing is sent; switch to the VP in the P menu to approve">Sent to {ev?.vp.split(" ")[0] ?? "the VP"} {stamp(s.sentAt)}</span>
        ) : (
          <button className="btn btn-primary" style={{ whiteSpace: "nowrap" }} onClick={() => { const at = new Date().toISOString(); save({ ...s, sentAt: at, audit: [...(s.audit ?? []), { at, who: ev?.buyer ?? "Buyer", what: `Sent the award to ${ev?.vp ?? "the VP"} for approval`, why: "Buyer's recommendation, frozen for approval" }] }); }}>
            Send to {ev?.vp.split(" ")[0] ?? "the VP"} for approval
          </button>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 16, maxWidth: 900 }}>{summary}</p>
      <Kpis items={kpis} />
      <div className="sheet" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h3 style={{ fontSize: 20, margin: 0 }}>Who gets what</h3>
        <table className="table">
          <thead><tr><th>Vendor</th><th style={{ textAlign: "right" }}>Lines</th><th style={{ textAlign: "right" }}>Value</th><th style={{ width: "34%" }}>Share</th><th>Quality</th></tr></thead>
          <tbody>
            {s.byVendor.map((v) => {
              const pct = s.total ? (v.value / s.total) * 100 : 0;
              return (
                <tr key={v.vendor} className="hover-row">
                  <td style={{ fontWeight: 600 }}>{v.vendor}</td>
                  <td style={{ textAlign: "right" }}>{v.lines}</td>
                  <td style={{ textAlign: "right" }}>{lakh(v.value)}</td>
                  <td>
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ flex: 1, height: 8, background: "var(--color-neutral-300)", borderRadius: 4, overflow: "hidden" }}><span style={{ display: "block", height: 8, width: `${pct}%`, background: "var(--color-accent)" }} /></span>
                      <span style={{ width: 52, textAlign: "right" }}>{pct.toFixed(0)}%</span>
                    </span>
                  </td>
                  <td>{v.returned !== undefined ? <QualityLabel returned={v.returned} score={v.score} cleared={!!v.cleared} /> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <Fold title="Decisions on record" sub={`${s.decisions.length} doubt${s.decisions.length === 1 ? "" : "s"}, ${s.decisions.filter((x) => x.status.startsWith("Open")).length} still open`}>
          {s.decisions.map((x, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "26px minmax(0,1fr) minmax(0,1fr)", gap: 12, padding: "6px 0" }}>
              <span style={{ color: "var(--color-neutral-700)" }}>{i + 1}</span><span>{x.title}</span>
              <span style={{ color: x.status.startsWith("Open") ? "var(--color-accent-2-700)" : "var(--color-neutral-800)" }}>{x.status}</span>
            </div>
          ))}
          {!s.decisions.length && <span style={{ color: "var(--color-neutral-700)" }}>No doubt could change a winner.</span>}
        </Fold>
        <Fold title="Approvals, decisions and overrides" sub={`${(s.audit ?? []).length} on record, each with who, when and why`} open={(s.audit ?? []).length > 0}>
          {(s.audit ?? []).length ? (
            <table className="table">
              <thead><tr><th style={{ whiteSpace: "nowrap" }}>When</th><th>Who</th><th>What</th><th>Why</th></tr></thead>
              <tbody>
                {(s.audit ?? []).map((a, i) => (
                  <tr key={i}><td style={{ whiteSpace: "nowrap" }}>{fmtAt(a.at)}</td><td style={{ whiteSpace: "nowrap" }}>{a.who}</td><td>{a.what}</td><td style={{ color: "var(--color-neutral-800)" }}>{a.why}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <span style={{ color: "var(--color-neutral-700)" }}>Nothing approved, decided or overridden before this award was frozen.</span>}
        </Fold>
        <Fold title="Rules applied" sub={`${s.rules.length} rules, solved in code`}>
          {s.rules.map((t, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "30px 1fr", gap: 12 }}><span style={{ color: "var(--color-neutral-700)" }}>R{i + 1}</span><span>{t}</span></div>)}
        </Fold>
      </div>
      <div className="sheet" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h3 style={{ fontSize: 20, margin: 0 }}>Line snapshot</h3>
          <span style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--color-neutral-700)" }}>
            <LockSimple weight="duotone" />Frozen {new Date(s.frozenAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })} · snapshot {s.id} · later revisions will not change these numbers
          </span>
        </div>
        <table className="table" style={{ fontSize: 15 }}>
          <thead><tr><th>Line</th><th>Box</th><th>Awarded to</th><th style={{ textAlign: "right" }}>₹/box</th><th style={{ textAlign: "right" }}>Value</th><th>Approved by you</th></tr></thead>
          <tbody>
            {s.rows.map((r, i) => (
              <tr key={r.lineId} className={i === tr ? undefined : "hover-row"} onClick={() => setTr(i)} title={r.where ?? undefined}
                style={{ cursor: "pointer", background: i === tr ? "var(--color-accent-100)" : undefined, boxShadow: i === tr ? "inset 3px 0 0 var(--color-accent)" : undefined }}>
                <td>{r.lineId}</td><td>{r.name}</td><td>{r.vendor ?? "—"}</td>
                <td style={{ textAlign: "right" }}>{r.perBox != null ? inr(r.perBox) : "—"}</td>
                <td style={{ textAlign: "right" }}>{lakh(r.value)}</td>
                <td style={{ whiteSpace: "nowrap", fontSize: 14, color: r.checked ? "var(--color-accent-800)" : "var(--color-neutral-700)" }} title={r.checked ? `${r.checked.who}` : undefined}>{r.perBox == null ? "" : r.checked ? `✓ ${stamp(r.checked.at)}` : "not yet"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>,
    <aside style={{ width: 440, flex: "none", background: "var(--color-surface)", padding: "22px 22px 30px", display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 0, alignSelf: "flex-start", maxHeight: "100vh", overflow: "auto" }}>
      <span style={{ display: "flex", flexDirection: "column" }}><span style={{ fontSize: 17, fontWeight: 600 }}>Trace</span><span style={label11}>{row.lineId} · {row.name}</span></span>
      {row.source && row.replyId ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><span style={label11}>As written</span><div style={{ fontSize: 18, fontWeight: 600 }}>{row.asWritten}</div></div>
            <div><span style={label11}>On our basis</span><div style={{ fontSize: 18, fontWeight: 600 }}>{row.perBox != null ? inr(row.perBox) : "—"}</div></div>
          </div>
          <span style={{ fontSize: 14 }}>{row.vendor} · {row.calc === "as written" ? "no conversion" : row.calc}</span>
          <SourceDoc replyId={row.replyId} source={row.source} raw={row.raw} lineId={row.lineId}
            filePath={paths[`${row.replyId}|${row.source.file.toLowerCase()}`] ?? (/award_summary/i.test(row.source.file) ? "dataset/04_history/SE-2025-037_Award_Summary.xlsx" : null)} />
        </>
      ) : (
        <span style={{ color: "var(--color-neutral-700)" }}>No price was awarded on this line.</span>
      )}
    </aside>,
  );
}
