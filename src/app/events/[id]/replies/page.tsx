"use client";
import { useState } from "react";
import { Camera, Envelope, File, FileDoc, FilePdf, FileXls, Paperclip, UploadSimple, Warning } from "@phosphor-icons/react";
import { Kpis } from "@/components/ui";
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
  const quoted = rd.coverage.quoted.length;
  return (
    <div aria-label={`${quoted} of ${ev.lines.length} lines quoted`} title={look.size ? `${look.size} need a look: ${[...look].join(", ")}` : undefined}
      style={{ display: "flex", height: 6, background: "var(--color-neutral-300)", borderRadius: 3, overflow: "hidden", margin: "6px 0", maxWidth: 220 }}>
      <span style={{ width: `${(100 * (quoted - look.size)) / ev.lines.length}%`, background: "var(--color-accent)" }} />
      <span style={{ width: `${(100 * look.size) / ev.lines.length}%`, background: "var(--color-accent-2)" }} />
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

  const sub = "text-[14px] text-n-700";
  const qTag = !rd || !(rd.status === "read" || rd.status === "incomplete") ? null
    : quality?.returned ? <span className={quality.cleared ? "tag tag-accent" : "tag tag-accent-2"}>{quality.score} · {quality.cleared ? "cleared" : quality.mandatoryFailed ? `${quality.mandatoryFailed} mandatory failed` : "below pass mark"}</span>
    : <span className="tag tag-neutral">{rd.questionnaire.length ? `${rd.questionnaire.length} of ${ev.questions.length} answers` : "not returned"}</span>;

  return (
    <section className="hover-row grid grid-cols-[1.3fr_0.8fr_1.1fr_1fr_1fr] gap-[20px] px-[12px] py-[14px] text-[15px]" style={{ boxShadow: "inset 0 -1px 0 var(--color-neutral-300)", minHeight: 72 }}>
      <div>
        <h2 className="text-[17px] font-semibold leading-tight m-0">{name}</h2>
        <div className={sub + " mt-[2px]"}>
          Received {when(r.receivedAt)}
          {r.contact ? ` · ${r.contact}` : r.from ? ` · ${r.from}` : " · no sender (arrived without an email)"}
        </div>
        {rd?.revision?.is_revision && <div className="text-[14px] text-a-700 mt-[4px]">Revised offer{rd.revision.supersedes ? `: supersedes ${rd.revision.supersedes}` : ""}</div>}
        {impact && <div className="text-[14px] text-n-800 mt-[2px]">{impact}</div>}
      </div>

      <div>
        {f ? <div className="flex items-center gap-[6px]"><Icon size={20} weight="duotone" /> {KIND_LABEL[f.kind] ?? f.kind}</div> : <div>No file</div>}
        {f && <div className={sub + " break-all"}>{f.name}</div>}
        <div className={sub}>
          {r.files.length > 1 ? `+ ${r.files.length - 1} attachment${r.files.length > 2 ? "s" : ""}` : ""}
          {r.cover && r.files.length ? `${r.files.length > 1 ? ", " : ""}cover email` : ""}
        </div>
      </div>

      <div>
        {reading ? (
          <div>
            <div className="font-semibold">{STAGE_LABEL[st.stage] ?? st.stage}</div>
            {st.detail && <div className={sub}>{st.detail}</div>}
            <div className="h-[6px] bg-n-300 mt-[8px] rounded-[3px] overflow-hidden" style={{ maxWidth: 220 }}>
              <div className="h-[6px] bg-accent transition-all duration-500" style={{ width: `${(100 * (STAGE_STEP[st.stage] ?? 0)) / 6}%` }} />
            </div>
          </div>
        ) : st?.error ? (
          <div className="text-d-700">Could not read: {st.error}</div>
        ) : rd ? (
          rd.status === "read" || rd.status === "incomplete" ? (
            <>
              <div><b className="text-[17px]">{rd.coverage.quoted.length} of {rd.coverage.total}</b> <span className="text-n-700">lines priced</span></div>
              <CoverageBar ev={ev} rd={rd} />
              <div className={sub}>
                {rd.coverage.missing.length === 0 ? "All lines quoted" : `Missing ${rd.coverage.missing.join(", ")}`}
              </div>
              <div className="text-[14px] mt-[4px]">
                {rd.status === "incomplete" ? (
                  <span className="text-doubt">Held out of the comparison: {rd.headline}</span>
                ) : look.size ? (
                  <span className="text-doubt">{look.size} line{look.size > 1 ? "s" : ""} need a look ({[...look].join(", ")})</span>
                ) : (
                  <span className="text-n-800">Every price checked against the original</span>
                )}
              </div>
              {rd.unsourced > 0 && (
                <div className="text-doubt text-[14px] mt-[2px]">{rd.unsourced} value(s) not found where the reader said; kept out of the comparison</div>
              )}
              <ul className={sub + " mt-[6px] space-y-[2px]"}>
                {termLine(rd).map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </>
          ) : (
            <>
              <div className="font-semibold">{{ unreadable: "Unreadable", pending: "Pending: not a quote yet", ignored: "Ignored", error: "Reading stopped" }[rd.status]}</div>
              <div className="mt-[4px] text-[14px]">{rd.headline}</div>
              {rd.nextStep.text && <div className={sub + " mt-[6px]"}>Next: {rd.nextStep.text}</div>}
            </>
          )
        ) : null}
      </div>

      <div>
        {qTag}
        {rd && (rd.status === "read" || rd.status === "incomplete") && (
          <>
            {quality?.returned && !rd.questionnaire.length && <div className={sub + " mt-[4px]"}>Answers in another reply from this vendor</div>}
            {quality?.returned && rd.questionnaire.length > 0 && (
              <details className="text-[14px] mt-[4px]">
                <summary className="cursor-pointer text-a-700">How code marked it</summary>
                <div className={sub + " mt-[2px]"}>{rd.questionnaire.length} of {ev.questions.length} answers read; pass mark {quality.passMark}</div>
                <ul className="mt-[4px] space-y-[2px]">
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
            <ul className="mt-[6px] space-y-[3px] text-[14px]">
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

      <div className="flex flex-col gap-[4px] text-[15px]">
        {f && <a href={`/api/file?path=${encodeURIComponent(f.path)}`} target="_blank" rel="noreferrer">Open original</a>}
        {rd && (rd.prices.length > 0 || rd.terms.length > 0) && (
          <button className="text-a-700 text-left" onClick={() => setOpen(!open)}>
            {open ? "Hide what was read" : "See what was read"}
          </button>
        )}
        {st?.notice && <div className="text-[14px] text-n-800 bg-[var(--color-bg)] px-[8px] py-[4px] rounded-[var(--radius-md)]">{st.notice}</div>}
        {rd && !reading && (
          <div className={sub}>
            {rd.status === "error" ? "Not read yet" : `${rd.saved ? "Saved reading, " : "Read live, "}${readStamp(rd)}`}
            {r.origin !== "upload" && <>{" · "}<button className="text-a-700" onClick={() => onRead(true)}>Read again live</button></>}
            {r.origin === "upload" && " · uploaded in this session"}
          </div>
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
  const th = "text-left font-semibold text-n-800 text-[14px] py-[4px] pr-[var(--space-3)] border-b border-rule";
  const td = "py-[4px] pr-[var(--space-3)] align-top border-b border-rule";
  const sorted = [...rd.prices].sort((a, b) => (a.line_id ?? "Z").localeCompare(b.line_id ?? "Z"));
  return (
    <div className="col-span-5 text-[14px] bg-[var(--color-bg)] p-[var(--space-4)] rounded-[var(--radius-lg)]">
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
  return (
    <form
      className="sheet flex flex-wrap items-center gap-[12px] text-[15px]" style={{ padding: "12px 16px" }}
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
      <UploadSimple size={22} weight="duotone" />
      <span className="font-semibold">Upload a reply</span>
      <input type="file" multiple accept=".xlsx,.docx,.pdf,.jpg,.jpeg,.png,.eml,.txt,.csv" onChange={(e) => setFiles([...(e.target.files ?? [])])} disabled={busy || disabled} />
      <label className="flex items-center gap-[6px]">
        From
        <select className="input" style={{ width: 240, minHeight: 36, padding: "4px 8px", background: "var(--color-bg)" }} value={vendorId} onChange={(e) => setVendorId(e.target.value)} disabled={busy || disabled}>
          <option value="">Work it out from the file</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </label>
      <button className="btn btn-primary" type="submit" disabled={!files.length || busy || disabled}>{busy ? "Reading…" : "Read it"}</button>
      <span className="text-n-700 text-[14px] ml-auto">Up to 4 MB · joins this session’s comparison</span>
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
  const unsourced = quotes.reduce((a, x) => a + x.unsourced, 0);
  const lookLines = quotes.reduce((a, x) => a + needsLook(x).size, 0);
  const toAnswer = other.filter((r) => state[r.id]?.reading?.nextStep.text && state[r.id]?.reading?.status !== "ignored").length;

  return (
    <Shell>
      <div className="flex flex-col gap-[16px]" style={{ maxWidth: 1240 }}>
      <ScreenHead meta={`${ev.id} · ${ev.title}`} title="Replies">
        <Link href="/scorecard" style={{ fontSize: 15 }}>How well did Parakh read? Scorecard</Link>
      </ScreenHead>
      <p className="text-[16px] m-0 text-n-800">Read by AI, every number checked by code against the original file.</p>
      {!data.keyConfigured && (
        <div className="p-[var(--space-3)] bg-d-100 text-[15px] rounded-[var(--radius-md)]">
          Live reading is off: no Gemini API key is set on the server yet. Saved readings still show.
        </div>
      )}
      {empty && !main.length && !other.length && (
        <div className="p-[var(--space-3)] bg-[var(--color-accent-100)] text-[15px] max-w-[860px]">
          The event is empty (reset from the P menu): the RFQ went to {ev.vendors.length} vendors, and no reply is in yet. Upload a reply below (any format) and watch it read; it joins the comparison as soon as it is done.
          Test replies are in the repository folder <code>test-uploads/</code>, or use the vendors’ original replies from <code>dataset/03_vendor_replies/</code>.
        </div>
      )}
      <Upload vendors={ev.vendors} onUpload={upload} disabled={!data.keyConfigured} />
      {blocked && <div className="p-[var(--space-3)] bg-d-100 text-[15px] rounded-[var(--radius-md)]">{blocked}</div>}
      <Kpis items={[
        { label: "Replied", value: `${replied} of ${ev.vendors.length}`, sub: `${data.replies.length} messages in the inbox${other.length ? `, ${other.length} not quotes` : ""}` },
        { label: "Prices read", value: `${priced} of ${ev.vendors.length * ev.lines.length}`, sub: unsourced ? `${unsourced} not found in the file, kept out` : "every one traced to its source" },
        { label: "Need you", value: lookLines + toAnswer, doubt: lookLines + toAnswer > 0, sub: `${lookLines} line${lookLines === 1 ? "" : "s"} to look at · ${toAnswer} message${toAnswer === 1 ? "" : "s"} to answer` },
      ]} />
      {data.keyConfigured && done < data.replies.length && (
        <div className="text-[15px] text-n-700">Reading: {done} of {data.replies.length} done</div>
      )}
      <div className="sheet" style={{ padding: "6px 8px" }}>
        <div className="grid grid-cols-[1.3fr_0.8fr_1.1fr_1fr_1fr] gap-[20px] px-[12px] py-[8px] text-[14px] font-semibold text-n-800" style={{ boxShadow: "inset 0 -2px 0 var(--color-text)" }}>
          <span>Vendor</span><span>Sent as</span><span>Lines priced</span><span>Quality</span><span>Reply</span>
        </div>
        {!main.length && <div className="px-[12px] py-[20px] text-n-700">No quotes in yet.</div>}
        {main.map((r) => <Row key={r.id} r={r} st={state[r.id]} ev={ev} onRead={(fresh) => readOne(r.id, fresh)} impact={revisionImpact(data, state, r.id)} quality={qualityFor(r.id)} />)}
      </div>
      {other.length > 0 && (
        <>
          <div>
            <h2 className="text-[22px] m-0">Not in the comparison</h2>
            <p className="text-[15px] text-n-700 m-0">Messages that are not quotes, or could not be read. Each has a next step.</p>
          </div>
          <div className="sheet" style={{ padding: "6px 8px" }}>
            {other.map((r) => <Row key={r.id} r={r} st={state[r.id]} ev={ev} onRead={(fresh) => readOne(r.id, fresh)} />)}
          </div>
        </>
      )}
      </div>
    </Shell>
  );
}
