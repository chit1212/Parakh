// Three levels of assurance on every price (review fix 2.4): read by AI; matched to the source by
// code (the same number found in the file's text layer or cell); approved by the buyer, with name
// and time. Photos have no text layer, so they stay "read by AI" until the buyer checks them.
import { LinkSimple, SealCheck, Sparkle } from "@phosphor-icons/react";
import type { GridCell } from "@/lib/compare";

export type Assurance = "ai" | "matched" | "verified";

export const assuranceOf = (c: Pick<GridCell, "norm">, approved: boolean): Assurance =>
  approved ? "verified" : c.norm.verification?.status === "verified" ? "matched" : "ai";

const META: Record<Assurance, { label: string; cls: string; Icon: typeof Sparkle; what: string }> = {
  ai: { label: "Read by AI", cls: "tag tag-outline", Icon: Sparkle, what: "Extracted, not yet matched. Photos stay here until you check them." },
  matched: { label: "Matched to source", cls: "tag tag-neutral", Icon: LinkSimple, what: "Code found the same number in the file’s text." },
  verified: { label: "Approved by you", cls: "tag tag-accent", Icon: SealCheck, what: "You checked it; name and time recorded." },
};

export function AssuranceBadge({ level, explain }: { level: Assurance; explain?: boolean }) {
  const m = META[level];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span className={m.cls} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><m.Icon size={14} weight="duotone" />{m.label}</span>
      {explain && <span style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>{m.what}</span>}
    </span>
  );
}
