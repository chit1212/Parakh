"use client";
// Sourcing events (design: "Shared Screens", home). SE-2026-041 and last year's SE-2025-037 come
// from the dataset and code; the other rows are display-only workspace stubs.
import { useMemo, useState } from "react";
import Link from "next/link";
import { Copy, DotsThree, Plus } from "@phosphor-icons/react";
import { ScreenHead } from "@/components/Rail";
import { Shell } from "@/components/Shell";
import { useReadings } from "@/components/useReadings";
import { buildGrid } from "@/lib/compare";
import { crore } from "@/lib/format";
import type { ReplyReading } from "@/lib/reader/pipeline";
import { mainFile } from "@/lib/summary";
import { STUB_EVENTS, type StubEvent } from "@/lib/workspace";

const STATUSES = ["All", "Drafting", "Collecting replies", "Comparing", "Awaiting approval", "Awarded", "Closed"] as const;

interface Row {
  id: string; name: string; cat: string; status: StubEvent["status"]; lines: number | string; replies: string; value: string;
  due: string; note: string; pastNote?: string; href: string | null; action: string;
}

const tagFor = (s: string) => (s === "Comparing" ? "tag tag-accent" : s === "Awaiting approval" ? "tag tag-accent-2" : s === "Awarded" ? "tag tag-outline" : "tag tag-neutral");

export default function EventsPage() {
  const { data, state } = useReadings();
  const [tab, setTab] = useState<(typeof STATUSES)[number]>("All");
  const [q, setQ] = useState("");

  const rows = useMemo<Row[]>(() => {
    const live: Row[] = [];
    if (data) {
      const ev = data.event;
      const readings = data.replies.map((r) => state[r.id]?.reading).filter((r): r is ReplyReading => Boolean(r && r.status !== "error"));
      const files = Object.fromEntries(data.replies.map((r) => [r.id, mainFile(r, state[r.id]?.reading ?? null) ?? undefined]));
      const grid = buildGrid(ev, readings, { sheets: data.historySheets }, files);
      const replied = new Set(readings.filter((r) => r.vendorId && (r.status === "read" || r.status === "incomplete")).map((r) => r.vendorId)).size;
      live.push({
        id: ev.id, name: ev.title.replace(", ", " · "), cat: "Packaging", status: "Comparing", lines: ev.lines.length,
        replies: `${replied} of ${ev.vendors.length} replied`, value: grid.asQuoted.total ? crore(grid.asQuoted.total) : "—",
        due: `Replies closed ${ev.due.replace(/ \d{4}$/, "")}`, note: `${readings.length} of ${data.replies.length} replies read`,
        href: `/events/${ev.id}/compare`, action: "Open",
      });
      // Last year's event, from the buyer's award summary.
      const ly = data.lastYear;
      const title = data.historySheets[0]?.cells.find((c) => /award summary/i.test(c.text))?.text ?? "";
      const approved = title.match(/approved ([\d]+ \w+ \d{4})/)?.[1];
      const split = Object.entries(ly.reduce<Record<string, number>>((a, l) => ((a[l.vendor] = (a[l.vendor] ?? 0) + 1), a), {}))
        .sort((a, b) => b[1] - a[1]).map(([v, n]) => `${ev.vendors.find((x) => x.name === v)?.short ?? v} ${n}`).join(", ");
      live.push({
        id: ev.lyEventId, name: "Corrugated boxes · FY26 H2", cat: "Packaging", status: "Awarded", lines: ly.length, replies: "Award on file",
        value: "—", due: approved ? `Awarded ${approved}` : "Awarded", note: split, pastNote: `Source for “same as last year” in ${ev.id}`,
        href: "/api/file?path=" + encodeURIComponent("dataset/04_history/SE-2025-037_Award_Summary.xlsx"), action: "View",
      });
    }
    const stubs: Row[] = STUB_EVENTS.map((e) => ({
      ...e, value: e.valueInr ? crore(e.valueInr) : "—", href: null, action: e.status === "Drafting" ? "Continue" : "View",
    }));
    // Same order as the design: the live event first, last year's among the awarded.
    const all = [live[0], ...stubs.slice(0, 4), live[1], ...stubs.slice(4)].filter(Boolean);
    return all;
  }, [data, state]);

  const shown = rows.filter((r) => (tab === "All" || r.status === tab) && (!q.trim() || `${r.name} ${r.id} ${r.cat} ${r.note}`.toLowerCase().includes(q.trim().toLowerCase())));
  const tabS = (on: boolean): React.CSSProperties => ({
    whiteSpace: "nowrap", background: "none", border: 0, padding: "4px 0", font: "inherit", fontSize: 14, cursor: "pointer",
    color: on ? "var(--color-text)" : "var(--color-neutral-700)", fontWeight: on ? 600 : 400, boxShadow: on ? "inset 0 -2px 0 var(--color-text)" : "none",
  });

  return (
    <Shell>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1180 }}>
        <ScreenHead meta="Sahyadri Appliances · Packaging & print · FY27" title="Sourcing events">
          <input className="input" style={{ width: 280 }} placeholder="Search events, vendors, SKUs" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn btn-primary" style={{ whiteSpace: "nowrap" }} disabled title="Not part of this demo"><Plus size={16} weight="duotone" />New event</button>
        </ScreenHead>
        <div style={{ display: "flex", gap: 22 }}>
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setTab(s)} style={tabS(tab === s)}>
              {s} <span style={{ color: "var(--color-neutral-700)", fontWeight: 400 }}>{s === "All" ? rows.length : rows.filter((r) => r.status === s).length}</span>
            </button>
          ))}
        </div>
        <table className="table">
          <thead>
            <tr><th>Event</th><th>Status</th><th style={{ textAlign: "right" }}>Lines</th><th>Replies</th><th style={{ textAlign: "right" }}>Value</th><th>Next</th><th /></tr>
          </thead>
          <tbody>
            {!data && <tr><td colSpan={7} style={{ color: "var(--color-neutral-700)" }}>Loading…</td></tr>}
            {shown.map((e) => (
              <tr key={e.id}>
                <td style={{ padding: "12px 10px" }}>
                  <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
                    {e.href ? <Link href={e.href} style={{ fontWeight: 600, fontSize: 15, color: "var(--color-text)", textDecoration: "none" }}>{e.name}</Link>
                      : <span style={{ fontWeight: 600, fontSize: 15 }}>{e.name}</span>}
                    <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{e.id} · {e.cat}</span>
                    {e.pastNote && <span style={{ fontSize: 12, color: "var(--color-accent-800)" }}>{e.pastNote}</span>}
                  </div>
                </td>
                <td><span className={tagFor(e.status)}>{e.status}</span></td>
                <td style={{ textAlign: "right" }}>{e.lines}</td>
                <td>{e.replies}</td>
                <td style={{ textAlign: "right" }}>{e.value}</td>
                <td>
                  <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
                    <span>{e.due}</span><span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{e.note}</span>
                  </div>
                </td>
                <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                  {e.href ? <Link className="btn btn-ghost" href={e.href}>{e.action}</Link>
                    : <span className="btn btn-ghost" style={{ opacity: 0.45, cursor: "default" }} title="Not part of this demo">{e.action}</span>}
                  <button className="btn btn-ghost btn-icon" title="Duplicate (not part of this demo)" disabled><Copy size={16} weight="duotone" /></button>
                  <button className="btn btn-ghost btn-icon" title="More (not part of this demo)" disabled><DotsThree size={18} weight="duotone" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
