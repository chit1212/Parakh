"use client";
// The "P" workspace menu (design: WorkspaceMenu): current event, switch event, who is signed in
// (with the demo's buyer/VP switch), the event's evaluation rules, and sign out.
import { useState } from "react";
import Link from "next/link";
import { ArrowCounterClockwise, Scales, SignOut } from "@phosphor-icons/react";
import { AWARD_BY, EVENT_ID, HOME, PEOPLE, RULES } from "@/lib/routes";
import { STUB_EVENTS } from "@/lib/workspace";
import { useRole } from "./useRole";
import { resetDemo } from "./useReadings";

const sec = { fontSize: 14, fontWeight: 600, color: "var(--color-neutral-800)" };
const seg = (on: boolean): React.CSSProperties => ({ flex: 1, border: 0, padding: "8px 10px", font: "inherit", fontSize: 15, background: on ? "var(--color-accent)" : "transparent", color: on ? "var(--color-bg)" : "inherit", fontWeight: on ? 600 : 400, whiteSpace: "nowrap", cursor: "pointer" });
const link: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, fontSize: 17, color: "var(--color-accent-700)", textDecoration: "none" };
const tagFor = (s: string) => (s === "Comparing" ? "tag tag-accent" : s === "Awaiting approval" ? "tag tag-accent-2" : s === "Awarded" ? "tag tag-outline" : "tag tag-neutral");

export function WorkspaceMenu() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | "empty" | "full">(null);
  const [role, setRole] = useRole();
  const me = role === "VP" ? PEOPLE.vp : PEOPLE.buyer;
  // Three recent events: two from the workspace (display-only in the demo) and last year's.
  const recent = [
    ...STUB_EVENTS.filter((e) => e.status === "Collecting replies" || e.status === "Awaiting approval").slice(0, 2).map((e) => ({ id: e.id, name: e.name, status: e.status, href: "/events" })),
    { id: "SE-2025-037", name: "Corrugated boxes, FY26 H2", status: "Awarded", href: "/api/file?path=" + encodeURIComponent("dataset/04_history/SE-2025-037_Award_Summary.xlsx") },
  ];
  const close = () => { setOpen(false); setConfirm(null); };
  return (
    <div style={{ position: "relative", marginBottom: 18 }}>
      <button onClick={() => setOpen(!open)} title="Workspace" aria-expanded={open}
        style={{ width: 44, height: 44, borderRadius: "var(--radius-lg)", border: 0, font: "inherit", fontSize: 22, fontWeight: 700, cursor: "pointer",
          color: "var(--color-bg)", background: open ? "var(--color-accent)" : "var(--color-text)", boxShadow: open ? "0 0 0 3px var(--color-accent-200)" : "none" }}>
        P
      </button>
      {open && (
        <>
          <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{ position: "absolute", left: 56, top: 0, zIndex: 41, width: 420, maxHeight: "calc(100vh - 40px)", overflow: "auto", background: "var(--color-neutral-100)", boxShadow: "var(--shadow-lg)", borderRadius: "var(--radius-lg)", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18, fontSize: 16, lineHeight: 1.4 }}>
            <section style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={sec}>Current event</span>
              <Link href={HOME} onClick={close} style={{ fontSize: 21, fontWeight: 600, color: "var(--color-text)", textDecoration: "none" }}>Corrugated boxes, FY27 H2</Link>
              <span style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--color-neutral-700)", fontSize: 15 }}><span className="tag tag-accent">Comparing</span>{EVENT_ID} · award by {AWARD_BY}</span>
            </section>
            <section style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={sec}>Switch event</span>
              {recent.map((e) => (
                <Link key={e.id} href={e.href} onClick={close} className="ws-item" style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", margin: "0 -8px", color: "var(--color-text)", textDecoration: "none", borderRadius: "var(--radius-md)" }}>
                  <span style={{ display: "flex", flexDirection: "column", marginRight: "auto", lineHeight: 1.3 }}><span style={{ fontSize: 17 }}>{e.name}</span><span style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>{e.id}</span></span>
                  <span className={tagFor(e.status)}>{e.status}</span>
                </Link>
              ))}
              <Link href="/events" onClick={close} style={{ ...link, fontSize: 16, paddingTop: 4 }}>All events →</Link>
            </section>
            <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={sec}>Signed in as</span>
              <span style={{ lineHeight: 1.35 }}><span style={{ fontSize: 17, fontWeight: 600 }}>{me.name}</span><br /><span style={{ fontSize: 15, color: "var(--color-neutral-700)" }}>{me.role} · {PEOPLE.company}</span></span>
              <span style={{ fontSize: 14, color: "var(--color-neutral-700)", paddingTop: 4 }}>Demo: view as</span>
              <span style={{ display: "flex", boxShadow: "inset 0 0 0 1px var(--color-neutral-400)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                <button style={seg(role === "Buyer")} onClick={() => setRole("Buyer")}>{PEOPLE.buyer.name.split(" ")[0]} · buyer</button>
                <button style={seg(role === "VP")} onClick={() => setRole("VP")}>{PEOPLE.vp.name.split(" ")[0]} · VP</button>
              </span>
            </section>
            <section style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--color-neutral-300)", paddingTop: 14 }}>
              <Link href={RULES} onClick={close} style={link}><Scales size={22} weight="duotone" />Evaluation rules for this event</Link>
              <Link href="/login" onClick={close} style={link}><SignOut size={22} weight="duotone" />Sign out</Link>
            </section>
            <section style={{ display: "flex", flexDirection: "column", gap: 6, background: "var(--color-bg)", padding: "12px 14px", borderRadius: "var(--radius-md)" }}>
              <span style={sec}>Reset demo</span>
              {!confirm ? (
                <>
                  <button className="btn btn-ghost" style={{ justifyContent: "flex-start", padding: "4px 0", fontSize: 16, color: "var(--color-accent-700)" }} onClick={() => setConfirm("empty")}><ArrowCounterClockwise size={20} weight="duotone" />Start empty: RFQ, upload, compare</button>
                  <button className="btn btn-ghost" style={{ justifyContent: "flex-start", padding: "4px 0", fontSize: 16, color: "var(--color-accent-700)" }} onClick={() => setConfirm("full")}><ArrowCounterClockwise size={20} weight="duotone" />Back to the full demo (five replies read)</button>
                </>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <span style={{ fontSize: 15 }}>
                    This wipes everything in this browser: your approvals, uploads, overrides, decisions, draft award, marking changes, RFQ draft and chat.
                    {confirm === "empty" ? " The event then starts with no replies, on the RFQ screen." : " The five vendors’ replies come back as read."}
                  </span>
                  <span style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-primary" onClick={() => resetDemo(confirm === "empty" ? { empty: true, to: `/events/${EVENT_ID}/rfq` } : { empty: false, to: HOME })}>Reset</button>
                    <button className="btn btn-secondary" onClick={() => setConfirm(null)}>Cancel</button>
                  </span>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
