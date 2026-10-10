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
    <nav style={{ width: 72, flex: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "22px 0", position: "sticky", top: 0, height: "100vh", zIndex: 30 }}>
      <WorkspaceMenu />
      {items.map((r) => {
        const on = r.href.split("?")[0] === path;
        const s: React.CSSProperties = {
          width: 62, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "9px 0", textDecoration: "none", borderRadius: "var(--radius-lg)",
          background: on ? "var(--color-accent-200)" : "transparent", color: on ? "var(--color-accent-800)" : "var(--color-neutral-800)", fontWeight: on ? 600 : 400,
        };
        return <Link key={r.label} href={r.href} style={s} className={on ? undefined : "rail-item"}><r.icon size={24} weight="duotone" /><span style={{ fontSize: 13 }}>{r.label}</span></Link>;
      })}
    </nav>
  );
}

/** Screen header pattern (v2): a 15 px meta line, then a 30 px H1. */
export function ScreenHead({ meta, title, children }: { meta: React.ReactNode; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginRight: "auto" }}>
        <span style={{ fontSize: 15, color: "var(--color-neutral-700)" }}>{meta}</span>
        <h1 style={{ fontSize: 30, fontWeight: 600, margin: 0, lineHeight: 1.15 }}>{title}</h1>
      </div>
      {children}
    </div>
  );
}
