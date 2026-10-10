"use client";
import { useState } from "react";
import { Camera, Envelope, File, FileDoc, FilePdf, FileXls, Paperclip, Warning } from "@phosphor-icons/react";
import Link from "next/link";
import { ScreenHead } from "@/components/Rail";
import { Shell } from "@/components/Shell";
import { useReadings, type EventData, type ReplyState } from "@/components/useReadings";
import { buildGrid, cellKey } from "@/lib/compare";
import { qualityOf, type Quality } from "@/lib/quality";
import { useScheme } from "@/components/useScheme";
import type { ReplyReading } from "@/lib/reader/pipeline";
import { mainFile, type ReplySummary } from "@/lib/summary";
import { readStamp, where } from "@/lib/format";
import type { SourcingEvent } from "@/lib/types";

const KIND_ICON: Record<string, typeof File> = { xlsx: FileXls, pdf: FilePdf, docx: FileDoc, image: Camera, eml: Envelope };
const KIND_LABEL: Record<string, string> = { xlsx: "Excel workbook", pdf: "PDF", docx: "Word document", image: "Photo", eml: "Email", text: "Text file" };

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



function needsLook(rd: ReplyReading) {
  const ids = new Set<string>();
  for (const p of rd.prices) {
    if (!p.line_id) continue;
    if (p.verification.status === "failed" || p.differs_from_rfq || p.legibility !== "clear") ids.add(p.line_id);
  }
  return ids;
}

function CoverageBar({ ev, rd }: { ev: SourcingEvent; rd: ReplyReading }) {
  const look = needsLook(rd);
  const quoted = new Set(rd.coverage.quoted);
  return (
    <div className="flex gap-[2px] my-[6px]" aria-label={`${quoted.size} of ${ev.lines.length} lines quoted`}>
      {ev.lines.map((l) => (
        <span
          key={l.id}
          title={`${l.id} ${l.name}${look.has(l.id) ? " · needs a look" : quoted.has(l.id) ? "" : " · not quoted"}`}
          className="h-[14px] flex-1"
          style={{
            background: look.has(l.id) ? "var(--color-accent-2)" : quoted.has(l.id) ? "var(--color-neutral-700)" : "transparent",
            border: quoted.has(l.id) || look.has(l.id) ? "none" : "1px solid var(--color-neutral-500)",
          }}
        />
      ))}
    </div>
  );
}

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

