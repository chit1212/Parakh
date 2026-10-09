"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartLine, Calculator, Files, Tray, UsersThree } from "@phosphor-icons/react";

const EVENT = "SE-2026-041";

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const top = [
    { icon: Tray, label: "Sourcing events", href: null },
    { icon: UsersThree, label: "Vendors", href: null },
    { icon: Calculator, label: "Should-cost library", href: null },
    { icon: Files, label: "Templates", href: null },
    { icon: ChartLine, label: "Test scorecard", href: "/scorecard" },
  ];
  const ev = [
    { label: "RFQ", href: null },
    { label: "Replies", href: `/events/${EVENT}/replies` },
    { label: "Comparison", href: null },
    { label: "Doubts", href: null },
    { label: "Award", href: null },
  ];
  const item = (on: boolean, disabled: boolean) =>
    `flex items-center gap-[10px] px-[10px] py-[7px] rounded-[var(--radius-md)] text-[15px] no-underline ${
      on ? "bg-a-100 text-a-800" : disabled ? "text-n-500 cursor-default" : "text-ink hover:bg-n-200"
    }`;
  return (
    <div className="min-h-screen flex">
      <nav className="w-[230px] shrink-0 border-r border-rule px-[var(--space-3)] py-[var(--space-6)] flex flex-col sticky top-0 h-screen">
        <div className="text-[26px] font-semibold px-[10px] mb-[var(--space-6)]" style={{ fontFamily: "var(--font-heading)" }}>
          Parakh
        </div>
        {top.map((n) =>
          n.href ? (
            <Link key={n.label} href={n.href} className={item(path === n.href, false)} style={{ color: path === n.href ? undefined : "var(--color-text)" }}>
              <n.icon size={18} /> {n.label}
            </Link>
          ) : (
            <span key={n.label} className={item(false, true)} title="Not part of this demo">
              <n.icon size={18} /> {n.label}
            </span>
          ),
        )}
        <div className="eyebrow px-[10px] mt-[var(--space-6)] mb-[var(--space-2)]">{EVENT}</div>
        {ev.map((n) =>
          n.href ? (
            <Link key={n.label} href={n.href} className={item(path === n.href, false)} style={{ color: path === n.href ? undefined : "var(--color-text)" }}>
              {n.label}
            </Link>
          ) : (
            <span key={n.label} className={item(false, true)} title="Coming in a later milestone">
              {n.label}
            </span>
          ),
        )}
        <div className="mt-auto px-[10px] text-[13px] leading-snug">
          <div className="font-semibold">Vikram Deshpande</div>
          <div className="text-n-700">Category buyer, Packaging · Sahyadri Appliances</div>
        </div>
      </nav>
      <main className="flex-1 min-w-0 px-[var(--space-8)] py-[var(--space-6)]">{children}</main>
    </div>
  );
}
