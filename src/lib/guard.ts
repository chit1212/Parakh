// A simple per-visitor limit on model calls, so a public link cannot use up the free Gemini quota.
// Raised for the test round (was 12 per hour, 150 a day); lower again once testing is done.
// In memory per server instance: enough for a demo, not a billing system.
const HOUR = 3_600_000;
const PER_VISITOR_PER_HOUR = Number(process.env.PARAKH_CALLS_PER_HOUR ?? 200);
const ALL_VISITORS_PER_DAY = Number(process.env.PARAKH_CALLS_PER_DAY ?? 600);

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
      throw new RateLimitedError("This demo has reached its live reading limit for today. Saved readings still show.");
    if (mine.length >= PER_VISITOR_PER_HOUR)
      throw new RateLimitedError("You have reached this demo's live reading limit for the hour. Saved readings still show; try again later.");
    mine.push(now);
    day.push(now);
    byVisitor.set(visitor, mine);
  };
}
