"use client";
// L24 test scorecard: the reader's output on every dataset file, graded against the answer key.
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useReadings } from "@/components/useReadings";
import { readStamp } from "@/lib/format";
import type { Scorecard } from "@/lib/scorecard";

const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : "–");

export default function ScorecardPage() {
  const { data, state, blocked } = useReadings();
  const [sc, setSc] = useState<Scorecard | null>(null);
  const [onlyMisses, setOnlyMisses] = useState(true);
  const total = data?.replies.length ?? 0;
  const done = data ? data.replies.filter((r) => state[r.id]?.stage === "done").length : 0;

  useEffect(() => {
    if (!data || done < total || sc) return;
    const readings = data.replies.map((r) => state[r.id]?.reading).filter(Boolean);
    fetch("/api/scorecard", { method: "POST", body: JSON.stringify({ readings }) })
      .then((r) => r.json())
      .then(setSc);
  }, [data, done, total, state, sc]);

  const all = sc?.fields.reduce((a, f) => [a[0] + f.right, a[1] + f.total], [0, 0]) ?? [0, 0];
  const th = "text-left font-normal text-n-700 text-[12px] py-[4px] pr-[var(--space-4)] border-b border-rule";
  const td = "py-[4px] pr-[var(--space-4)] border-b border-rule align-top";

  return (
    <Shell>
      <div className="eyebrow">Test scorecard · L24</div>
      <h1 className="text-[40px] leading-tight mt-[6px]">How well does Parakh read?</h1>
      <p className="text-[15px] max-w-[760px] mt-[6px] text-n-800">
        The reader runs on every file in the dataset exactly as the app does, then this page grades its output against the answer key,
        field by field. The answer key is only used here, for grading. The app never reads it.
      </p>
      {blocked && <div className="mt-[var(--space-4)] p-[var(--space-3)] bg-d-100 text-[14px]">{blocked}</div>}
      {sc?.readAt && <p className="text-[13px] text-n-700 mt-[6px]">Graded readings: {readStamp({ readAt: sc.readAt, models: sc.models })} (latest).</p>}
      {data && !data.keyConfigured && done < total && <div className="mt-[var(--space-4)] p-[var(--space-3)] bg-d-100 text-[14px]">Some replies have no saved reading and no Gemini API key is set, so they cannot be read yet.</div>}
      {!sc && data?.keyConfigured && <div className="mt-[var(--space-4)] text-n-700">Reading replies: {done} of {total} done…</div>}

      {sc && (
        <>
          <div className="flex gap-[var(--space-8)] mt-[var(--space-6)] num">
            <div>
              <div className="text-[44px] leading-none">{pct(all[0], all[1])}</div>
              <div className="text-[13px] text-n-700 mt-[4px]">fields right ({all[0]} of {all[1]}) across 150 cells</div>
            </div>
            <div>
              <div className="text-[44px] leading-none">{sc.edges.filter((e) => e.ok).length} / {sc.edges.length}</div>
              <div className="text-[13px] text-n-700 mt-[4px]">planted edges caught</div>
            </div>
            <div>
              <div className="text-[44px] leading-none">{sc.failures.filter((e) => e.ok).length} / {sc.failures.length}</div>
              <div className="text-[13px] text-n-700 mt-[4px]">failure files handled</div>
            </div>
            <div>
              <div className="text-[44px] leading-none">{sc.modelCalls}</div>
              <div className="text-[13px] text-n-700 mt-[4px]">live model calls on this page (0 when all readings are saved)</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-[var(--space-8)] mt-[var(--space-8)]">
            <div>
              <h2 className="text-[20px] mb-[var(--space-2)]">By field</h2>
              <table className="w-full num text-[14px]">
                <thead><tr><th className={th}>Field</th><th className={th}>Right</th><th className={th}>Accuracy</th></tr></thead>
                <tbody>{sc.fields.map((f) => <tr key={f.field}><td className={td}>{f.field}</td><td className={td}>{f.right} / {f.total}</td><td className={td}>{pct(f.right, f.total)}</td></tr>)}</tbody>
              </table>
            </div>
            <div>
              <h2 className="text-[20px] mb-[var(--space-2)]">By vendor</h2>
              <table className="w-full num text-[14px]">
                <thead><tr><th className={th}>Vendor</th><th className={th}>Right</th><th className={th}>Accuracy</th></tr></thead>
                <tbody>{sc.byVendor.map((v) => <tr key={v.vendor}><td className={td}>{v.vendor}</td><td className={td}>{v.right} / {v.total}</td><td className={td}>{pct(v.right, v.total)}</td></tr>)}</tbody>
              </table>
            </div>
          </div>

          {[["Planted edges", sc.edges], ["Failure files", sc.failures]].map(([title, list]) => (
            <div key={title as string} className="mt-[var(--space-8)]">
              <h2 className="text-[20px] mb-[var(--space-2)]">{title as string}</h2>
              <table className="w-full text-[14px]">
                <tbody>
                  {(list as Scorecard["edges"]).map((e) => (
                    <tr key={e.name}>
                      <td className={td + " w-[60px]"}>{e.ok ? <span className="text-a-700">pass</span> : <span className="text-doubt">miss</span>}</td>
                      <td className={td}>{e.name}</td>
                      <td className={td + " text-n-700"}>{e.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <div className="mt-[var(--space-8)]">
            <div className="flex items-baseline gap-[var(--space-4)] mb-[var(--space-2)]">
              <h2 className="text-[20px]">Every cell</h2>
              <label className="text-[13px]"><input type="checkbox" checked={onlyMisses} onChange={(e) => setOnlyMisses(e.target.checked)} /> only cells with a miss</label>
            </div>
            <table className="w-full num text-[13px]">
              <thead><tr>{["Vendor", "Line", "Answer key says", "Parakh read", "Missed"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {sc.cells.filter((c) => !onlyMisses || !c.ok).map((c) => (
                  <tr key={c.vendor + c.line}>
                    <td className={td}>{c.vendor}</td><td className={td}>{c.line}</td><td className={td}>{c.expected}</td><td className={td}>{c.got}</td>
                    <td className={td + " text-doubt"}>{c.misses.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[13px] text-n-700 mt-[var(--space-6)]">Not graded yet: {sc.notYet.join("; ")}.</p>
        </>
      )}
    </Shell>
  );
}
