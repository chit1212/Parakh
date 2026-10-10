"use client";
// L0 RFQ co-pilot (design: Shared Screens #rfq). Chat on the left turns the buyer's words into edits;
// the draft RFQ on the right stays directly editable. Kept light: the demo RFQ was sent on its issue date.
import { useEffect, useMemo, useState } from "react";
import { LockSimple, PaperPlaneRight, Plus, X } from "@phosphor-icons/react";
import { tabStyle } from "@/components/ui";
import { Rail } from "@/components/Rail";
import { useReadings } from "@/components/useReadings";
import type { DraftRfq, Edit } from "@/lib/rfqDraft";
import { EvaluationRules, FIXED_RULES } from "@/components/EvaluationRules";
import { useScheme } from "@/components/useScheme";
import { buildGrid } from "@/lib/compare";
import { findDoubts } from "@/lib/doubts";
import { qualityOf } from "@/lib/quality";
import type { ReplyReading } from "@/lib/reader/pipeline";
import { mainFile } from "@/lib/summary";
import { fileName, RfqSend, type RfqVendor, type Sent } from "@/components/RfqSend";

type Line = DraftRfq["lines"][number] & { tag?: string };
type Draft = Omit<DraftRfq, "lines"> & {
  lines: Line[]; from: string;
  /** The buyer's own RFQ: its reference, title, reply-by date, vendor list and what was sent. */
  refId?: string; title?: string; due?: string; vendors?: RfqVendor[]; sent?: Record<string, Sent>;
};
const KEY = "parakh.rfq.v1";
const label11 = { fontSize: 14, color: "var(--color-neutral-700)" };
const KEEP = 3;
const COLS = "44px minmax(200px,1.4fr) minmax(160px,1fr) minmax(220px,1.6fr) 80px 30px";
const inp: React.CSSProperties = { minHeight: 38, padding: "4px 10px", fontSize: 15, background: "var(--color-bg)" };

