"use client";
// The "P" workspace menu (design: WorkspaceMenu): current event, switch event, who is signed in
// (with the demo's buyer/VP switch), the event's evaluation rules, and sign out.
import { useState } from "react";
import Link from "next/link";
import { ArrowCounterClockwise, Scales, SignOut } from "@phosphor-icons/react";
import { EVENT_ID, HOME, PEOPLE, RULES } from "@/lib/routes";
import { STUB_EVENTS } from "@/lib/workspace";
import { useRole } from "./useRole";
import { resetDemo } from "./useReadings";

const label11 = { fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--color-neutral-700)" };
const seg = (on: boolean): React.CSSProperties => ({ border: 0, padding: "5px 10px", font: "inherit", fontSize: 12.5, background: on ? "var(--color-accent)" : "transparent", color: on ? "var(--color-bg)" : "inherit", whiteSpace: "nowrap" });

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
  return (
    <div style={{ position: "relative", marginBottom: 14 }}>
      <button onClick={() => setOpen(!open)} title="Workspace" aria-expanded={open}
        style={{ width: 44, height: 44, borderRadius: "var(--radius-md)", border: 0, font: "inherit", fontSize: 22, fontWeight: 600, color: "var(--color-text)", background: open ? "var(--color-accent-100)" : "transparent", cursor: "pointer" }}>
        P
      </button>
      {open && (
        <>
          <div onClick={() => { setOpen(false); setConfirm(null); }} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{ position: "absolute", left: 52, top: 0, zIndex: 41, width: 340, background: "var(--color-bg)", boxShadow: "var(--shadow-lg)", padding: "18px 20px 16px", display: "flex", flexDirection: "column", gap: 16, fontSize: 13, lineHeight: 1.4 }}>
            <section style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={label11}>Current event</span>
              <Link href={HOME} onClick={() => setOpen(false)} style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text)", textDecoration: "none" }}>Corrugated boxes, FY27 H2</Link>
              <span style={{ color: "var(--color-neutral-700)" }}>{EVENT_ID} · Comparing · replies closed 3 Oct</span>
            </section>
            <section style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={label11}>Switch event</span>
              {recent.map((e) => (
                <Link key={e.id} href={e.href} onClick={() => setOpen(false)} className="ws-item" style={{ display: "flex", flexDirection: "column", padding: "5px 6px", margin: "0 -6px", color: "var(--color-text)", textDecoration: "none" }}>
                  <span>{e.name}</span>
                  <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{e.id} · {e.status}</span>
                </Link>
              ))}
              <Link href="/events" onClick={() => setOpen(false)} style={{ fontSize: 13, paddingTop: 2 }}>All events…</Link>
            </section>
            <section style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={label11}>Signed in as</span>
              <span><span style={{ fontWeight: 600 }}>{me.name}</span><br /><span style={{ color: "var(--color-neutral-700)" }}>{me.role} · {PEOPLE.company}</span></span>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--color-neutral-700)", paddingTop: 2 }}>
                Demo: view as
                <span style={{ display: "inline-flex", border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                  <button style={seg(role === "Buyer")} onClick={() => setRole("Buyer")}>{PEOPLE.buyer.name.split(" ")[0]} · buyer</button>
                  <button style={seg(role === "VP")} onClick={() => setRole("VP")}>{PEOPLE.vp.name.split(" ")[0]} · VP</button>
                </span>
              </span>
            </section>
            <section style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid var(--color-divider)", paddingTop: 12 }}>
              <Link href={RULES} onClick={() => setOpen(false)} style={{ display: "flex", alignItems: "center", gap: 8 }}><Scales size={18} weight="duotone" />Evaluation rules for this event</Link>
              <Link href="/login" onClick={() => setOpen(false)} style={{ display: "flex", alignItems: "center", gap: 8 }}><SignOut size={18} weight="duotone" />Sign out</Link>
            </section>
            <section style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid var(--color-divider)", paddingTop: 12 }}>
              <span style={label11}>Reset demo</span>
              {!confirm ? (
                <>
                  <button className="btn btn-ghost" style={{ justifyContent: "flex-start", padding: "4px 0" }} onClick={() => setConfirm("empty")}><ArrowCounterClockwise size={18} weight="duotone" />Start empty: RFQ, upload, compare</button>
                  <button className="btn btn-ghost" style={{ justifyContent: "flex-start", padding: "4px 0" }} onClick={() => setConfirm("full")}><ArrowCounterClockwise size={18} weight="duotone" />Back to the full demo (five replies read)</button>
                </>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "var(--color-surface)", padding: "10px 12px" }}>
                  <span style={{ fontSize: 12.5 }}>
                    This wipes everything in this browser: your ticks, uploads, overrides, decisions, frozen award, marking changes, RFQ draft and chat.
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
