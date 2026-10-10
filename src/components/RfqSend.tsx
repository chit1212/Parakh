"use client";
// RFQ → Send (stubbed): the vendor list, and one drafted email per vendor with the RFQ attached as
// an Excel file. Nothing goes out without the buyer's approval, and in this demo nothing leaves
// the app at all: "Approve & send" records who approved it and when, and marks it sent.
import { useState } from "react";
import { FileXls, PaperPlaneRight, Plus, X } from "@phosphor-icons/react";
import type { DraftRfq } from "@/lib/rfqDraft";
import { stamp } from "./useVerified";

export interface RfqVendor { name: string; contact: string; email: string }
export interface Sent { at: string; by: string; subject: string; body: string }

const label11 = { fontSize: 16, color: "var(--color-neutral-700)" };
const inp: React.CSSProperties = { minHeight: 30, padding: "3px 8px", fontSize: 15 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const fileName = (ref: string) => `RFQ_${ref.replace(/[^\w-]+/g, "_")}.xlsx`;

/** The email each vendor receives, drafted in code from the RFQ. The buyer can edit it before approving. */
export function draftEmail(o: { v: RfqVendor; ref: string; title: string; due: string; draft: DraftRfq; company: string; plant: string; buyer: string; buyerRole: string }) {
  const basis = o.draft.terms["Price basis"];
  const subject = `RFQ ${o.ref}: ${o.title}, quotation requested by ${o.due || "(reply date)"}`;
  const body = `Dear ${o.v.contact || "Sir/Madam"},

${o.company} invites ${o.v.name} to quote for ${o.title}: ${o.draft.lines.length} line${o.draft.lines.length === 1 ? "" : "s"}, listed in the attached file ${fileName(o.ref)} with sizes, board and quantities.
${basis ? `\nPlease quote: ${basis}.` : ""}
Please also answer the ${o.draft.questions.length}-question quality questionnaire on the second sheet${o.draft.questions.some((q) => q.type === "Mandatory") ? `; ${o.draft.questions.filter((q) => q.type === "Mandatory").map((q) => q.id).join(" and ")} are mandatory, with documents attached` : ""}. Our commercial terms are on the third sheet.

Kindly reply by ${o.due || "(reply date)"}. You may fill in the attached sheet or reply in your own format; we will read either.

Regards,
${o.buyer}
${o.buyerRole}, ${o.company}
${o.plant}`;
  return { subject, body };
}

export function RfqSend({ draft, vendors, setVendors, sent, setSent, refId, title, due, people, onDownload }: {
  draft: DraftRfq; vendors: RfqVendor[]; setVendors: (v: RfqVendor[]) => void;
  sent: Record<string, Sent>; setSent: (s: Record<string, Sent>) => void;
  refId: string; title: string; due: string;
  people: { company: string; plant: string; buyer: string; buyerRole: string };
  onDownload: () => void;
}) {
  const [add, setAdd] = useState<RfqVendor>({ name: "", contact: "", email: "" });
  const [edits, setEdits] = useState<Record<string, { subject: string; body: string }>>({});
  // What must be true before anything can be sent.
  const missing = [
    !draft.lines.length && "at least one line",
    ...draft.lines.filter((l) => !l.name.trim() || !l.qty).map((l) => `a name and quantity on ${l.id}`),
    !title.trim() && "a title",
    !due.trim() && "a reply-by date",
    !vendors.length && "at least one vendor",
    ...vendors.filter((v) => !EMAIL.test(v.email)).map((v) => `a valid email for ${v.name || "a vendor"}`),
  ].filter(Boolean) as string[];
  const mail = (v: RfqVendor) => edits[v.email] ?? draftEmail({ v, ref: refId, title, due, draft, ...people });
  const approve = (vs: RfqVendor[]) => {
    const at = new Date().toISOString();
    setSent({ ...sent, ...Object.fromEntries(vs.map((v) => [v.email, { at, by: people.buyer, ...mail(v) }])) });
  };
  const unsent = vendors.filter((v) => !sent[v.email]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 1000 }}>
      <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h3 style={{ fontSize: 20, margin: 0 }}>Vendors</h3>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.3fr) 120px 32px", gap: "0 10px", ...label11, paddingBottom: 6, borderBottom: "1px solid var(--color-text)" }}>
          <span>Vendor</span><span>Contact</span><span>Email</span><span>Status</span><span />
        </div>
        {vendors.map((v, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.3fr) 120px 32px", gap: "0 10px", alignItems: "center", padding: "4px 0", borderBottom: "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)" }}>
            {(["name", "contact", "email"] as const).map((k) => (
              <input key={k} className="input" style={{ ...inp, ...(k === "email" && !EMAIL.test(v.email) ? { boxShadow: "inset 0 0 0 1px var(--color-accent-2)" } : {}) }} value={v[k]} disabled={!!sent[v.email]}
                onChange={(e) => setVendors(vendors.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />
            ))}
            <span style={{ fontSize: 14, color: sent[v.email] ? "var(--color-accent-800)" : "var(--color-neutral-700)" }}>{sent[v.email] ? `Sent ${stamp(sent[v.email].at)}` : "Not sent"}</span>
            <button className="btn btn-ghost btn-icon" title="Remove vendor" disabled={!!sent[v.email]} onClick={() => setVendors(vendors.filter((_, j) => j !== i))}><X size={16} weight="duotone" /></button>
          </div>
        ))}
        <form onSubmit={(e) => { e.preventDefault(); if (add.name.trim() && EMAIL.test(add.email)) { setVendors([...vendors, add]); setAdd({ name: "", contact: "", email: "" }); } }}
          style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.3fr) 152px", gap: "0 10px", alignItems: "center", paddingTop: 6 }}>
          <input className="input" style={inp} placeholder="Vendor name" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} />
          <input className="input" style={inp} placeholder="Contact person" value={add.contact} onChange={(e) => setAdd({ ...add, contact: e.target.value })} />
          <input className="input" style={inp} placeholder="email@vendor.example" value={add.email} onChange={(e) => setAdd({ ...add, email: e.target.value })} />
          <button className="btn btn-secondary" type="submit" disabled={!add.name.trim() || !EMAIL.test(add.email)}><Plus size={14} weight="duotone" />Add vendor</button>
        </form>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h3 style={{ fontSize: 20, margin: 0 }}>Outbox</h3>
          <span className="tag tag-neutral">Demo: sending is stubbed</span>
          <span style={{ color: "var(--color-neutral-700)", fontSize: 14 }}>One email per vendor, drafted from this RFQ; edit any of them. Each vendor sees only its own email. Nothing leaves this app.</span>
        </div>
        {missing.length > 0 ? (
          <span style={{ color: "var(--color-accent-2-800)" }}>Before sending, the RFQ needs {missing.join(", ")}.</span>
        ) : (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button className="btn btn-primary" disabled={!unsent.length} onClick={() => approve(unsent)}><PaperPlaneRight size={16} weight="duotone" />{unsent.length ? `Approve & send to ${unsent.length === vendors.length ? "all " : ""}${unsent.length} vendor${unsent.length === 1 ? "" : "s"}` : "Sent to every vendor"}</button>
            <button className="btn btn-ghost" onClick={onDownload}><FileXls size={16} weight="duotone" />Download the attachment</button>
          </div>
        )}
        {missing.length === 0 && vendors.map((v) => {
          const m = sent[v.email] ?? mail(v);
          const done = !!sent[v.email];
          return (
            <div key={v.email} style={{ background: "var(--color-surface)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <b>{v.name}</b><span style={{ color: "var(--color-neutral-700)" }}>To {v.contact ? `${v.contact} ` : ""}&lt;{v.email}&gt;</span>
                <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: 14, color: "var(--color-neutral-700)" }}><FileXls size={14} weight="duotone" />{fileName(refId)}</span>
              </div>
              <input className="input" style={{ ...inp, background: "var(--color-bg)" }} value={m.subject} disabled={done} onChange={(e) => setEdits({ ...edits, [v.email]: { ...m, subject: e.target.value } })} />
              <textarea className="input" style={{ minHeight: 190, background: "var(--color-bg)", whiteSpace: "pre-wrap", fontSize: 15 }} value={m.body} disabled={done}
                onChange={(e) => setEdits({ ...edits, [v.email]: { ...m, body: e.target.value } })} />
              {done ? (
                <span style={{ color: "var(--color-accent-800)" }}>Approved by {sent[v.email].by} and marked sent {stamp(sent[v.email].at)}. (Demo: no email server; nothing left this app.)</span>
              ) : (
                <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => approve([v])}>Approve &amp; send</button>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
