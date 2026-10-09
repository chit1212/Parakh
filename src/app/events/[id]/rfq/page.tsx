"use client";
// L0 RFQ co-pilot (design: Shared Screens #rfq). Chat on the left turns the buyer's words into edits;
// the draft RFQ on the right stays directly editable. Kept light: the demo RFQ was sent on its issue date.
import { useEffect, useMemo, useState } from "react";
import { PaperPlaneRight } from "@phosphor-icons/react";
import { Rail } from "@/components/Rail";
import { useReadings } from "@/components/useReadings";
import type { DraftRfq, Edit } from "@/lib/rfqDraft";
import { EvaluationRules } from "@/components/EvaluationRules";
import { useScheme } from "@/components/useScheme";
import { buildGrid } from "@/lib/compare";
import { findDoubts } from "@/lib/doubts";
import { qualityOf } from "@/lib/quality";
import type { ReplyReading } from "@/lib/reader/pipeline";
import { mainFile } from "@/lib/summary";

type Line = DraftRfq["lines"][number] & { tag?: string };
type Draft = Omit<DraftRfq, "lines"> & { lines: Line[]; from: string };
const KEY = "parakh.rfq.v1";
const label11 = { fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--color-neutral-700)" };
const COLS = "44px minmax(200px,1.4fr) minmax(160px,1fr) minmax(220px,1.6fr) 80px";
const inp: React.CSSProperties = { minHeight: 30, padding: "3px 8px", fontSize: 13 };

