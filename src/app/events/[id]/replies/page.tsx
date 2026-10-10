"use client";
import { useRef, useState } from "react";
import { Camera, CaretDown, CaretRight, Envelope, File, FileDoc, FilePdf, FileXls, UploadSimple, Warning } from "@phosphor-icons/react";
import { Kpis, QualityLabel } from "@/components/ui";
import Link from "next/link";
import { ScreenHead } from "@/components/Rail";
import { Shell } from "@/components/Shell";
import { useReadings, type EventData, type ReplyState } from "@/components/useReadings";
import { buildGrid, cellKey, type Grid } from "@/lib/compare";
import { qualityOf, type Quality } from "@/lib/quality";
import { findDoubts } from "@/lib/doubts";
import { assuranceOf } from "@/components/Assurance";
import { checkKey, useVerified, type Checks } from "@/components/useVerified";
import { useScheme } from "@/components/useScheme";
import type { ReplyReading } from "@/lib/reader/pipeline";
import { mainFile, type ReplySummary } from "@/lib/summary";
import { lakh, readStamp, where } from "@/lib/format";
import type { SourcingEvent } from "@/lib/types";

const KIND_ICON: Record<string, typeof File> = { xlsx: FileXls, pdf: FilePdf, docx: FileDoc, image: Camera, eml: Envelope };
const FORMAT_LABEL: Record<string, string> = { xlsx: "Excel", pdf: "PDF", docx: "Word", image: "Photo", eml: "Email", text: "Text" };

const STAGE_LABEL: Record<string, string> = {
  queued: "Waiting its turn",
  waiting: "Waiting to be read (no API key yet)",
  opening: "Opening the files",
  sorting: "Sorting: what is this reply?",
  "reading prices": "Reading every price",
  "sweeping terms": "Sweeping the terms: footnotes, second sheets, the cover email",
  "waiting for the free quota": "Waiting for the free AI quota, then carrying on",
  "checking sources": "Checking every number against the original",
  done: "",
};
const STAGE_STEP: Record<string, number> = { queued: 0, waiting: 0, opening: 1, sorting: 2, "reading prices": 3, "sweeping terms": 4, "waiting for the free quota": 4, "checking sources": 5, done: 6 };

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }) : "date unknown";




function termLine(rd: ReplyReading): string[] {
  const out: string[] = [];
  const pick = (k: string) => rd.terms.filter((t) => t.kind === k && t.verification.status !== "failed");
  const basis = rd.prices.length ? rd.prices[0].price_basis : null;
  const cur = [...new Set(rd.prices.map((p) => p.currency))];
  const units = [...new Set(rd.prices.map((p) => p.unit))];
  if (rd.prices.length) out.push(`Priced ${units.map((u) => u.replace("per_", "per ").replace("_", " ")).join(", ")} in ${cur.join(", ")}, ${basis === "ex_works" ? "ex-works" : basis === "delivered" ? "delivered" : "basis not stated"}`);
  if (rd.rateRules.length) out.push(`Priced by rate: ${rd.rateRules.map((r) => `${r.value_text} ${r.unit_text}${r.applies_to_ply ? ` (${r.applies_to_ply}-ply)` : ""}${r.from_earlier_record ? " from last year's quote" : ""}`).join("; ")}`);
  for (const t of [...pick("freight"), ...pick("handling"), ...pick("discount")]) out.push(t.summary);
  return out;
}

/** "Included in the delivered price", as opposed to "extra and not included". */
const includedInPrice = (t: string) => /includ/i.test(t) && !/not includ|exclud|extra|separately/i.test(t);

