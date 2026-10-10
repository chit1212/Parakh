"use client";
// RFQ → Evaluation rules (design: Shared Screens #rules). How replies are read, converted, checked
// and scored. The quality marking is the buyer's to change (directly, or in plain words drafted by
// the AI and checked by code); the rest is shown as the code applies it for this event.
import { useMemo, useState } from "react";
import { LockSimple, LockSimpleOpen, Sparkle } from "@phosphor-icons/react";
import type { Grid } from "@/lib/compare";
import { USD_REFERENCE, SHOULD_COST } from "@/lib/config";
import type { DoubtReport } from "@/lib/doubts";
import { qualityOf } from "@/lib/quality";
import { DEFAULT_SCHEME, markingText, schemeProblems, type MarkRule, type QualityScheme } from "@/lib/qualityScheme";
import type { ReplyReading } from "@/lib/reader/pipeline";
import type { SourcingEvent } from "@/lib/types";
import { useScheme } from "./useScheme";

const label11 = { fontSize: 16, color: "var(--color-neutral-700)" };
const QCOLS = "30px minmax(0,1.3fr) 100px minmax(0,1.6fr) 70px";
const RCOLS = "minmax(0,1.2fr) minmax(0,1.5fr) 160px";
const rowRule = "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)";

/** New points for a question, with its bands and bonuses scaled to match (whole points). */
function withPoints(r: MarkRule, points: number): MarkRule {
  const k = r.points ? points / r.points : 0;
  const sc = (n: number) => Math.min(points, Math.round(n * k));
  return { ...r, points, ...(r.bands ? { bands: r.bands.map((b) => ({ ...b, pts: sc(b.pts) })) } : {}), ...(r.bonus ? { bonus: r.bonus.map((b) => ({ ...b, pts: sc(b.pts) })) } : {}) };
}

function Section({ title, tag, tagCls, note, children }: { title: string; tag: string; tagCls: string; note: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: 20, margin: 0 }}>{title}</h3>
        <span className={tagCls}>{tag}</span>
        <span style={{ color: "var(--color-neutral-700)", fontSize: 14 }}>{note}</span>
      </div>
      {children}
    </section>
  );
}

function Rule({ name, how, val, used, locked }: { name: string; how: string; val: string; used: string; locked?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: RCOLS, gap: "0 16px", alignItems: "center", padding: "8px 0", borderBottom: rowRule }}>
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}><span style={{ fontWeight: 600 }}>{name}</span><span style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>{how}</span></span>
      <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-neutral-800)" }}>{locked && <LockSimple weight="duotone" color="var(--color-neutral-600)" />}{val}</span>
      <span style={{ fontSize: 14, color: "var(--color-neutral-700)", textAlign: "right" }}>{used}</span>
    </div>
  );
}

