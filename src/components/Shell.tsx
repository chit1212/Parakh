"use client";
// Left navigation (design: "Shared Screens", 228 px). The event section shows inside an event.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartLine, Calculator, Files, Tray, UsersThree } from "@phosphor-icons/react";

const EVENT = "SE-2026-041";

const navS = (on: boolean, disabled = false): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", textDecoration: "none", fontSize: 14,
  color: on ? "var(--color-accent-800)" : disabled ? "var(--color-neutral-500)" : "var(--color-text)",
  background: on ? "var(--color-accent-100)" : "transparent", borderRadius: "var(--radius-md)",
  cursor: disabled ? "default" : "pointer",
});

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const inEvent = path.startsWith("/events/");
  const top = [
    { icon: Tray, label: "Sourcing events", href: "/" },
    { icon: UsersThree, label: "Vendors", href: null },
    { icon: Calculator, label: "Should-cost library", href: null },
    { icon: Files, label: "Templates", href: null },
    // Reports holds the test scorecard (L24): how well Parakh reads, graded against the answer key.
    { icon: ChartLine, label: "Reports", href: "/scorecard" },
  ];
  const ev = [
    { label: "RFQ", href: null },
    { label: "Replies", href: `/events/${EVENT}/replies` },
    { label: "Comparison", href: `/events/${EVENT}/compare` },
    { label: "Award record", href: null },
  ];
  return (
    <div style={{ display: "flex", minHeight: "100vh", minWidth: 1360, fontSize: 13, lineHeight: 1.45, fontVariantNumeric: "tabular-nums" }}>
      <nav style={{ width: 228, flex: "none", display: "flex", flexDirection: "column", gap: 2, padding: "20px 14px 16px", position: "sticky", top: 0, height: "100vh" }}>
        <Link href="/" style={{ fontSize: 22, fontWeight: 600, padding: "0 10px 18px", color: "var(--color-text)", textDecoration: "none" }}>Parakh</Link>
        {top.map((n) =>
          n.href ? (
            <Link key={n.label} href={n.href} style={navS(path === n.href)}><n.icon size={18} weight="duotone" />{n.label}</Link>
          ) : (
            <span key={n.label} style={navS(false, true)} title="Not part of this demo"><n.icon size={18} weight="duotone" />{n.label}</span>
          ),
        )}
        {inEvent && (
          <>
            <span style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-neutral-700)", padding: "18px 10px 6px" }}>{EVENT}</span>
            {ev.map((n) =>
              n.href ? (
                <Link key={n.label} href={n.href} style={{ ...navS(path === n.href), paddingLeft: 14 }}>{n.label}</Link>
              ) : (
                <span key={n.label} style={{ ...navS(false, true), paddingLeft: 14 }} title="Coming in a later milestone">{n.label}</span>
              ),
            )}
          </>
        )}
        <div style={{ marginTop: "auto", padding: "0 10px", display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
          <span style={{ fontWeight: 600 }}>Vikram Deshpande</span>
          <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>Category buyer, Packaging · Sahyadri Appliances</span>
        </div>
      </nav>
      <main style={{ flex: 1, minWidth: 0, padding: "24px 40px 40px 12px" }}>{children}</main>
    </div>
  );
}