/** What needs the buyer on this reply, worked out in code from the reading: lines to look at, and messages to answer. */
function needsYou(rd: ReplyReading | null, grid?: Grid, raised?: Set<string>): { kind: "Line" | "Message"; text: string }[] {
  if (!rd) return [];
  if (rd.status === "unreadable" || rd.status === "pending" || rd.status === "incomplete" || rd.status === "error")
    return rd.nextStep.text ? [{ kind: "Message", text: rd.nextStep.text }] : [];
  if (rd.status !== "read") return [];
  const out: { kind: "Line" | "Message"; text: string }[] = [];
  const seen = new Set<string>();
  for (const p of [...rd.prices].sort((x, y) => (x.line_id ?? "Z").localeCompare(y.line_id ?? "Z"))) {
    if (!p.line_id || seen.has(p.line_id)) continue;
    // The same alternative readings the comparison tests (the reader's, or code's likely pen correction).
    const cell = grid && rd.vendorId ? grid.cells[cellKey(rd.vendorId, p.line_id)] : null;
    const alts = cell?.norm.replyId === rd.replyId ? cell.norm.alternatives.map((x) => x.value) : p.alternative_readings.map((x) => x.value);
    const diff = (p.difference ?? "a different spec").replace(/\.$/, "");
    const t = p.differs_from_rfq ? `${p.line_id} ${/^offered/i.test(diff) ? diff[0].toLowerCase() + diff.slice(1) : `offered ${diff}`}`
      // A hard-to-read price needs the buyer only if code raised it (one of its readings changes a winner); otherwise it is logged.
      : p.legibility !== "clear" && rd.vendorId && raised?.has(cellKey(rd.vendorId, p.line_id)) ? `${p.line_id} price unclear: ${[Number(p.raw_value), ...alts].sort((x, y) => x - y).map((v) => `₹${v.toFixed(2)}`).join(" or ")}`
      : p.verification.status === "failed" ? `${p.line_id} not found where the reader said` : null;
    if (t) { seen.add(p.line_id); out.push({ kind: "Line", text: t }); }
  }
  for (const t of rd.terms) {
    if (t.verification.status === "failed") continue;
    if (t.kind === "discount" && t.condition)
      out.push({ kind: "Message", text: t.value != null && t.value_unit === "percent" && t.condition_threshold_inr ? `${t.value}% discount only above ${lakh(t.condition_threshold_inr).replace(".00 ", " ")} per PO` : `Discount only if ${t.condition}` });
    // A charge said to exist with no amount ("freight extra"); not one said to be included in the price.
    else if ((t.kind === "freight" || t.kind === "handling") && !t.amount_stated && !includedInPrice(`${t.summary} ${t.source.snippet}`))
      out.push({ kind: "Message", text: `“${t.kind === "freight" ? "Freight" : "Handling"} extra”, no amount given` });
  }
  if (rd.unsourced > 0) out.push({ kind: "Message", text: `${rd.unsourced} value(s) not found in the file; kept out` });
  return out;
}

const ROW_COLS = "28px minmax(0,1.6fr) minmax(0,0.75fr) minmax(0,0.9fr) minmax(0,0.9fr) minmax(0,1.9fr) 56px";