export function EvaluationRules({ ev, grid, readings, report }: { ev: SourcingEvent; grid: Grid; readings: ReplyReading[]; report: DoubtReport }) {
  const [scheme, saveScheme] = useScheme();
  // Direct edits stay a draft until they add up; the comparison only ever uses a valid scheme.
  const [edit, setEdit] = useState<QualityScheme | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<{ reply: string; proposal: QualityScheme | null; changed?: string[]; model?: string } | { error: string } | null>(null);
  const ids = ev.questions.map((q) => q.id);
  const shown = edit ?? scheme;
  const problems = schemeProblems(shown, ids);

  const scores = (s: QualityScheme) => ev.vendors.map((v) => ({ v, q: qualityOf(ev, v.id, readings, s) }));
  const now = useMemo(() => scores(scheme), [scheme, readings]); // eslint-disable-line react-hooks/exhaustive-deps
  const effect = (s: QualityScheme) => scores(s).map(({ v, q }, i) => ({ v, q, was: now[i].q }));
  const scoreLine = (rows: ReturnType<typeof effect>) => rows.map(({ v, q, was }) => (
    <span key={v.id} style={{ whiteSpace: "nowrap" }}>
      {v.short} {q.returned ? <><b>{q.score}</b>{was.score !== q.score && <span style={{ color: "var(--color-neutral-700)" }}> (was {was.score})</span>} {q.cleared ? "✓" : "✕"}</> : "not returned"}
      {was.cleared !== q.cleared && <b style={{ color: "var(--color-accent-2-800)" }}> {q.cleared ? "now clears" : "no longer clears"}</b>}
    </span>
  ));

  const change = (s: QualityScheme) => {
    setEdit(s);
    if (!schemeProblems(s, ids).length) { saveScheme(s); setEdit(null); }
  };
  const draft = async () => {
    setBusy(true); setAi(null);
    try {
      const r = await fetch("/api/rules", { method: "POST", body: JSON.stringify({ text, scheme }) });
      setAi(await r.json());
    } catch {
      setAi({ error: "The rule could not be drafted just now. Nothing was changed; try again in a minute." });
    } finally { setBusy(false); }
  };

  // How many prices each conversion touched, from the grid as read.
  const cells = Object.values(grid.cells).filter((c) => c.perBox != null);
  const by = (t: (c: (typeof cells)[number]) => boolean) => {
    const hit = cells.filter(t);
    const vs = [...new Set(hit.map((c) => grid.vendors.find((v) => v.id === c.vendorId)?.short))];
    return hit.length ? `${hit.length} prices · ${vs.join(", ")}` : "none in this event";
  };
  const unusual = cells.filter((c) => c.band).length;
  const freightUnknown = grid.vendors.filter((v) => v.basis?.freightUnknown).map((v) => v.short);
  const withPrint = grid.lines.filter((l) => l.colours > 0).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26, maxWidth: 1000 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "var(--color-neutral-800)" }}>
        <LockSimpleOpen size={18} weight="duotone" color="var(--color-neutral-700)" style={{ flex: "none", marginTop: 2 }} />
        <span>How replies are read, converted, checked and scored. Rules lock when the RFQ is sent; changes after that need a reason and are shown to the VP. <b>Shared</b> rules go to vendors with the RFQ; <b>internal</b> ones never do. In this demo the RFQ is already out, so a change to the marking applies to the comparison at once and is labelled.</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "var(--color-surface)", padding: "14px 16px" }}>
        <span style={{ ...label11, color: "var(--color-accent-700)" }}>Change the quality marking in plain words</span>
        <form style={{ display: "flex", gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (text.trim() && !busy) draft(); }}>
          <input className="input" style={{ background: "var(--color-bg)" }} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Score rejection rate out of 25, full marks at 0.5% or less" />
          <button className="btn btn-primary" type="submit" disabled={busy || !text.trim()} style={{ whiteSpace: "nowrap" }}><Sparkle size={16} weight="duotone" />{busy ? "Drafting…" : "Draft rule"}</button>
        </form>
        <span style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>Parakh drafts the rule; code checks it and runs it. You see the rule and its effect before it applies.</span>
        {ai && ("error" in ai ? <span>{ai.error}</span> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "var(--color-bg)", padding: "10px 12px", boxShadow: "var(--shadow-sm)" }}>
            <span><span style={{ ...label11, color: "var(--color-accent-700)" }}>Parakh{ai.model ? <span style={{ color: "var(--color-neutral-500)", textTransform: "none", letterSpacing: 0 }}> · {ai.model}</span> : null}</span><br />{ai.reply}</span>
            {ai.proposal && (
              <>
                {ai.proposal.rules.filter((r) => ai.changed?.includes(r.id)).map((r) => {
                  const was = scheme.rules.find((x) => x.id === r.id)!;
                  return (
                    <div key={r.id} style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 8, fontSize: 14 }}>
                      <b>{r.id}</b>
                      <span><span style={{ color: "var(--color-neutral-700)", textDecoration: "line-through" }}>{markingText(was)} ({was.points} pts)</span><br />{markingText(r)} ({r.points} pts)</span>
                    </div>
                  );
                })}
                {ai.proposal.passMark !== scheme.passMark && <span style={{ fontSize: 14 }}>Pass mark {scheme.passMark} → {ai.proposal.passMark}</span>}
                <span style={{ fontSize: 14, display: "flex", flexWrap: "wrap", gap: "2px 14px" }}><span style={{ color: "var(--color-neutral-700)" }}>Effect, marked by code:</span>{scoreLine(effect(ai.proposal))}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-primary" onClick={() => { saveScheme({ ...ai.proposal!, rules: ai.proposal!.rules.map((r) => (ai.changed?.includes(r.id) ? { ...r, changedByChat: true } : { ...r, changedByChat: scheme.rules.find((x) => x.id === r.id)?.changedByChat })) }); setAi(null); setText(""); setEdit(null); }}>Apply this rule</button>
                  <button className="btn btn-secondary" onClick={() => setAi(null)}>Discard</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <Section title="Quality score" tag="Shared with vendors" tagCls="tag tag-accent" note="Sent with the questionnaire, so every vendor knows how they will be marked.">
        <div style={{ display: "grid", gridTemplateColumns: QCOLS, gap: "0 12px", ...label11, letterSpacing: "0.06em", padding: "6px 0", borderBottom: "1px solid var(--color-text)" }}>
          <span>#</span><span>Question</span><span>Type</span><span>Marking</span><span style={{ textAlign: "right" }}>Points</span>
        </div>
        {shown.rules.map((r, i) => {
          const q = ev.questions.find((x) => x.id === r.id);
          return (
            <div key={r.id} style={{ display: "grid", gridTemplateColumns: QCOLS, gap: "0 12px", alignItems: "center", padding: "5px 0", borderBottom: rowRule, background: r.changedByChat ? "var(--color-accent-100)" : "transparent" }}>
              <span style={{ color: "var(--color-neutral-700)" }}>{r.id}</span>
              <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>{q?.text ?? r.id}{r.changedByChat && <span style={{ fontSize: 13, color: "var(--color-accent-800)" }}>changed by chat</span>}</span>
              <span style={{ color: r.mandatory ? "var(--color-accent-2-800)" : "var(--color-text)", fontWeight: r.mandatory ? 600 : 400 }}>{r.mandatory ? "Mandatory" : "Scored"}</span>
              <span style={{ fontSize: 14, color: "var(--color-neutral-800)" }}>{markingText(r)}</span>
              <input className="input" aria-label={`Points for ${r.id}`} inputMode="numeric" style={{ minHeight: 30, padding: "3px 8px", fontSize: 15, textAlign: "right" }} value={r.points}
                onChange={(e) => change({ ...shown, rules: shown.rules.map((x, j) => (j === i ? withPoints(scheme.rules.find((y) => y.id === x.id) ?? x, Number(e.target.value.replace(/[^\d]/g, "")) || 0) : x)) })} />
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 28, alignItems: "center", paddingTop: 8, flexWrap: "wrap" }}>
          <span><b>{shown.rules.reduce((a, r) => a + r.points, 0)}</b> points in total</span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>Pass mark
            <input className="input" aria-label="Pass mark" inputMode="numeric" style={{ width: 64, minHeight: 30, padding: "3px 8px", textAlign: "right" }} value={shown.passMark}
              onChange={(e) => change({ ...shown, passMark: Number(e.target.value.replace(/[^\d]/g, "")) || 0 })} />
          </span>
          <span style={{ color: "var(--color-neutral-800)" }}>Cleared = both mandatory items pass <em>and</em> score ≥ pass mark. Not returned = not cleared.</span>
          {(scheme !== DEFAULT_SCHEME || edit) && <button className="btn btn-ghost" onClick={() => { saveScheme(null); setEdit(null); }}>Reset to Parakh’s draft</button>}
        </div>
        {problems.length > 0 && <span style={{ color: "var(--color-accent-2-800)" }}>Not applied yet: {problems.join(" ")}</span>}
        <span style={{ fontSize: 14, display: "flex", flexWrap: "wrap", gap: "2px 14px", paddingTop: 2 }}><span style={{ color: "var(--color-neutral-700)" }}>Today’s replies, marked by code:</span>{scoreLine(effect(scheme))}</span>
      </Section>

      <Section title="Price basis" tag="Shared with vendors" tagCls="tag tag-accent" note="Every reply is brought onto this basis before comparing.">
        <Rule name="Unit and currency" how="What every price in the comparison means." val="₹ per box" used={`all ${cells.length} prices`} />
        <Rule name="Delivery and tax" how="Freight included; GST shown separately." val="Delivered Chakan · GST extra" used={`all ${cells.length} prices`} />
      </Section>

      <Section title="Conversions" tag="Internal" tagCls="tag tag-neutral" note="Applied by code when a reply ignores the basis. Every converted price shows its sum.">
        <Rule name="Foreign currency" how="Rate is looked up, never read from the vendor’s document. Conditional discounts are kept apart and raised as doubts." val={`USD at ₹${USD_REFERENCE.rate} (reference, ${USD_REFERENCE.date})`} used={by((c) => c.norm.flags.some((f) => f.startsWith("quoted in USD")))} />
        <Rule name="Per 100 pieces" how="Divide down; add freight and handling quoted in the same unit." val="(price + freight) ÷ 100" used={by((c) => /per 100/.test(c.norm.asWritten))} />
        <Rule name="Per kg" how={`Box weight = blank area × board GSM (flutes B ${SHOULD_COST.fluteTakeUp.B} · C ${SHOULD_COST.fluteTakeUp.C} · E ${SHOULD_COST.fluteTakeUp.E}) × ${SHOULD_COST.weightAllowance}.`} val="weight × rate" used={by((c) => c.norm.asWritten.endsWith("/kg"))} />
        <Rule name="“Freight extra”" how="Never estimated silently: compared before freight, and raised as a doubt if it could change a winner." val="Not added; asked of the vendor" used={freightUnknown.length ? freightUnknown.join(", ") : "none in this event"} />
        <Rule name="“Same as last year”" how="Taken from the last awarded event and labelled as last year’s price." val={`${ev.lyEventId}`} used={by((c) => c.kind === "last_year")} />
      </Section>

      <Section title="Should-cost" tag="Internal · never sent" tagCls="tag tag-neutral" note="A sanity check, not a target. Prices outside the band get an ↑ or ↓.">
        <Rule name="Board rate" how="Finished box, per kg, by ply." val={Object.entries(SHOULD_COST.ratePerKg).map(([p, r]) => `${p}-ply ₹${r}/kg`).join(" · ")} used={`all ${grid.lines.length} lines`} />
        <Rule name="Print add-on" how="Per box, per colour." val={`₹${SHOULD_COST.printFixedPerColour} + ₹${SHOULD_COST.printPerM2PerColour}/m² per colour`} used={`${withPrint} lines`} />
        <Rule name="Band" how="How far a price may sit from should-cost before it is marked unusual." val={`± ${Math.round(SHOULD_COST.band * 100)}%`} used={`${unusual} prices outside today`} />
      </Section>

      <Section title="Doubts" tag="Company default" tagCls="tag tag-outline" note="Set by procurement for every event. Read-only here.">
        <Rule locked name="When to interrupt" how="Raise a doubt only if it could change who wins a line; log the rest." val="Could change a winner" used={`${report.raised.length} raised · ${report.logged.length} logged`} />
        <Rule locked name="Rupees at stake" how="Used to rank the doubt queue." val="quantity × (other reading − as read)" used={`${report.raised.length} doubts`} />
        <Rule locked name="No source, no entry" how="A number code cannot find in the file never enters the comparison." val="Raise as doubt, route to vendor" used={`${report.raised.concat(report.logged).filter((d) => d.kind === "source_failed").length} today`} />
        <Rule locked name="Spec does not match" how="e.g. 3-ply offered where 5-ply was asked." val="Raise as doubt, route to you" used={`${report.raised.concat(report.logged).filter((d) => d.kind === "substitute_spec").length} today`} />
      </Section>
    </div>
  );
}
