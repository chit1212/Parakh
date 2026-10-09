import { ApiError } from "@google/genai";
import { describe, expect, it } from "vitest";
import { calmMessage, QuotaBusyError, withBackoff } from "@/lib/ai";
import { jsonSchemaOf } from "@/lib/reader/call";
import { Extraction } from "@/lib/reader/schemas";

const busy = (msg = '{"retryDelay": "0s"}') => new ApiError({ message: msg, status: 429 });

describe("free-tier backoff", () => {
  it("retries a per-minute limit and then succeeds", async () => {
    let n = 0;
    const out = await withBackoff(async () => {
      if (++n < 3) throw busy();
      return "ok";
    });
    expect(out).toBe("ok");
    expect(n).toBe(3);
  });

  it("gives up with a calm message after the last try", async () => {
    await expect(withBackoff(async () => { throw busy(); }, { tries: 2 })).rejects.toThrow(QuotaBusyError);
  });

  it("does not wait out a daily quota", async () => {
    let n = 0;
    const p = withBackoff(async () => { n++; throw busy("Quota exceeded for metric: GenerateRequestsPerDayPerProjectPerModel-FreeTier"); });
    await expect(p).rejects.toThrow(/Today's free AI quota/);
    expect(n).toBe(1);
  });

  it("never passes a raw API error to the buyer", () => {
    const raw = new ApiError({ message: '{"error":{"code":500,"message":"internal stack trace"}}', status: 500 });
    const shown = calmMessage(raw);
    expect(shown).not.toMatch(/stack|500|error":/);
  });
});

describe("structured output schema", () => {
  it("is plain JSON schema with no $schema header", () => {
    const s = jsonSchemaOf(Extraction);
    expect(s.$schema).toBeUndefined();
    expect(s.type).toBe("object");
  });
});