function Row({ r, st, ev, onRead, impact, quality }: { r: ReplySummary; st: ReplyState | undefined; ev: SourcingEvent; onRead: (fresh: boolean) => void; impact?: string | null; quality?: Quality }) {
  const [open, setOpen] = useState(false);
  const rd = st?.reading ?? null;
  const f = mainFile(r, rd);
  const Icon = f ? KIND_ICON[f.kind] ?? File : File;
  const name = r.vendorName ?? rd?.vendorName ?? rd?.classification?.vendor_name ?? r.from?.replace(/<.*>/, "").trim() ?? "Unknown sender";
  const reading = st && st.stage !== "done";
  const look = rd ? needsLook(rd) : new Set<string>();
  const docs = rd?.qualityDocs ?? [];

  return (
    <section className="grid grid-cols-[1.25fr_1fr_1fr] gap-[var(--space-6)] py-[var(--space-4)] border-t border-rule">
      <div>
        <h2 className="text-[20px] leading-tight">{name}</h2>
        {f && (
          <div className="flex items-center gap-[6px] text-[14px] mt-[6px]">
            <Icon size={16} /> {f.name}
          </div>
        )}
        <div className="text-[14px] text-n-700 mt-[4px]">
          {f ? KIND_LABEL[f.kind] ?? f.kind : "No file"}
          {r.files.length > 1 ? `, with ${r.files.length - 1} more attachment${r.files.length > 2 ? "s" : ""}` : ""}
          {r.cover && r.files.length ? ", cover email" : ""}
        </div>
        <div className="text-[13px] text-n-700 mt-[4px]">
          Received {when(r.receivedAt)}
          {r.contact ? ` · ${r.contact}` : r.from ? ` · ${r.from}` : " · no sender (arrived without an email)"}
        </div>
        {rd?.revision?.is_revision && <div className="text-[13px] text-a-700 mt-[4px]">Revised offer{rd.revision.supersedes ? `: supersedes ${rd.revision.supersedes}` : ""}</div>}
        {impact && <div className="text-[13px] text-n-800 mt-[2px]">{impact}</div>}
        <div className="flex gap-[var(--space-3)] mt-[var(--space-2)] text-[14px]">
          {f && <a href={`/api/file?path=${encodeURIComponent(f.path)}`} target="_blank" rel="noreferrer">Open original</a>}
          {rd && (rd.prices.length > 0 || rd.terms.length > 0) && (
            <button className="text-accent underline" onClick={() => setOpen(!open)}>
              {open ? "Hide what was read" : "See what was read"}
            </button>
          )}
        </div>
      </div>

      <div className="text-[14px]">
        {reading ? (
          <div>
            <div className="font-semibold">{STAGE_LABEL[st.stage] ?? st.stage}</div>
            {st.detail && <div className="text-n-700 text-[13px]">{st.detail}</div>}
            <div className="h-[3px] bg-n-300 mt-[8px]">
              <div className="h-[3px] bg-accent transition-all duration-500" style={{ width: `${(100 * (STAGE_STEP[st.stage] ?? 0)) / 6}%` }} />
            </div>
          </div>
        ) : st?.error ? (
          <div className="text-d-700">Could not read: {st.error}</div>
        ) : rd ? (
          <>
            {rd.status === "read" || rd.status === "incomplete" ? (
              <>
                <div className="font-semibold">
                  {rd.coverage.quoted.length} of {rd.coverage.total} lines quoted
                </div>
                <CoverageBar ev={ev} rd={rd} />
                <div className="text-n-700 text-[13px]">
                  {rd.coverage.missing.length === 0 ? "All lines quoted" : `${rd.coverage.missing.length} missing: ${rd.coverage.missing.join(", ")}`}
                </div>
                <div className="mt-[6px]">
                  {rd.status === "incomplete" ? (
                    <span className="text-doubt">Held out of the comparison: {rd.headline}</span>
                  ) : look.size ? (
                    <>Read · <span className="text-doubt">{look.size} line{look.size > 1 ? "s" : ""} need a look ({[...look].join(", ")})</span></>
                  ) : (
                    <>Read · every price checked against the original</>
                  )}
                </div>
                {rd.unsourced > 0 && (
                  <div className="text-doubt text-[13px] mt-[2px]">{rd.unsourced} value(s) not found where the reader said; kept out of the comparison</div>
                )}
                <ul className="text-n-700 text-[13px] mt-[6px] space-y-[2px]">
                  {termLine(rd).map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </>
            ) : (
              <>
                <div className="font-semibold">{{ unreadable: "Unreadable", pending: "Pending: not a quote yet", ignored: "Ignored", error: "Reading stopped" }[rd.status]}</div>
                <div className="mt-[4px]">{rd.headline}</div>
                {rd.nextStep.text && <div className="text-n-700 text-[13px] mt-[6px]">Next: {rd.nextStep.text}</div>}
              </>
            )}
            {st?.notice && <div className="text-[13px] text-n-800 bg-n-100 px-[8px] py-[4px] mt-[8px] rounded-[var(--radius-md)]">{st.notice}</div>}
            <div className="text-[12px] text-n-500 mt-[8px]">
              {rd.status === "error" ? "Not read yet" : `${rd.saved ? "Saved reading, " : "Read live, "}${readStamp(rd)}`}
              {r.origin !== "upload" && <>{" · "}<button className="underline" onClick={() => onRead(true)}>Read again live</button></>}
              {r.origin === "upload" && " · uploaded in this session"}
            </div>
          </>
        ) : null}
      </div>

      <div className="text-[14px]">
        {rd && (rd.status === "read" || rd.status === "incomplete") && (
          <>
            <div className="font-semibold">
              Questionnaire · {quality?.returned && rd.questionnaire.length
                ? `${quality.score} / 100 · ${quality.cleared ? "cleared" : quality.mandatoryFailed ? `${quality.mandatoryFailed} mandatory item${quality.mandatoryFailed > 1 ? "s" : ""} failed` : "below the pass mark"}`
                : rd.questionnaire.length ? `${rd.questionnaire.length} of ${ev.questions.length} answers read` : "not returned"}
            </div>
            {quality?.returned && rd.questionnaire.length > 0 && (
              <details className="text-[12.5px] mt-[2px]">
                <summary className="cursor-pointer text-n-700">How code marked it ({rd.questionnaire.length} of {ev.questions.length} answers read; pass mark {quality.passMark})</summary>
                <ul className="mt-[4px] space-y-[2px]">
                  {quality.items.map((x) => (
                    <li key={x.id} className="grid grid-cols-[30px_44px_1fr] gap-[6px]">
                      <span className="text-n-700">{x.id}</span>
                      <span className={x.mandatory && x.pts === 0 ? "font-semibold text-[var(--color-accent-2-800)]" : ""}>{x.pts} / {x.of}</span>
                      <span className="text-n-700">{x.why}{x.mandatory ? " · mandatory" : ""}</span>
                    </li>
                  ))}
                </ul>
                <Link href={`/events/${ev.id}/rfq?tab=rules`} className="text-[12px]">See the marking scheme</Link>
              </details>
            )}
            <ul className="mt-[4px] space-y-[3px]">
              {docs.map((d, i) => (
                <li key={i} className="flex gap-[6px]">
                  <Paperclip size={15} className="mt-[3px] shrink-0" />
                  <span>
                    {d.kind === "iso_certificate" ? "ISO 9001 certificate" : d.kind === "test_report" ? "Test report" : d.summary}
                    <span className="text-n-700">
                      {d.valid_until ? ` · valid to ${d.valid_until}` : d.date ? ` · ${d.date}` : ""}
                      {d.marked_as_sample ? " · marked sample" : ""}
                    </span>
                  </span>
                </li>
              ))}
              {rd.questionnaire.length === 0 && docs.length === 0 && <li className="text-n-700">No documents attached.</li>}
            </ul>
          </>
        )}
      </div>

      {open && rd && <Detail rd={rd} ev={ev} />}
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
  const th = "text-left font-normal text-n-700 text-[12px] py-[4px] pr-[var(--space-3)] border-b border-rule";
  const td = "py-[4px] pr-[var(--space-3)] align-top border-b border-rule";
  const sorted = [...rd.prices].sort((a, b) => (a.line_id ?? "Z").localeCompare(b.line_id ?? "Z"));
  return (
    <div className="col-span-3 text-[13px] bg-n-100 p-[var(--space-4)] rounded-[var(--radius-md)]">
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
                    <div className="text-n-600 text-[11px]">{ev.lines.find((l) => l.id === p.line_id)?.name}</div>
                  </td>
                  <td className={td}>
                    {p.vendor_wording}
                    <div className="text-n-600 text-[11px]">{p.match_reason}</div>
                  </td>
                  <td className={td}>{p.raw_value_text}</td>
                  <td className={td}>{p.unit_text}</td>
                  <td className={td}>{p.currency}</td>
                  <td className={td}>{p.price_basis.replace("_", "-")}</td>
                  <td className={td}>{where(p.source)}</td>
                  <td className={td}><Check s={p.verification.status} /><div className="text-n-600 text-[11px]">{p.verification.note}</div></td>
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
                  <td className={td}>{r.vendor_wording}{r.pointer && <div className="text-n-600 text-[11px]">pointed to by &ldquo;{r.pointer}&rdquo;</div>}</td>
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
                  <td className={td}>{where(t.source)}<div className="text-n-600 text-[11px]">&ldquo;{t.source.snippet}&rdquo;</div></td>
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
  return (
    <form
      className="mt-[var(--space-4)] flex flex-wrap items-center gap-[12px] text-[14px] p-[var(--space-3)] bg-surface rounded-[var(--radius-md)]"
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
      <span className="font-semibold">Upload a reply</span>
      <input type="file" multiple accept=".xlsx,.docx,.pdf,.jpg,.jpeg,.png,.eml,.txt,.csv" onChange={(e) => setFiles([...(e.target.files ?? [])])} disabled={busy || disabled} />
      <label className="flex items-center gap-[6px]">
        From
        <select className="input" style={{ width: 220, minHeight: 32, padding: "4px 8px" }} value={vendorId} onChange={(e) => setVendorId(e.target.value)} disabled={busy || disabled}>
          <option value="">Work it out (sender or letterhead)</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </label>
      <button className="btn btn-primary" type="submit" disabled={!files.length || busy || disabled}>{busy ? "Reading…" : "Read it"}</button>
      <span className="text-n-700 text-[12px]">Read live by AI, checked by code; it joins the comparison for this session. Up to 4 MB.</span>
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
  if (!changed.length) return "No price differs from the earlier offer.";
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

  return (
    <Shell>
      <ScreenHead meta={`${ev.id} · ${ev.title}`} title="Replies">
        <Link href="/scorecard" style={{ fontSize: 13 }}>How well did Parakh read? See the test scorecard</Link>
      </ScreenHead>
      <p className="text-[15px] max-w-[760px] mt-[6px] text-n-800">
        {data.replies.length} replies in the event inbox, in whatever shape the vendors chose. Each one is read by AI, then every number is
        checked by code against the original file. A value that cannot be found where the reader says never enters the comparison.
        The demo opens with saved readings, each marked with when and by which model it was read; any reply can be read again live.
      </p>
      {!data.keyConfigured && (
        <div className="mt-[var(--space-4)] p-[var(--space-3)] bg-d-100 text-[14px] rounded-[var(--radius-md)]">
          Live reading is off: no Gemini API key is set on the server yet. Saved readings still show.
        </div>
      )}
      {empty && !main.length && !other.length && (
        <div className="mt-[var(--space-4)] p-[var(--space-3)] bg-[var(--color-accent-100)] text-[14px] max-w-[760px]">
          The event is empty (reset from the P menu): the RFQ went to {ev.vendors.length} vendors, and no reply is in yet. Upload a reply below (any format) and watch it read; it joins the comparison as soon as it is done.
          Test replies are in the repository folder <code>test-uploads/</code>, or use the vendors’ original replies from <code>dataset/03_vendor_replies/</code>.
        </div>
      )}
      <Upload vendors={ev.vendors} onUpload={upload} disabled={!data.keyConfigured} />
      {blocked && <div className="mt-[var(--space-4)] p-[var(--space-3)] bg-d-100 text-[14px] rounded-[var(--radius-md)]">{blocked}</div>}
      {data.keyConfigured && done < data.replies.length && (
        <div className="text-[13px] text-n-700 mt-[var(--space-3)]">Reading: {done} of {data.replies.length} done</div>
      )}
      <div className="mt-[var(--space-6)]">
        {main.map((r) => <Row key={r.id} r={r} st={state[r.id]} ev={ev} onRead={(fresh) => readOne(r.id, fresh)} impact={revisionImpact(data, state, r.id)} quality={qualityFor(r.id)} />)}
      </div>
      {other.length > 0 && (
        <>
          <h2 className="text-[22px] mt-[var(--space-8)]">Not in the comparison</h2>
          <p className="text-[14px] text-n-700 mb-[var(--space-3)]">Messages that are not quotes, or could not be read. Each has a next step.</p>
          {other.map((r) => <Row key={r.id} r={r} st={state[r.id]} ev={ev} onRead={(fresh) => readOne(r.id, fresh)} />)}
        </>
      )}
    </Shell>
  );
}
