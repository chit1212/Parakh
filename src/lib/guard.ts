// A simple per-visitor limit on live model calls, so a public link cannot use up the free AI quota.
// In memory per server instance: enough for a demo, not a billing system.
const HOUR = 3_600_000;
// A live reading is about 3 calls. The demo opens with saved readings, so these only meter
// uploads, "Read again live" and chat questions.
const PER_VISITOR_PER_HOUR = Number(process.env.PARAKH_CALLS_PER_HOUR ?? 15);
const ALL_VISITORS_PER_DAY = Number(process.env.PARAKH_CALLS_PER_DAY ?? 200);

const byVisitor = new Map<string, number[]>();
let day: number[] = [];

export class RateLimitedError extends Error {
  constructor(msg: string) {
    super(msg);
  }
}

export function visitorOf(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip") || "local";
}

/** Returns a function that records one model call for this visitor, or throws if over the limit. */
export function callBudget(visitor: string): () => void {
  return () => {
    const now = Date.now();
    day = day.filter((t) => now - t < 24 * HOUR);
    const mine = (byVisitor.get(visitor) ?? []).filter((t) => now - t < HOUR);
    if (day.length >= ALL_VISITORS_PER_DAY)
      throw new RateLimitedError("This demo has used its live AI allowance for today. Saved readings still show; live reading works again tomorrow.");
    if (mine.length >= PER_VISITOR_PER_HOUR)
      throw new RateLimitedError("You have used this demo's live AI allowance for the hour. Saved readings still show; try again later.");
    mine.push(now);
    day.push(now);
    byVisitor.set(visitor, mine);
  };
}
