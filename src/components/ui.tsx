// Readability pass v2: the shared building blocks every screen uses (design: Target Screens v2).
// A 15 px meta line over a 30 px title; up to four key-number cards; the working table on a raised sheet.

export function PageHead({ meta, title, children, beside }: { meta: React.ReactNode; title: React.ReactNode; children?: React.ReactNode; beside?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginRight: "auto", minWidth: 0 }}>
        <span style={{ fontSize: 15, color: "var(--color-neutral-700)" }}>{meta}</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 24, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 30, fontWeight: 600, lineHeight: 1.15, margin: 0 }}>{title}</h1>
          {beside}
        </div>
      </div>
      {children}
    </div>
  );
}

export interface Kpi { label: string; value: React.ReactNode; sub?: React.ReactNode; doubt?: boolean; onClick?: () => void; title?: string }

export function Kpis({ items }: { items: Kpi[] }) {
  return (
    <div className="kpis" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}>
      {items.map((k) => (
        <div key={k.label} className={`kpi${k.doubt ? " kpi-doubt" : ""}`} title={k.title} onClick={k.onClick} role={k.onClick ? "button" : undefined}
          style={k.onClick ? { cursor: "pointer" } : undefined}>
          <span className="k-label">{k.label}</span>
          <span className="k-value">{k.value}</span>
          {k.sub && <span className="k-sub">{k.sub}</span>}
        </div>
      ))}
    </div>
  );
}

/** A tab beside a title: 17 px, 3 px accent underline when active. */
export const tabStyle = (on: boolean): React.CSSProperties => ({
  whiteSpace: "nowrap", background: "none", border: 0, padding: "4px 0 6px", font: "inherit", fontSize: 17, cursor: "pointer",
  color: on ? "var(--color-text)" : "var(--color-neutral-800)", fontWeight: on ? 600 : 400, boxShadow: on ? "inset 0 -3px 0 var(--color-accent)" : "none",
});

/** The quality result in one label, everywhere: "Quality 90/100 ✓", "Quality 20/100 ✕" or "Quality: not returned". */
export function QualityLabel({ returned, score, cleared, style }: { returned: boolean; score: number | null | undefined; cleared: boolean; style?: React.CSSProperties }) {
  if (!returned || score == null) return <span style={style}>Quality: not returned</span>;
  return (
    <span style={{ whiteSpace: "nowrap", ...style }}>
      Quality {score}/100{" "}
      <span style={{ color: cleared ? "var(--color-accent-700)" : "var(--color-accent-2-700)", fontWeight: 700 }} aria-label={cleared ? "cleared" : "not cleared"}>{cleared ? "✓" : "✕"}</span>
    </span>
  );
}
