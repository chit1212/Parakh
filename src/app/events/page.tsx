"use client";
// Sourcing events (design: "Shared Screens", home). SE-2026-041 and last year's SE-2025-037 come
// from the dataset and code; the other rows are display-only workspace stubs.
import { useMemo, useState } from "react";
import Link from "next/link";
import { Copy, DotsThree, Plus } from "@phosphor-icons/react";
import { ScreenHead } from "@/components/Rail";
import { Shell } from "@/components/Shell";
import { Kpis } from "@/components/ui";
import { useReadings } from "@/components/useReadings";
import { useScheme } from "@/components/useScheme";
import { useDecisions } from "@/components/useDecisions";
import { applyDecisions } from "@/lib/decisions";
import { findDoubts } from "@/lib/doubts";
import { qualityOf } from "@/lib/quality";
import { AWARD_BY } from "@/lib/routes";
import { buildGrid } from "@/lib/compare";
import { crore, lakh } from "@/lib/format";
import type { ReplyReading } from "@/lib/reader/pipeline";
import { mainFile } from "@/lib/summary";
import { STUB_EVENTS, type StubEvent } from "@/lib/workspace";

const STATUSES = ["All", "Comparing", "Collecting replies", "Drafting", "Awaiting approval", "Awarded", "Closed"] as const;
const CHIP: Record<string, string> = { "Collecting replies": "Collecting" };
const OPEN = new Set(["Drafting", "Collecting replies", "Comparing", "Awaiting approval"]);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Send by 12 Oct" → a sortable day of the year (display stubs carry their dates as text). */
const dayOf = (t: string) => { const m = t.match(/(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/); return m ? MONTHS.indexOf(m[2]) * 31 + Number(m[1]) : null; };

interface Row {
  id: string; name: string; cat: string; status: StubEvent["status"]; lines: number | string; replies: string; value: string;
  due: string; note: string; pastNote?: string; href: string | null; next: string; urgent?: boolean; valueInr: number | null;
}

const tagFor = (s: string) => (s === "Comparing" ? "tag tag-accent" : s === "Awaiting approval" ? "tag tag-accent-2" : s === "Awarded" ? "tag tag-outline" : "tag tag-neutral");

export default function EventsPage() {
  const { data, state } = useReadings();
  const [scheme] = useScheme();
  const [decisions] = useDecisions();
  const [tab, setTab] = useState<(typeof STATUSES)[number]>("All");
  const [q, setQ] = useState("");

  const rows = useMemo<Row[]>(() => {
    const live: Row[] = [];
    if (data) {
      const ev = data.event;
      const readings = data.replies.map((r) => state[r.id]?.reading).filter((r): r is ReplyReading => Boolean(r && r.status !== "error"));
      const files = Object.fromEntries(data.replies.map((r) => [r.id, mainFile(r, state[r.id]?.reading ?? null) ?? undefined]));
      const grid = applyDecisions(ev, buildGrid(ev, readings, { sheets: data.historySheets }, files, data.lastYear), decisions);
      // The same doubts the Compare screen raises: only those that could change a winner.
      const cleared = ev.vendors.map((v) => qualityOf(ev, v.id, readings, scheme)).filter((q) => q.cleared).map((q) => q.vendorId);
      const doubts = findDoubts(ev, grid, cleared).raised;
      const replied = new Set(readings.filter((r) => r.vendorId && (r.status === "read" || r.status === "incomplete")).map((r) => r.vendorId)).size;
      live.push({
        id: ev.id, name: ev.title.replace(", ", " · "), cat: "Packaging", status: "Comparing", lines: ev.lines.length,
        replies: `${replied} of ${ev.vendors.length} replied`, value: grid.asQuoted.total ? crore(grid.asQuoted.total) : "—",
        due: `Award by ${AWARD_BY}`, note: `${readings.length} of ${data.replies.length} replies read`, valueInr: grid.asQuoted.total || null,
        href: `/events/${ev.id}/compare`, urgent: doubts.length > 0,
        next: doubts.length ? `Review ${doubts.length} doubt${doubts.length > 1 ? "s" : ""} · ${lakh(doubts.reduce((a, d) => a + d.stake, 0))}` : readings.length ? "Open the comparison" : "Upload replies",
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
        href: "/api/file?path=" + encodeURIComponent("dataset/04_history/SE-2025-037_Award_Summary.xlsx"), next: "View award", valueInr: null,
      });
    }
    const stubs: Row[] = STUB_EVENTS.map((e) => ({
      ...e, value: e.valueInr ? crore(e.valueInr) : "—", href: null,
    }));
    // Same order as the design: the live event first, last year's among the awarded.
    const all = [live[0], ...stubs.slice(0, 4), live[1], ...stubs.slice(4)].filter(Boolean);
    return all;
  }, [data, state, scheme, decisions]);

  const shown = rows.filter((r) => (tab === "All" || r.status === tab) && (!q.trim() || `${r.name} ${r.id} ${r.cat} ${r.note}`.toLowerCase().includes(q.trim().toLowerCase())));
  const open = rows.filter((r) => OPEN.has(r.status));
  const needYou = open.filter((r) => r.urgent || r.status === "Drafting" || r.status === "Awaiting approval");
  const openValue = open.reduce((a, r) => a + (r.valueInr ?? 0), 0);
  // Deadlines ahead ("Send by 12 Oct", "Closes 14 Oct", "Award by 15 Oct"), not dates already past ("with VP since").
  const next = open.filter((r) => !/since/i.test(r.due)).map((r) => ({ r, d: dayOf(r.due) })).filter((x) => x.d != null).sort((a, b) => a.d! - b.d!)[0]?.r;

  return (
    <Shell>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1180 }}>
        <ScreenHead meta="Sahyadri Appliances · Packaging & print · FY27" title="Sourcing events">
          <input className="input" style={{ width: 300 }} placeholder="Search events, vendors, SKUs" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn btn-primary" style={{ whiteSpace: "nowrap" }} disabled title="Not part of this demo"><Plus size={16} weight="duotone" />New event</button>
        </ScreenHead>
        <Kpis items={[
          { label: "Need you this week", value: needYou.length, sub: needYou.map((r) => r.name.split(" · ")[0]).join(" · ") || "Nothing waiting on you" },
          { label: "Open value", value: openValue ? crore(openValue) : "—", sub: `${open.length} open events, as quoted so far` },
          { label: "Next deadline", value: next ? next.due.replace(/^\D+/, "") : "—", sub: next ? `${next.name.split(" · ")[0]}: ${next.due.match(/^\D+/)?.[0].trim().toLowerCase() ?? ""}` : "None open" },
        ]} />
        <div className="sheet" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {STATUSES.filter((s) => s === "All" || rows.some((r) => r.status === s)).map((s) => (
              <button key={s} className={tab === s ? "chip chip-on" : "chip"} onClick={() => setTab(s)}>
                {CHIP[s] ?? s} <span style={{ opacity: 0.75 }}>{s === "All" ? rows.length : rows.filter((r) => r.status === s).length}</span>
              </button>
            ))}
          </div>
          <table className="table">
            <thead>
              <tr><th>Event</th><th>Stage</th><th>Due</th><th style={{ textAlign: "right" }}>Value</th><th>Next step</th><th /></tr>
            </thead>
            <tbody>
              {!data && <tr><td colSpan={6} style={{ color: "var(--color-neutral-700)" }}>Loading…</td></tr>}
              {!shown.length && data && <tr><td colSpan={6} style={{ color: "var(--color-neutral-700)" }}>No events match.</td></tr>}
              {shown.map((e) => (
                <tr key={e.id} className="hover-row" style={{ height: 64 }}>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
                      {e.href ? <Link href={e.href} style={{ fontWeight: 600, fontSize: 17, color: "var(--color-text)", textDecoration: "none" }}>{e.name}</Link>
                        : <span style={{ fontWeight: 600, fontSize: 17 }}>{e.name}</span>}
                      <span style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>{e.id} · {e.cat} · {e.lines} lines · {e.replies}</span>
                      {e.pastNote && <span style={{ fontSize: 14, color: "var(--color-accent-800)" }}>{e.pastNote}</span>}
                    </div>
                  </td>
                  <td><span className={tagFor(e.status)}>{e.status}</span></td>
                  <td>{e.due}</td>
                  <td style={{ textAlign: "right" }}>{e.value}</td>
                  <td>
                    {e.urgent && e.href ? <Link className="btn btn-primary" href={e.href} style={{ whiteSpace: "nowrap" }}>{e.next}</Link>
                      : e.href ? <Link href={e.href} style={{ color: "var(--color-accent-700)", textDecoration: "none", whiteSpace: "nowrap" }}>{e.next} →</Link>
                      : <span style={{ color: "var(--color-accent-700)", whiteSpace: "nowrap", opacity: 0.6, cursor: "default" }} title="Not part of this demo">{e.next} →</span>}
                  </td>
                  <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                    <button className="btn btn-ghost btn-icon" title="Clone (not part of this demo)" disabled><Copy size={18} weight="duotone" /></button>
                    <button className="btn btn-ghost btn-icon" title="More (not part of this demo)" disabled><DotsThree size={20} weight="duotone" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