function Row({ r, st, ev, onRead, impact, quality, grid, raised, checks }: { r: ReplySummary; st: ReplyState | undefined; ev: SourcingEvent; onRead: (fresh: boolean) => void; impact?: string | null; quality?: Quality; grid?: Grid; raised?: Set<string>; checks?: Checks }) {
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(false);
  const rd = st?.reading ?? null;
  const f = mainFile(r, rd);
  const Icon = f ? KIND_ICON[f.kind] ?? File : File;
  const name = r.vendorName ?? rd?.vendorName ?? rd?.classification?.vendor_name ?? r.from?.replace(/<.*>/, "").trim() ?? "Unknown sender";
  const reading = st && st.stage !== "done";
  const docs = rd?.qualityDocs ?? [];
  const isQuote = rd && (rd.status === "read" || rd.status === "incomplete");
  const needs = needsYou(rd, grid, raised);
  const sub = "text-[14px] text-n-700";
  const fileHref = f ? `/api/file?path=${encodeURIComponent(f.path)}` : null;
  const blank = rd ? rd.coverage.missing.length : 0;

  return (
    <section style={{ boxShadow: "inset 0 -1px 0 var(--color-neutral-300)" }}>
      <div className="hover-row" onClick={() => setExpanded(!expanded)} style={{ display: "grid", gridTemplateColumns: ROW_COLS, gap: 16, alignItems: "center", padding: "12px 0", minHeight: 72, cursor: "pointer", fontSize: 16 }}>
        <span style={{ display: "flex", justifyContent: "center", color: "var(--color-neutral-800)" }} aria-label={expanded ? "Hide details" : "Show details"}>
          {expanded ? <CaretDown size={16} weight="duotone" /> : <CaretRight size={16} weight="duotone" />}
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="text-[17px] font-semibold leading-tight">{name}</div>
          <div className={sub}>
            {when(r.receivedAt).replace(/ \d{4},?/, ",")}
            {r.contact ? ` · ${r.contact}` : r.from ? ` · ${r.from.replace(/<.*>/, "").trim()}` : " · no sender"}
          </div>
          {rd?.revision?.is_revision && <div className="text-[14px] text-a-700">Revised offer{rd.revision.supersedes ? `, supersedes ${rd.revision.supersedes}` : ""}</div>}
        </div>
        <span className="flex items-center gap-[8px]">{f ? <><Icon size={22} weight="duotone" />{FORMAT_LABEL[f.kind] ?? f.kind}</> : "No file"}</span>
        <div>
          {reading ? (
            <>
              <div className="text-[15px] font-semibold">{STAGE_LABEL[st.stage] ?? st.stage}</div>
              <div className="h-[6px] bg-n-300 mt-[6px] rounded-[3px] overflow-hidden" style={{ maxWidth: 160 }}>
                <div className="h-[6px] bg-accent transition-all duration-500" style={{ width: `${(100 * (STAGE_STEP[st.stage] ?? 0)) / 6}%` }} />
              </div>
            </>
          ) : isQuote ? (
            <span style={{ display: "flex", flexDirection: "column" }}>
              <span><span className={blank ? "font-semibold" : undefined}>{rd.coverage.quoted.length} of {rd.coverage.total}</span>{blank ? <span className="text-n-700 text-[15px]"> · {blank} blank</span> : null}</span>
              {(() => {
                // Three assurance levels, counted over this reply's prices in the comparison.
                if (!grid || !rd.vendorId) return null;
                const cells = ev.lines.map((l) => grid.cells[cellKey(rd.vendorId!, l.id)]).filter((c) => c.perBox != null && c.norm.replyId === rd.replyId);
                if (!cells.length) return null;
                const n = { ai: 0, matched: 0, verified: 0 };
                for (const c of cells) n[assuranceOf(c, !!checks?.[checkKey(c.vendorId, c.lineId)])]++;
                return <span className="text-[13px] text-n-700" title="Read by AI · matched to the source by code · approved by you">{n.ai} AI only · {n.matched} matched · {n.verified} approved</span>;
              })()}
            </span>
          ) : st?.error ? <span className="text-d-700">Not read</span>
            : rd ? <span>{{ unreadable: "Unreadable", pending: "Pending", ignored: "Ignored", error: "Not read" }[rd.status as "unreadable"] ?? "—"}</span> : "—"}
        </div>
        <div>
          {!isQuote ? "—"
            : quality ? <QualityLabel returned={quality.returned} score={quality.score} cleared={quality.cleared} />
            : rd.questionnaire.length ? <span>{rd.questionnaire.length} of {ev.questions.length} answers</span>
            : <QualityLabel returned={false} score={null} cleared={false} />}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, color: "var(--color-accent-2-800)", fontSize: 15 }}>
          {st?.error ? <span>{st.error}</span> : needs.length ? needs.map((n, i) => (
            <span key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8 }}><b>{n.kind}</b><span>{n.text}</span></span>
          )) : <span style={{ color: "var(--color-neutral-800)" }}>—</span>}
        </div>
        <span style={{ textAlign: "right" }}>
          {fileHref ? <a href={fileHref} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="Open the original file">Open</a> : null}
        </span>
      </div>

      {expanded && (
        <div style={{ padding: "4px 0 18px 44px", display: "flex", flexDirection: "column", gap: 14, fontSize: 15 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)", gap: 24 }}>
            <div>
              <div className="font-semibold">File</div>
              <div className="break-all">{f?.name ?? "No file"}</div>
              <div className={sub}>
                {r.files.length > 1 ? `+ ${r.files.length - 1} attachment${r.files.length > 2 ? "s" : ""}` : ""}
                {r.cover && r.files.length ? `${r.files.length > 1 ? ", " : ""}cover email` : ""}
              </div>
              {impact && <div className="text-n-800 mt-[6px]">{impact}</div>}
              {st?.notice && <div className="text-n-800 mt-[6px]">{st.notice}</div>}
            </div>
            <div>
              <div className="font-semibold">{isQuote ? "Price basis, as read" : "What it is"}</div>
              {isQuote ? (
                <>
                  {termLine(rd).map((t, i) => <div key={i}>{t}</div>)}
                  {rd.coverage.missing.length > 0 && <div className={sub}>Not quoted: {rd.coverage.missing.join(", ")}</div>}
                  {rd.status === "incomplete" && <div className="text-doubt">Held out of the comparison: {rd.headline}</div>}
                </>
              ) : rd ? (
                <>
                  <div>{rd.headline}</div>
                  {rd.nextStep.text && <div className={sub}>Next: {rd.nextStep.text}</div>}
                </>
              ) : null}
            </div>
            <div>
              {isQuote && (
                <>
                  <div className="font-semibold">Quality documents</div>
                  {docs.map((d, i) => (
                    <div key={i}>
                      {d.kind === "iso_certificate" ? "ISO 9001" : d.kind === "test_report" ? "Test report" : d.summary}
                      {d.valid_until ? ` · valid to ${d.valid_until}` : d.date ? ` · ${d.date}` : ""}
                      {d.marked_as_sample ? <span className="text-n-700"> · marked sample</span> : null}
                    </div>
                  ))}
                  {!docs.length && <div className="text-n-700">No documents attached.</div>}
                  {quality?.returned && !rd.questionnaire.length && <div className={sub}>Answers in another reply from this vendor</div>}
                  {quality?.returned && rd.questionnaire.length > 0 && (
                    <details className="mt-[2px]">
                      <summary className="cursor-pointer text-a-700" style={{ listStyle: "none" }}>How code marked it</summary>
                      <div className={sub + " mt-[2px]"}>{rd.questionnaire.length} of {ev.questions.length} answers read; pass mark {quality.passMark}</div>
                      <ul className="mt-[4px] space-y-[2px] text-[14px]">
                        {quality.items.map((x) => (
                          <li key={x.id} className="grid grid-cols-[30px_48px_1fr] gap-[6px]">
                            <span className="text-n-700">{x.id}</span>
                            <span className={x.mandatory && x.pts === 0 ? "font-semibold text-[var(--color-accent-2-800)]" : ""}>{x.pts} / {x.of}</span>
                            <span className="text-n-700">{x.why}{x.mandatory ? " · mandatory" : ""}</span>
                          </li>
                        ))}
                      </ul>
                      <Link href={`/events/${ev.id}/rfq?tab=rules`}>See the marking scheme</Link>
                    </details>
                  )}
                </>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            {fileHref && <a className="btn btn-secondary" href={fileHref} target="_blank" rel="noreferrer" style={{ color: "var(--color-text)" }}>Open original</a>}
            {rd && (rd.prices.length > 0 || rd.terms.length > 0) && (
              <button className="btn btn-secondary" onClick={() => setOpen(!open)}>{open ? "Hide what was read" : "See what was read"}</button>
            )}
            {rd && !reading && (
              <span className={sub}>
                {rd.status === "error" ? "Not read yet" : `${rd.saved ? "Saved reading, " : "Read live, "}${readStamp(rd)}`}
                {r.origin !== "upload" && <>{"  "}<button className="text-a-700 ml-[8px]" onClick={() => onRead(true)}>Read again live</button></>}
                {r.origin === "upload" && " · uploaded in this session"}
              </span>
            )}
          </div>
          {open && rd && <Detail rd={rd} ev={ev} />}
        </div>
      )}
    </section>
  );
}

function Check({ s }: { s: string }) {
  if (s === "verified") return <span className="text-a-700">checked</span>;
  if (s === "photo") return <span className="text-n-700">photo: by eye</span>;
  return (
    <span className="text-doubt inline-flex items-center gap-[3px]">
      <Warning size={13} /> not found
    </span>
  );
}

function Detail({ rd, ev }: { rd: ReplyReading; ev: SourcingEvent }) {
  const th = "text-left font-semibold text-n-800 text-[14px] py-[4px] pr-[var(--space-3)] border-b border-rule";
  const td = "py-[4px] pr-[var(--space-3)] align-top border-b border-rule";
  const sorted = [...rd.prices].sort((a, b) => (a.line_id ?? "Z").localeCompare(b.line_id ?? "Z"));
  return (
    <div className="text-[14px] bg-[var(--color-bg)] p-[var(--space-4)] rounded-[var(--radius-lg)]">
      {sorted.length > 0 && (
        <>
          <h3 className="text-[16px] mb-[6px]">Prices, as written</h3>
          <table className="w-full num">
            <thead>
              <tr>
                {["Line", "Vendor's words", "As written", "Unit", "Currency", "Basis", "Where it was read", "Source check", "Notes"].map((h) => (
                  <th key={h} className={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => (
                <tr key={i}>
                  <td className={td}>
                    <div>{p.line_id ?? "no match"}</div>
                    <div className="text-n-700 text-[13px]">{ev.lines.find((l) => l.id === p.line_id)?.name}</div>
                  </td>
                  <td className={td}>
                    {p.vendor_wording}
                    <div className="text-n-700 text-[13px]">{p.match_reason}</div>
                  </td>
                  <td className={td}>{p.raw_value_text}</td>
                  <td className={td}>{p.unit_text}</td>
                  <td className={td}>{p.currency}</td>
                  <td className={td}>{p.price_basis.replace("_", "-")}</td>
                  <td className={td}>{where(p.source)}</td>
                  <td className={td}><Check s={p.verification.status} /><div className="text-n-700 text-[13px]">{p.verification.note}</div></td>
                  <td className={td + " text-doubt"}>
                    {p.differs_from_rfq && <div>Offered: {p.difference}</div>}
                    {p.legibility !== "clear" && (
                      <div>
                        {p.legibility === "corrected_by_hand" ? "Corrected by hand" : "Hard to read"}
                        {p.alternative_readings.length ? `; could be ${p.alternative_readings.map((a) => a.value).join(" or ")}` : ""}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {rd.rateRules.length > 0 && (
        <>
          <h3 className="text-[16px] mt-[var(--space-4)] mb-[6px]">Rates (priced by weight or component)</h3>
          <table className="w-full num">
            <thead><tr>{["Rate", "Applies to", "Vendor's words", "Where it was read", "Source check"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {rd.rateRules.map((r, i) => (
                <tr key={i}>
                  <td className={td}>{r.value_text} {r.unit_text} {r.currency}{r.from_earlier_record && <div className="italic text-n-700">last year&apos;s rate</div>}</td>
                  <td className={td}>{r.component.replaceAll("_", " ")}{r.applies_to_ply ? `, ${r.applies_to_ply}-ply` : ""}</td>
                  <td className={td}>{r.vendor_wording}{r.pointer && <div className="text-n-700 text-[13px]">pointed to by &ldquo;{r.pointer}&rdquo;</div>}</td>
                  <td className={td}>{where(r.source)}</td>
                  <td className={td}><Check s={r.verification.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {rd.terms.length > 0 && (
        <>
          <h3 className="text-[16px] mt-[var(--space-4)] mb-[6px]">Terms found anywhere in the reply</h3>
          <table className="w-full">
            <thead><tr>{["Term", "What it says", "Condition", "Where it was read", "Source check"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {rd.terms.map((t, i) => (
                <tr key={i}>
                  <td className={td}>{t.kind.replaceAll("_", " ")}</td>
                  <td className={td}>{t.summary}{!t.amount_stated && <div className="text-doubt">amount not given</div>}</td>
                  <td className={td}>{t.condition ?? ""}</td>
                  <td className={td}>{where(t.source)}<div className="text-n-700 text-[13px]">&ldquo;{t.source.snippet}&rdquo;</div></td>
                  <td className={td}><Check s={t.verification.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {rd.readingNotes.length > 0 && (
        <>
          <h3 className="text-[16px] mt-[var(--space-4)] mb-[6px]">Reader&apos;s notes</h3>
          <ul className="list-disc pl-[var(--space-4)]">{rd.readingNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </>
      )}
    </div>
  );
}

/** Upload a reply that arrived outside the event inbox; the real pipeline reads it live. */
function Upload({ vendors, onUpload, disabled }: { vendors: SourcingEvent["vendors"]; onUpload: (files: File[], vendorId: string) => Promise<void>; disabled: boolean }) {
  const [files, setFiles] = useState<File[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [busy, setBusy] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  return (
    <form
      className="sheet flex flex-wrap items-center gap-[14px] text-[16px]" style={{ padding: "12px 16px", boxShadow: "var(--shadow-sm)" }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!files.length) return;
        setBusy(true);
        await onUpload(files, vendorId);
        setBusy(false);
        setFiles([]);
        (e.target as HTMLFormElement).reset();
      }}
    >
      <input ref={pick} type="file" multiple hidden accept=".xlsx,.docx,.pdf,.jpg,.jpeg,.png,.eml,.txt,.csv" onChange={(e) => setFiles([...(e.target.files ?? [])])} disabled={busy || disabled} />
      <button type="button" className="btn btn-secondary" style={{ background: "var(--color-bg)" }} onClick={() => pick.current?.click()} disabled={busy || disabled}>Choose file{files.length > 1 ? "s" : ""}</button>
      <span className="text-n-700">{files.length ? files.map((x) => x.name).join(", ") : "No file chosen"} · up to 4 MB</span>
      <label className="flex items-center gap-[10px] ml-auto">
        From
        <select className="input" style={{ width: 260, minHeight: 38, padding: "4px 8px", background: "var(--color-bg)" }} value={vendorId} onChange={(e) => setVendorId(e.target.value)} disabled={busy || disabled}>
          <option value="">Work it out from the file</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </label>
      <button className="btn btn-primary" type="submit" disabled={!files.length || busy || disabled}>{busy ? "Reading…" : "Read it"}</button>
    </form>
  );
}

/**
 * L17: for a reply that revises a vendor's earlier offer, what changed and whether it moves a winner.
 * Code compares the table with and without this reply.
 */
function revisionImpact(data: EventData, state: Record<string, ReplyState>, id: string): string | null {
  const rd = state[id]?.reading;
  if (!rd?.vendorId || rd.status !== "read") return null;
  const all = data.replies.map((x) => state[x.id]?.reading).filter((x): x is ReplyReading => Boolean(x && x.status !== "error"));
  const others = all.filter((x) => x.replyId !== id);
  if (!others.some((x) => x.vendorId === rd.vendorId)) return null; // nothing earlier to revise
  const files = Object.fromEntries(data.replies.map((x) => [x.id, mainFile(x, state[x.id]?.reading ?? null) ?? undefined]));
  const g1 = buildGrid(data.event, all, { sheets: data.historySheets }, files, data.lastYear);
  // Lines whose price as written differs from the vendor's previous offer.
  const changed = data.event.lines.filter((l) => {
    const n = g1.cells[cellKey(rd.vendorId!, l.id)].norm;
    return n.replyId === id && n.flags.some((f) => f.startsWith("revised (was"));
  });
  if (!changed.length) return rd.revision?.is_revision ? "No price differs from the earlier offer." : null;
  // The same table with only those lines put back to the earlier offer's price (terms unchanged).
  const ids = new Set(changed.map((l) => l.id));
  const earlier = others.filter((x) => x.vendorId === rd.vendorId);
  const undone: ReplyReading = {
    ...rd,
    prices: rd.prices.map((p) => (p.line_id && ids.has(p.line_id) ? earlier.map((e) => e.prices.find((q) => q.line_id === p.line_id)).find(Boolean) ?? p : p)),
  };
  const g0 = buildGrid(data.event, [...others, undone], { sheets: data.historySheets }, files, data.lastYear);
  const short = (v: string | undefined) => data.event.vendors.find((x) => x.id === v)?.short ?? "nobody";
  const moves = data.event.lines.filter((l) => g1.asQuoted.per[l.id]?.vendorId !== g0.asQuoted.per[l.id]?.vendorId);
  const fmt = (n: number | null) => (n == null ? "—" : `₹${n.toFixed(2)}`);
  return `Changes ${changed.map((l) => `${l.id} ${fmt(g0.cells[cellKey(rd.vendorId!, l.id)].perBox)} → ${fmt(g1.cells[cellKey(rd.vendorId!, l.id)].perBox)}`).join(", ")}. `
    + (moves.length ? `Moves the winner on ${moves.map((l) => `${l.id} (${short(g0.asQuoted.per[l.id]?.vendorId)} → ${short(g1.asQuoted.per[l.id]?.vendorId)})`).join(", ")}.` : "It does not move any winner.");
}

export default function RepliesPage() {
  const { data, state, blocked, readOne, upload, empty } = useReadings();
  const [scheme] = useScheme();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [checks] = useVerified();
  if (!data) return <Shell><div className="text-n-700">Loading the event…</div></Shell>;
  const ev = data.event;
  const readings = data.replies.map((x) => state[x.id]?.reading).filter((x): x is ReplyReading => Boolean(x && x.status !== "error"));
  const qualityFor = (id: string) => {
    const v = state[id]?.reading?.vendorId;
    return v ? qualityOf(ev, v, readings, scheme) : undefined;
  };
  // Quotes first (in arrival order), then everything kept out of the comparison.
  const outOfGrid = (id: string) => {
    const s = state[id]?.reading?.status;
    return s === "unreadable" || s === "pending" || s === "ignored";
  };
  const main = data.replies.filter((r) => !outOfGrid(r.id));
  const other = data.replies.filter((r) => outOfGrid(r.id));
  const done = data.replies.filter((r) => state[r.id]?.stage === "done").length;

  const quotes = readings.filter((x) => x.vendorId && (x.status === "read" || x.status === "incomplete"));
  const replied = new Set(quotes.map((x) => x.vendorId)).size;
  const priced = ev.vendors.reduce((a, v) => a + new Set(quotes.filter((x) => x.vendorId === v.id).flatMap((x) => x.coverage.quoted)).size, 0);
  const files = Object.fromEntries(data.replies.map((x) => [x.id, mainFile(x, state[x.id]?.reading ?? null) ?? undefined]));
  const grid = buildGrid(ev, readings, { sheets: data.historySheets }, files, data.lastYear);
  const cleared = ev.vendors.map((v) => qualityOf(ev, v.id, readings, scheme)).filter((q) => q.cleared).map((q) => q.vendorId);
  const raised = new Set(findDoubts(ev, grid, cleared).raised.filter((d) => d.kind === "hard_to_read").flatMap((d) => d.lineIds.map((l) => cellKey(d.vendorId, l))));
  const needs = data.replies.flatMap((r) => (state[r.id]?.reading?.status === "ignored" ? [] : needsYou(state[r.id]?.reading ?? null, grid, raised)));
  const nLines = needs.filter((n) => n.kind === "Line").length;
  const nMsgs = needs.length - nLines;
  const head = (
    <div style={{ display: "grid", gridTemplateColumns: ROW_COLS, gap: 16, padding: "10px 0", fontSize: 15, fontWeight: 600, color: "var(--color-neutral-800)", boxShadow: "inset 0 -2px 0 var(--color-text)" }}>
      <span /><span>Vendor</span><span>Sent as</span><span>Lines priced</span><span>Quality</span><span>Needs you</span><span />
    </div>
  );

  return (
    <Shell>
      <div className="flex flex-col gap-[16px]" style={{ maxWidth: 1300 }}>
      <ScreenHead meta={<>{ev.id} · {ev.title} · Typed files are matched to the source by code. Photo readings need your check.</>} title="Replies">
        <Link href="/scorecard" style={{ fontSize: 16, marginRight: 8 }}>Reading scorecard</Link>
        <button className="btn btn-secondary" style={{ whiteSpace: "nowrap" }} aria-expanded={uploadOpen} onClick={() => setUploadOpen(!uploadOpen)}><UploadSimple size={18} weight="duotone" />Upload a reply</button>
        <Link className="btn btn-primary" href={`/events/${ev.id}/compare`} style={{ whiteSpace: "nowrap", color: "var(--color-bg)" }}>Open comparison</Link>
      </ScreenHead>
      {!data.keyConfigured && (
        <div className="p-[var(--space-3)] bg-d-100 text-[15px] rounded-[var(--radius-md)]">
          Live reading is off: no Gemini API key is set on the server yet. Saved readings still show.
        </div>
      )}
      {empty && !main.length && !other.length && (
        <div className="p-[var(--space-3)] bg-[var(--color-accent-100)] text-[15px] max-w-[860px]">
          The event is empty (reset from the P menu): the RFQ went to {ev.vendors.length} vendors, and no reply is in yet. Upload a reply (any format) and watch it read; it joins the comparison as soon as it is done.
          Test replies are in the repository folder <code>test-uploads/</code>, or use the vendors’ original replies from <code>dataset/03_vendor_replies/</code>.
        </div>
      )}
      {(uploadOpen || (empty && !main.length && !other.length)) && <Upload vendors={ev.vendors} onUpload={upload} disabled={!data.keyConfigured} />}
      {blocked && <div className="p-[var(--space-3)] bg-d-100 text-[15px] rounded-[var(--radius-md)]">{blocked}</div>}
      <Kpis items={[
        { label: "Replied", value: `${replied} of ${ev.vendors.length}` },
        { label: "Prices read", value: `${priced} of ${ev.vendors.length * ev.lines.length}` },
        { label: "Need you", value: <>{needs.length}{needs.length > 0 && <span style={{ fontSize: 17, fontWeight: 400 }}> · {nLines} line{nLines === 1 ? "" : "s"} · {nMsgs} message{nMsgs === 1 ? "" : "s"}</span>}</>, doubt: needs.length > 0 },
      ]} />
      {data.keyConfigured && done < data.replies.length && (
        <div className="text-[15px] text-n-700">Reading: {done} of {data.replies.length} done</div>
      )}
      <div className="sheet" style={{ padding: "6px 24px 10px" }}>
        {head}
        {!main.length && <div style={{ padding: "20px 0" }} className="text-n-700">No quotes in yet.</div>}
        {main.map((r) => <Row key={r.id} r={r} st={state[r.id]} ev={ev} onRead={(fresh) => readOne(r.id, fresh)} impact={revisionImpact(data, state, r.id)} quality={qualityFor(r.id)} grid={grid} raised={raised} checks={checks} />)}
      </div>
      {other.length > 0 && (
        <>
          <div>
            <h2 className="text-[22px] m-0">Not in the comparison</h2>
            <p className="text-[15px] text-n-700 m-0">Messages that are not quotes, or could not be read. Each has a next step.</p>
          </div>
          <div className="sheet" style={{ padding: "6px 24px 10px" }}>
            {head}
            {other.map((r) => <Row key={r.id} r={r} st={state[r.id]} ev={ev} onRead={(fresh) => readOne(r.id, fresh)} grid={grid} raised={raised} checks={checks} />)}
          </div>
        </>
      )}
      </div>
    </Shell>
  );
}
