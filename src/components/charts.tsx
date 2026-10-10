// Small chart pieces shared by the chat answers and the Chart view (review fixes 1b, 4a–4d).
// Every value is passed in from the same computed store as the table; nothing here calculates totals.
import { lakh } from "@/lib/format";

export interface ShareRow { name: string; lines: number; value: number; pct: number }

/** Supplier share: one bar per vendor with %, value and lines; a 2 px ink marker at the cap, if any. */
export function ShareBars({ rows, cap }: { rows: ShareRow[]; cap?: number | null }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((s) => (
        <div key={s.name} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14 }}>
            <span><b>{s.name}</b> · {s.lines} line{s.lines === 1 ? "" : "s"}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{(s.pct * 100).toFixed(1)}% · {lakh(s.value)}</span>
          </span>
          <span style={{ position: "relative", display: "block", height: 10, background: "var(--color-neutral-300)", borderRadius: 2 }}>
            <span style={{ position: "absolute", inset: 0, width: `${Math.min(100, s.pct * 100)}%`, background: "var(--color-accent)", borderRadius: 2 }} />
            {cap != null && <span title={`${Math.round(cap * 100)}% cap`} style={{ position: "absolute", top: -3, bottom: -3, left: `${cap * 100}%`, width: 2, background: "var(--color-text)" }} />}
          </span>
        </div>
      ))}
      {cap != null && <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--color-neutral-700)" }}><span style={{ width: 2, height: 12, background: "var(--color-text)" }} />{Math.round(cap * 100)}% cap</span>}
    </div>
  );
}

/** Ranked magenta bars: one per item with a label, an amount and a sub-line. */
export function RankBars({ rows }: { rows: { key: string; label: string; amount: number; amountText: string; sub?: string }[] }) {
  const mx = Math.max(1, ...rows.map((r) => Math.abs(r.amount)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {rows.map((r) => (
        <div key={r.key} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14 }}>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
            <b style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{r.amountText}</b>
          </span>
          <span style={{ display: "block", height: 8, width: `${(Math.abs(r.amount) / mx) * 100}%`, minWidth: 2, background: "var(--color-accent-2)", borderRadius: 2 }} />
          {r.sub && <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>{r.sub}</span>}
        </div>
      ))}
    </div>
  );
}

/** Cost comparison: a few horizontal bars on one scale (benchmark neutral, baseline ink, this scenario accent). */
export function CostBars({ rows }: { rows: { label: string; value: number; text: string; tone: "neutral" | "ink" | "accent" }[] }) {
  const mx = Math.max(...rows.map((r) => r.value)), mn = Math.min(...rows.map((r) => r.value));
  // Start the scale a little below the smallest total so differences of a few lakh are visible; the numbers are printed.
  const lo = Math.max(0, mn - (mx - mn) * 2 - mx * 0.002), span = Math.max(1, mx - lo);
  const fill = { neutral: "var(--color-neutral-400)", ink: "var(--color-text)", accent: "var(--color-accent)" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 8, alignItems: "center", fontSize: 14 }}>
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
            <span style={{ display: "block", height: 8, width: `${Math.max(3, ((r.value - lo) / span) * 100)}%`, background: fill[r.tone], borderRadius: 2 }} />
          </span>
          <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: r.tone === "accent" ? 600 : 400 }}>{r.text}</span>
        </div>
      ))}
    </div>
  );
}