export default function RfqPage() {
  const { data, state } = useReadings();
  const [scheme] = useScheme();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState<"lines" | "q" | "t" | "r" | "s">("lines");
  const [newQ, setNewQ] = useState({ text: "", type: "Scored" });
  useEffect(() => { if (new URLSearchParams(window.location.search).get("tab") === "rules") setTab("r"); }, []);
  // The event as read, for the evaluation rules' "used by" counts and the effect of a marking change.
  const readings = useMemo(() => (data ? data.replies.map((r) => state[r.id]?.reading).filter((r): r is ReplyReading => Boolean(r && r.status !== "error")) : []), [data, state]);
  const grid = useMemo(() => {
    if (!data) return null;
    const files = Object.fromEntries(data.replies.map((r) => [r.id, mainFile(r, state[r.id]?.reading ?? null) ?? undefined]));
    return buildGrid(data.event, readings, { sheets: data.historySheets }, files, data.lastYear);
  }, [data, readings, state]);
  const report = useMemo(() => (data && grid ? findDoubts(data.event, grid, data.event.vendors.map((v) => qualityOf(data.event, v.id, readings, scheme)).filter((q) => q.cleared).map((q) => q.vendorId)) : null), [data, grid, readings, scheme]);
  const [msgs, setMsgs] = useState<{ role: "user" | "assistant"; text: string; model?: string }[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false);

  const fresh = (): Draft | null => data && {
    from: `the RFQ issued ${data.event.issued}`,
    refId: data.event.id, title: data.event.title, due: data.event.due, sent: {},
    vendors: data.event.vendors.map((v) => ({ name: v.name, contact: v.contact, email: v.email })),
    lines: data.event.lines.map((l) => ({ id: l.id, name: l.name, size: l.size, spec: l.spec, qty: l.qty })),
    questions: data.event.questions.map((x) => ({ ...x })),
    terms: { ...data.event.terms },
  };
  useEffect(() => {
    if (!data || draft) return;
    try { const s = localStorage.getItem(KEY); if (s) return setDraft(JSON.parse(s)); } catch { /* none */ }
    setDraft(fresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  // A blank RFQ: no lines yet, the company's two mandatory quality questions and standard terms.
  const blank = (): Draft | null => data && {
    from: "a blank RFQ", refId: `DRAFT-${new Date().toISOString().slice(5, 10).replace("-", "")}`, title: "", due: "", sent: {},
    lines: [], questions: data.event.questions.filter((x) => x.type === "Mandatory").map((x) => ({ ...x })), terms: { ...data.event.terms },
    vendors: data.event.vendors.map((v) => ({ name: v.name, contact: v.contact, email: v.email })),
  };
  const save = (d: Draft) => { setDraft(d); try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* blocked */ } };

  const cloneLastYear = () => {
    if (!data) return;
    const award = data.historySheets.find((s) => /award/i.test(s.name)) ?? data.historySheets[0];
    const rows = new Map<number, Record<number, string>>();
    for (const c of award.cells) rows.set(c.row, { ...(rows.get(c.row) ?? {}), [c.col]: c.text });
    const lines: Line[] = [...rows.values()].filter((r) => /^L\d{2}$/.test(r[1] ?? "")).map((r) => ({ id: r[1], name: r[2] ?? "", size: "", spec: r[3] ?? "", qty: null, tag: "from SE-2025-037" }));
    save({ ...fresh()!, lines, from: `last year's event SE-2025-037 (${lines.length} lines; sizes and quantities to fill in)` });
  };

  const apply = (d: Draft, edits: Edit[]): Draft => {
    let lines = [...d.lines];
    const questions = [...d.questions];
    const terms = { ...d.terms };
    for (const e of edits) {
      if (e.op === "update_line") lines = lines.map((l) => (l.id === e.lineId ? { ...l, [e.field]: e.field === "qty" ? Number(String(e.value).replace(/[^\d]/g, "")) || null : e.value, tag: "changed by chat" } : l));
      else if (e.op === "add_line") {
        const n = Math.max(0, ...lines.map((l) => Number(l.id.slice(1)) || 0)) + 1;
        lines.push({ id: `L${String(n).padStart(2, "0")}`, name: e.name, size: e.size, spec: e.spec, qty: e.qty ?? null, tag: "new SKU" });
      } else if (e.op === "remove_line") lines = lines.filter((l) => l.id !== e.lineId);
      else if (e.op === "add_question") questions.push({ id: `Q${questions.length + 1}`, text: e.text, type: e.type });
      else if (e.op === "update_term") terms[e.key] = e.value;
    }
    return { ...d, lines, questions, terms };
  };

  const send = async (text: string) => {
    if (!draft) return;
    const history = msgs.map((m) => ({ role: m.role, text: m.text }));
    setMsgs((m) => [...m, { role: "user", text }]);
    setQ("");
    setBusy(true);
    try {
      const r = await fetch("/api/rfq", { method: "POST", body: JSON.stringify({ draft, message: text, history }) });
      const j = await r.json();
      if (j.error) setMsgs((m) => [...m, { role: "assistant", text: j.error }]);
      else {
        save(apply(draft, j.edits));
        setMsgs((m) => [...m, { role: "assistant", text: j.reply, model: j.model }]);
      }
    } catch {
      setMsgs((m) => [...m, { role: "assistant", text: "Something went wrong. Nothing was changed; try again in a minute." }]);
    } finally {
      setBusy(false);
    }
  };

  const tabS = tabStyle;
  const hidden = all ? 0 : Math.max(0, msgs.length - KEEP);
  const ev = data?.event;
  const refId = draft?.refId ?? ev?.id ?? "";
  const title = draft?.title ?? ev?.title ?? "";
  const due = draft?.due ?? ev?.due ?? "";
  const vendors = draft?.vendors ?? ev?.vendors.map((v) => ({ name: v.name, contact: v.contact, email: v.email })) ?? [];
  const sentN = vendors.filter((v) => draft?.sent?.[v.email]).length;
  const downloadRfq = async () => {
    if (!draft || !ev) return;
    const r = await fetch("/api/rfq/export", { method: "POST", body: JSON.stringify({ draft, title, ref: refId, due, buyer: `${ev.buyer}, ${ev.buyerCo}` }) });
    if (!r.ok) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await r.blob());
    a.download = fileName(refId);
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div style={{ display: "flex", height: "100vh", minWidth: 1360, fontSize: 16, lineHeight: 1.45 }}>
      <Rail />
      <section style={{ width: 380, flex: "none", background: "var(--color-surface)", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, overflow: "auto", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
          <span style={label11}>RFQ co-pilot</span>
          {hidden > 0 ? (
            <button className="btn btn-ghost" style={{ alignSelf: "flex-start", fontSize: 15, color: "var(--color-accent-700)", padding: "2px 0" }} onClick={() => setAll(true)}>Show {hidden + 1} earlier messages</button>
          ) : <div><span style={{ ...label11, color: "var(--color-accent-700)" }}>Parakh</span>
            <p style={{ margin: "4px 0 0", fontSize: 16 }}>This draft starts from {draft?.from ?? "the RFQ"}. Tell me what to add or change, e.g. “make L14 5-ply BC”, “add an air fryer master carton, 400 x 300 x 350 mm, 5-ply BC, 8,000 boxes”, or “ask for FSC certification”. You can also edit any field directly.</p>
          </div>}
          {msgs.map((m, i) => i < hidden ? null : m.role === "user" ? (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <span style={label11}>{ev?.buyer ?? "Buyer"}</span>
              <p style={{ margin: 0, fontSize: 16, fontStyle: "italic", textAlign: "right" }}>{m.text}</p>
            </div>
          ) : (
            <div key={i}><span style={{ ...label11, color: "var(--color-accent-700)" }}>Parakh{m.model ? <span style={{ color: "var(--color-neutral-500)", textTransform: "none", letterSpacing: 0 }}> · {m.model}</span> : null}</span><p style={{ margin: "4px 0 0", fontSize: 16 }}>{m.text}</p></div>
          ))}
          {busy && <p style={{ margin: 0, color: "var(--color-neutral-700)" }}>Working on the draft…</p>}
        </div>
        <form style={{ padding: "12px 24px 18px", display: "flex", gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (q.trim() && !busy) send(q.trim()); }}>
          <textarea className="input" style={{ minHeight: 56, background: "var(--color-bg)" }} placeholder="Tell Parakh what to change, or edit the draft directly" value={q}
            onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (q.trim() && !busy) send(q.trim()); } }} />
          <button className="btn btn-primary btn-icon" type="submit" disabled={busy || !q.trim()} style={{ alignSelf: "flex-end" }} title="Send"><PaperPlaneRight size={18} weight="duotone" /></button>
        </form>
      </section>
      <section style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "20px 32px 32px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
        {!draft || !ev ? <span style={{ color: "var(--color-neutral-700)" }}>Loading the RFQ…</span> : (
          <>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: "1 0 100%" }}>
                <span style={{ fontSize: 15, color: "var(--color-neutral-700)", whiteSpace: "nowrap" }}>Draft RFQ · {refId} · saved in this browser{refId !== ev.id ? " · separate from the demo comparison" : ""}</span>
                <input aria-label="RFQ title" value={title} placeholder="Name this RFQ, e.g. Corrugated boxes, FY28 H1" onChange={(e) => save({ ...draft, title: e.target.value })}
                  style={{ fontSize: 30, fontWeight: 600, lineHeight: 1.15, fontFamily: "inherit", border: 0, borderBottom: "1px dashed var(--color-divider)", background: "transparent", padding: "0 0 2px", color: "var(--color-text)", width: "100%" }} />
              </div>
              <span style={{ flex: 1 }} />
              <button className="btn btn-secondary" style={{ whiteSpace: "nowrap" }} onClick={() => { save(fresh()!); setTab("lines"); }}>Start from the issued RFQ</button>
              <button className="btn btn-secondary" style={{ whiteSpace: "nowrap" }} onClick={() => { save(blank()!); setMsgs([]); setTab("lines"); }}>Start a blank RFQ</button>
              <button className="btn btn-secondary" style={{ whiteSpace: "nowrap" }} onClick={cloneLastYear}>Clone SE-2025-037</button>
              <button className="btn btn-primary" style={{ whiteSpace: "nowrap" }} onClick={() => setTab("s")}><PaperPlaneRight size={16} weight="duotone" />{sentN ? `Sent to ${sentN} of ${vendors.length}` : "Send to vendors"}</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 14 }}>
              {[["Deliver to", ev.plant], ["Price basis asked", draft.terms["Price basis"] ?? ev.basis], ["Contract period", "Oct 2026 – Mar 2027"]].map(([k, v]) => (
                <label key={k} style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>{k}</span><input className="input" style={{ minHeight: 42, fontSize: 15 }} defaultValue={v} /></label>
              ))}
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>Replies due</span>
                <input className="input" style={{ minHeight: 42, fontSize: 15 }} value={due} placeholder="e.g. 20 Oct 2026" onChange={(e) => save({ ...draft, due: e.target.value })} /></label>
            </div>
            <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
              <button style={tabS(tab === "lines")} onClick={() => setTab("lines")}>Lines {draft.lines.length}</button>
              <button style={tabS(tab === "q")} onClick={() => setTab("q")}>Quality questions {draft.questions.length}</button>
              <button style={tabS(tab === "t")} onClick={() => setTab("t")}>Terms</button>
              <button style={tabS(tab === "s")} onClick={() => setTab("s")}>Send · {vendors.length} vendor{vendors.length === 1 ? "" : "s"}</button>
              {/* The evaluation rules fold into one pill; the full tab is behind "Edit". */}
              <button onClick={() => setTab("r")} title="Evaluation rules for this event" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, border: 0, font: "inherit", fontSize: 15, padding: "6px 14px", borderRadius: 999, cursor: "pointer",
                background: tab === "r" ? "var(--color-accent-200)" : "var(--color-neutral-100)", boxShadow: tab === "r" ? "none" : "var(--shadow-sm)", color: "var(--color-text)", whiteSpace: "nowrap" }}>
                <LockSimple size={16} weight="duotone" />Rules · {FIXED_RULES} · lock when sent <span style={{ color: "var(--color-accent-700)", fontWeight: 600 }}>Edit</span>
              </button>
            </div>
            <div className="sheet" style={{ padding: "16px 20px" }}>
            {tab === "lines" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: COLS, gap: "0 8px", fontSize: 14, fontWeight: 600, color: "var(--color-neutral-800)", paddingBottom: 8, boxShadow: "inset 0 -2px 0 var(--color-text)" }}>
                  <span>Line</span><span>Box</span><span>Size</span><span>Board and print</span><span style={{ textAlign: "right" }}>Qty</span><span />
                </div>
                {draft.lines.map((l, i) => (
                  <div key={l.id} style={{ display: "grid", gridTemplateColumns: COLS, gap: "0 8px", alignItems: "center", padding: "6px 0", boxShadow: "inset 0 -1px 0 var(--color-neutral-300)", background: l.tag === "changed by chat" || l.tag === "new SKU" ? "var(--color-accent-100)" : undefined }}>
                    <span style={{ color: "var(--color-neutral-700)", display: "flex", flexDirection: "column", lineHeight: 1.15 }}>{l.id}{l.tag && <span style={{ fontSize: 13, color: "var(--color-accent-800)" }}>{l.tag}</span>}</span>
                    {(["name", "size", "spec"] as const).map((f) => (
                      <input key={f} className="input" style={inp} value={l[f]} onChange={(e) => save({ ...draft, lines: draft.lines.map((x, j) => (j === i ? { ...x, [f]: e.target.value } : x)) })} />
                    ))}
                    <input className="input" style={{ ...inp, textAlign: "right" }} value={l.qty ?? ""} onChange={(e) => save({ ...draft, lines: draft.lines.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value.replace(/[^\d]/g, "")) || null } : x)) })} />
                    <button className="btn btn-ghost btn-icon" title={`Remove ${l.id}`} onClick={() => save({ ...draft, lines: draft.lines.filter((_, j) => j !== i) })}><X size={14} weight="duotone" /></button>
                  </div>
                ))}
                {!draft.lines.length && <p style={{ color: "var(--color-neutral-700)" }}>No lines yet. Add one below, or tell the co-pilot, e.g. “add a steam iron unit carton, 280 x 140 x 150 mm, 3-ply E, 4-colour print, 50,000 boxes”.</p>}
                <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={() => {
                  const n = Math.max(0, ...draft.lines.map((l) => Number(l.id.slice(1)) || 0)) + 1;
                  save({ ...draft, lines: [...draft.lines, { id: `L${String(n).padStart(2, "0")}`, name: "", size: "", spec: "", qty: null, tag: "new SKU" }] });
                }}><Plus size={14} weight="duotone" />Add line</button>
              </div>
            )}
            {tab === "q" && (
              <div>
                {draft.questions.map((x, i) => (
                  <div key={x.id + i} style={{ display: "grid", gridTemplateColumns: "30px minmax(0,1fr) 120px 30px", gap: 12, alignItems: "center", padding: "8px 0", borderBottom: "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)" }}>
                    <span style={{ color: "var(--color-neutral-700)" }}>{x.id}</span>
                    <input className="input" style={{ minHeight: 38, background: "var(--color-bg)" }} value={x.text} onChange={(e) => save({ ...draft, questions: draft.questions.map((y, j) => (j === i ? { ...y, text: e.target.value } : y)) })} />
                    <span style={{ color: x.type === "Mandatory" ? "var(--color-accent-2-800)" : undefined, fontWeight: x.type === "Mandatory" ? 600 : 400 }}>{x.type}</span>
                    <button className="btn btn-ghost btn-icon" title={`Remove ${x.id}`} onClick={() => save({ ...draft, questions: draft.questions.filter((_, j) => j !== i).map((y, j) => ({ ...y, id: `Q${j + 1}` })) })}><X size={14} weight="duotone" /></button>
                  </div>
                ))}
                <form onSubmit={(e) => { e.preventDefault(); if (newQ.text.trim()) { save({ ...draft, questions: [...draft.questions, { id: `Q${draft.questions.length + 1}`, text: newQ.text.trim(), type: newQ.type }] }); setNewQ({ text: "", type: newQ.type }); } }}
                  style={{ display: "grid", gridTemplateColumns: "30px minmax(0,1fr) 120px 140px", gap: 12, alignItems: "center", paddingTop: 10 }}>
                  <span style={{ color: "var(--color-neutral-700)" }}>Q{draft.questions.length + 1}</span>
                  <input className="input" placeholder="New question, e.g. FSC chain-of-custody certificate" value={newQ.text} onChange={(e) => setNewQ({ ...newQ, text: e.target.value })} />
                  <select className="input" value={newQ.type} onChange={(e) => setNewQ({ ...newQ, type: e.target.value })} style={{ minHeight: 34 }}><option>Scored</option><option>Mandatory</option></select>
                  <button className="btn btn-secondary" type="submit" disabled={!newQ.text.trim()}><Plus size={14} weight="duotone" />Add question</button>
                </form>
                {refId === ev.id && <p style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>The quality score for this event is marked on the Evaluation rules tab. Questions you add here go out with your RFQ; marking them is not part of this demo yet.</p>}
              </div>
            )}
            {tab === "s" && (
              <RfqSend draft={draft} vendors={vendors} setVendors={(v) => save({ ...draft, vendors: v })} sent={draft.sent ?? {}} setSent={(x) => save({ ...draft, sent: x })}
                refId={refId} title={title} due={due} people={{ company: ev.buyerCo, plant: ev.plant, buyer: ev.buyer, buyerRole: ev.buyerRole }} onDownload={downloadRfq} />
            )}
            {tab === "r" && grid && report && <EvaluationRules ev={ev} grid={grid} readings={readings} report={report} />}
            {tab === "t" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 14, maxWidth: 900 }}>
                {Object.entries(draft.terms).map(([k, v]) => (
                  <label key={k} style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>{k}</span>
                    <input className="input" value={v} onChange={(e) => save({ ...draft, terms: { ...draft.terms, [k]: e.target.value } })} /></label>
                ))}
              </div>
            )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
