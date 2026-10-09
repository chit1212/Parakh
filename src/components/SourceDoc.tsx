"use client";
// L15: the original document with the exact cell, sentence, row or photo area highlighted.
// The server draws the file and code finds the place; this only renders it.
import { useEffect, useRef, useState } from "react";
import type { SourceView } from "@/lib/sourceview";
import type { SourceRef } from "@/lib/types";

const label11 = { fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--color-neutral-700)" };
const HIT = { background: "var(--color-accent-200)", boxShadow: "inset 0 0 0 2px var(--color-accent)" };

export function SourceDoc({ replyId, source, raw, lineId, filePath }: {
  replyId: string; source: SourceRef; raw: { text: string; value: number } | null; lineId: string; filePath: string | null;
}) {
  const [view, setView] = useState<SourceView | null>(null);
  const [failed, setFailed] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const key = JSON.stringify([replyId, source, raw, lineId]);

  useEffect(() => {
    let live = true;
    setView(null);
    setFailed(false);
    fetch("/api/source", { method: "POST", body: JSON.stringify({ replyId, source, valueText: raw?.text, value: raw?.value, lineId }) })
      .then((r) => r.json())
      .then((v) => live && setView(v))
      .catch(() => live && setFailed(true));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Bring the highlighted place into view inside the document box.
  useEffect(() => {
    const el = box.current?.querySelector("[data-hit]") as HTMLElement | null;
    if (el && box.current) {
      const b = box.current.getBoundingClientRect(), r = el.getBoundingClientRect();
      box.current.scrollTop += r.top - b.top - b.height / 3;
      box.current.scrollLeft += r.left - b.left - 20;
    }
  }, [view]);

  const head = (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
      <span style={{ ...label11, marginRight: "auto" }}>The original, as it arrived</span>
      {filePath && <a href={`/api/file?path=${encodeURIComponent(filePath)}`} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>Open original</a>}
    </div>
  );
  const frame = { background: "var(--color-bg)", boxShadow: "var(--shadow-sm)", maxHeight: 360, overflow: "auto" as const, position: "relative" as const };

  if (failed) return <>{head}<p style={{ margin: 0, color: "var(--color-neutral-700)" }}>The original could not be drawn here. Use “Open original”.</p></>;
  if (!view) return <>{head}<div style={{ ...frame, height: 120, padding: 12, color: "var(--color-neutral-700)" }}>Opening {source.file}…</div></>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {head}
      <div ref={box} style={frame}>
        {view.kind === "sheet" && <Sheet v={view} />}
        {view.kind === "doc" && <Doc v={view} />}
        {view.kind === "email" && <Email v={view} />}
        {view.kind === "pdf" && <Pdf v={view} />}
        {view.kind === "image" && <Photo v={view} />}
        {view.kind === "none" && <p style={{ margin: 12, color: "var(--color-neutral-700)" }}>{view.why}</p>}
      </div>
      <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{caption(view)}</span>
    </div>
  );
}

function caption(v: SourceView): string {
  switch (v.kind) {
    case "sheet": return v.hit ? `${v.file} · sheet ${v.sheet}, cell ${v.cols[v.hit.col - 1]}${v.hit.row}, outlined.` : `${v.file} · sheet ${v.sheet}. The cited cell is not on this sheet.`;
    case "doc": return `${v.file} · the row or sentence read is highlighted.`;
    case "email": return `${v.file} · the words used are highlighted.`;
    case "pdf": return v.found ? `${v.file} · page ${v.page} of ${v.pages}, the row read is highlighted.` : `${v.file} · page ${v.page} of ${v.pages}. Code could not find the cited words on this page.`;
    case "image": return v.region ? `${v.file} · the area the reader marked is boxed. Code cannot read a photo, so check it by eye.` : `${v.file} · the reader gave no area; check the row by eye.`;
    default: return v.file;
  }
}

function Sheet({ v }: { v: Extract<SourceView, { kind: "sheet" }> }) {
  const cell = { padding: "3px 6px", borderRight: "1px solid var(--color-neutral-300)", borderBottom: "1px solid var(--color-neutral-300)", whiteSpace: "nowrap" as const, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" };
  const rail = { ...cell, background: "var(--color-neutral-200)", color: "var(--color-neutral-700)", textAlign: "center" as const, fontSize: 11 };
  return (
    <table style={{ borderCollapse: "collapse", fontSize: 12, fontFamily: "var(--font-body)" }}>
      <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
        <tr><th style={rail} />{v.cols.map((c, i) => <th key={c} style={{ ...rail, fontWeight: v.hit?.col === i + 1 ? 600 : 400 }}>{c}</th>)}</tr>
      </thead>
      <tbody>
        {v.rows.map((r) => (
          <tr key={r.n}>
            <td style={{ ...rail, fontWeight: v.hit?.row === r.n ? 600 : 400 }}>{r.n}</td>
            {r.cells.map((t, i) => {
              const hit = v.hit?.row === r.n && v.hit.col === i + 1;
              return <td key={i} data-hit={hit || undefined} title={t} style={{ ...cell, ...(hit ? HIT : {}), textAlign: /^[\d.,\s]+$/.test(t) ? "right" : "left" }}>{t}</td>;
            })}
          </tr>
        ))}
      </tbody>
      <caption style={{ captionSide: "bottom", textAlign: "left", padding: "4px 6px", fontSize: 11, color: "var(--color-neutral-700)" }}>
        Sheets: {v.sheets.map((s) => (s === v.sheet ? `[${s}]` : s)).join(" · ")}
      </caption>
    </table>
  );
}

function Doc({ v }: { v: Extract<SourceView, { kind: "doc" }> }) {
  return (
    <div style={{ padding: "14px 16px", fontSize: 12.5, display: "flex", flexDirection: "column", gap: 8 }}>
      {v.blocks.map((b, i) =>
        b.type === "p" ? (
          <p key={i} data-hit={b.hit || undefined} style={{ margin: 0, ...(b.hit ? { ...HIT, padding: "2px 4px" } : {}) }}>{b.text}</p>
        ) : (
          <table key={i} style={{ borderCollapse: "collapse", fontSize: 11.5 }}>
            <tbody>
              {b.rows.map((r, ri) => (
                <tr key={ri} data-hit={r.hit || undefined} style={r.hit ? HIT : undefined}>
                  {r.cells.map((c, ci) => <td key={ci} style={{ padding: "2px 6px", borderBottom: "1px solid var(--color-neutral-300)", fontWeight: ri === 0 ? 600 : 400, whiteSpace: "nowrap" }}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        ),
      )}
    </div>
  );
}

function Email({ v }: { v: Extract<SourceView, { kind: "email" }> }) {
  return (
    <div style={{ padding: "12px 16px", fontSize: 12.5 }}>
      {v.headers.map(([k, val]) => (
        <div key={k} style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: 6 }}>
          <span style={{ color: "var(--color-neutral-700)" }}>{k}</span><span>{val}</span>
        </div>
      ))}
      <div style={{ borderTop: "1px solid var(--color-neutral-300)", marginTop: 8, paddingTop: 8 }}>
        {v.lines.map((l, i) => (
          <div key={i} data-hit={l.hit || undefined} style={{ minHeight: "1.2em", whiteSpace: "pre-wrap", ...(l.hit ? { ...HIT, padding: "0 4px" } : {}) }}>{l.text}</div>
        ))}
      </div>
    </div>
  );
}

function Pdf({ v }: { v: Extract<SourceView, { kind: "pdf" }> }) {
  return (
    <div style={{ position: "relative", width: v.width, height: v.height, background: "#fff", fontFamily: "var(--font-body)" }}>
      {v.items.map((it, i) => (
        <span key={i} data-hit={it.hit || undefined} style={{ position: "absolute", left: it.x, top: it.y, fontSize: Math.max(6, it.h * 0.95), lineHeight: 1, whiteSpace: "pre", ...(it.hit ? { background: "var(--color-accent-200)", outline: "1px solid var(--color-accent)" } : {}) }}>
          {it.str}
        </span>
      ))}
    </div>
  );
}

function Photo({ v }: { v: Extract<SourceView, { kind: "image" }> }) {
  const r = v.region;
  return (
    <div style={{ position: "relative" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/file?path=${encodeURIComponent(v.path)}`} alt={`Original: ${v.file}`} style={{ display: "block", width: "100%" }} />
      {r && (
        <span data-hit style={{ position: "absolute", left: `${r.x0 * 100}%`, top: `${r.y0 * 100}%`, width: `${(r.x1 - r.x0) * 100}%`, height: `${(r.y1 - r.y0) * 100}%`, boxShadow: "0 0 0 2px var(--color-accent), 0 0 0 9999px color-mix(in srgb, var(--color-text) 18%, transparent)" }} />
      )}
    </div>
  );
}
