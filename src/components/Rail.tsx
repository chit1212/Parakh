"use client";
// The app shell's only navigation (design: 68 px icon rail). Compare is the home screen.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { EnvelopeOpen, NotePencil, SealCheck, Table, Tray } from "@phosphor-icons/react";

import { EVENT_ID as EVENT, HOME } from "@/lib/routes";
import { WorkspaceMenu } from "./WorkspaceMenu";

export function Rail() {
  const path = usePathname();
  const items = [
    { icon: Tray, label: "Events", href: "/events" },
    { icon: NotePencil, label: "RFQ", href: `/events/${EVENT}/rfq` },
    { icon: EnvelopeOpen, label: "Replies", href: `/events/${EVENT}/replies` },
    { icon: Table, label: "Compare", href: HOME },
    { icon: SealCheck, label: "Award", href: `/events/${EVENT}/award` },
  ];
  return (
    <nav style={{ width: 68, flex: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "18px 0", position: "sticky", top: 0, height: "100vh", zIndex: 30 }}>
      <WorkspaceMenu />
      {items.map((r) => {
        const on = r.href.split("?")[0] === path;
        const s = {
          display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 2, padding: "8px 0", width: 56, textDecoration: "none",
          color: on ? "var(--color-accent)" : r.href ? "var(--color-neutral-700)" : "var(--color-neutral-400)",
        };
        const body = <><r.icon size={20} weight="duotone" /><span style={{ fontSize: 10 }}>{r.label}</span></>;
        return r.href ? <Link key={r.label} href={r.href} style={s}>{body}</Link> : <span key={r.label} style={s} title="Coming in a later milestone">{body}</span>;
      })}
    </nav>
  );
}

/** Screen header pattern: an 11 px uppercase meta line, then a 26 px H1. */
export function ScreenHead({ meta, title, children }: { meta: React.ReactNode; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginRight: "auto" }}>
        <span style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-neutral-700)" }}>{meta}</span>
        <h1 style={{ fontSize: 26, margin: 0, lineHeight: 1.2 }}>{title}</h1>
      </div>
      {children}
    </div>
  );
}