export default function RfqPage() {
  const { data, state } = useReadings();
  const [scheme] = useScheme();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState<"lines" | "q" | "t" | "r">("lines");
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

  const fresh = (): Draft | null => data && {
    from: `the RFQ issued ${data.event.issued}`,
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

  const tabS = (on: boolean): React.CSSProperties => ({ whiteSpace: "nowrap", background: "none", border: 0, padding: "4px 0", font: "inherit", fontSize: 14, color: on ? "var(--color-text)" : "var(--color-neutral-700)", fontWeight: on ? 600 : 400, boxShadow: on ? "inset 0 -2px 0 var(--color-text)" : "none" });
  const ev = data?.event;
  return (
    <div style={{ display: "flex", height: "100vh", minWidth: 1360, fontSize: 13, lineHeight: 1.45 }}>
      <Rail />
      <section style={{ width: 430, flex: "none", background: "var(--color-surface)", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, overflow: "auto", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
          <span style={label11}>RFQ co-pilot</span>
          <div><span style={{ ...label11, color: "var(--color-accent-700)" }}>Parakh</span>
            <p style={{ margin: "4px 0 0", fontSize: 14 }}>This draft starts from {draft?.from ?? "the RFQ"}. Tell me what to change, e.g. “make L14 5-ply BC”, “add an air fryer master carton, 400 x 300 x 350 mm, 5-ply BC, 8,000 boxes”, or “ask for FSC certification”. You can also edit any field directly.</p>
          </div>
          {msgs.map((m, i) => m.role === "user" ? (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <span style={label11}>{ev?.buyer ?? "Buyer"}</span>
              <p style={{ margin: 0, fontSize: 14, fontStyle: "italic", textAlign: "right" }}>{m.text}</p>
            </div>
          ) : (
            <div key={i}><span style={{ ...label11, color: "var(--color-accent-700)" }}>Parakh{m.model ? <span style={{ color: "var(--color-neutral-500)", textTransform: "none", letterSpacing: 0 }}> · {m.model}</span> : null}</span><p style={{ margin: "4px 0 0", fontSize: 14 }}>{m.text}</p></div>
          ))}
          {busy && <p style={{ margin: 0, color: "var(--color-neutral-700)" }}>Working on the draft…</p>}
        </div>
        <form style={{ padding: "12px 24px 18px", display: "flex", gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (q.trim() && !busy) send(q.trim()); }}>
          <textarea className="input" style={{ minHeight: 56, background: "var(--color-bg)" }} placeholder="Tell Parakh what to change, or edit the draft directly" value={q}
            onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (q.trim() && !busy) send(q.trim()); } }} />
          <button className="btn btn-primary btn-icon" type="submit" disabled={busy || !q.trim()} style={{ alignSelf: "flex-end" }} title="Send"><PaperPlaneRight size={18} weight="duotone" /></button>
        </form>
      </section>
      <section style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "18px 32px 32px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
        {!draft || !ev ? <span style={{ color: "var(--color-neutral-700)" }}>Loading the RFQ…</span> : (
          <>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
              <div style={{ marginRight: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ ...label11, whiteSpace: "nowrap" }}>Draft RFQ · {ev.id} · saved in this browser</span>
                <h1 style={{ fontSize: 26, margin: 0 }}>{ev.title}</h1>
              </div>
              <button className="btn btn-secondary" style={{ whiteSpace: "nowrap" }} onClick={() => save(fresh()!)}>Start from the issued RFQ</button>
              <button className="btn btn-secondary" style={{ whiteSpace: "nowrap" }} onClick={cloneLastYear}>Clone SE-2025-037</button>
              <button className="btn btn-primary" style={{ whiteSpace: "nowrap" }} disabled title={`Sent to ${ev.vendors.length} vendors on ${ev.issued}; sending is stubbed in this demo`}>Sent to {ev.vendors.length} vendors</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 14 }}>
              {[["Deliver to", ev.plant], ["Replies due", ev.due], ["Price basis asked", draft.terms["Price basis"] ?? ev.basis], ["Contract period", "Oct 2026 – Mar 2027"]].map(([k, v]) => (
                <label key={k} style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{k}</span><input className="input" defaultValue={v} /></label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 22 }}>
              <button style={tabS(tab === "lines")} onClick={() => setTab("lines")}>Line items · {draft.lines.length}</button>
              <button style={tabS(tab === "q")} onClick={() => setTab("q")}>Questionnaire · {draft.questions.length}</button>
              <button style={tabS(tab === "t")} onClick={() => setTab("t")}>Terms</button>
              <button style={tabS(tab === "r")} onClick={() => setTab("r")}>Evaluation rules</button>
            </div>
            {tab === "lines" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: COLS, gap: "0 8px", ...label11, paddingBottom: 6, borderBottom: "1px solid var(--color-text)" }}>
                  <span>Line</span><span>Box</span><span>Size</span><span>Board and print</span><span style={{ textAlign: "right" }}>Qty</span>
                </div>
                {draft.lines.map((l, i) => (
                  <div key={l.id} style={{ display: "grid", gridTemplateColumns: COLS, gap: "0 8px", alignItems: "center", padding: "5px 0", borderBottom: "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)", background: l.tag === "changed by chat" || l.tag === "new SKU" ? "var(--color-accent-100)" : undefined }}>
                    <span style={{ color: "var(--color-neutral-700)", display: "flex", flexDirection: "column", lineHeight: 1.15 }}>{l.id}{l.tag && <span style={{ fontSize: 10, color: "var(--color-accent-800)" }}>{l.tag}</span>}</span>
                    {(["name", "size", "spec"] as const).map((f) => (
                      <input key={f} className="input" style={inp} value={l[f]} onChange={(e) => save({ ...draft, lines: draft.lines.map((x, j) => (j === i ? { ...x, [f]: e.target.value } : x)) })} />
                    ))}
                    <input className="input" style={{ ...inp, textAlign: "right" }} value={l.qty ?? ""} onChange={(e) => save({ ...draft, lines: draft.lines.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value.replace(/[^\d]/g, "")) || null } : x)) })} />
                  </div>
                ))}
              </div>
            )}
            {tab === "q" && draft.questions.map((x, i) => (
              <div key={x.id + i} style={{ display: "grid", gridTemplateColumns: "30px minmax(0,1fr) 120px", gap: 12, alignItems: "center", padding: "8px 0", borderBottom: "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)" }}>
                <span style={{ color: "var(--color-neutral-700)" }}>{x.id}</span>
                <input className="input" value={x.text} onChange={(e) => save({ ...draft, questions: draft.questions.map((y, j) => (j === i ? { ...y, text: e.target.value } : y)) })} />
                <span>{x.type}</span>
              </div>
            ))}
            {tab === "r" && grid && report && <EvaluationRules ev={ev} grid={grid} readings={readings} report={report} />}
            {tab === "t" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 14, maxWidth: 900 }}>
                {Object.entries(draft.terms).map(([k, v]) => (
                  <label key={k} style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{k}</span>
                    <input className="input" value={v} onChange={(e) => save({ ...draft, terms: { ...draft.terms, [k]: e.target.value } })} /></label>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
