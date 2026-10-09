// The free tier's rate limits: busy calls are retried, then moved to a fallback model, and the
// buyer only ever sees a calm message. Google's answers are faked here; no quota is used.
import { ApiError } from "@google/genai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const generateContent = vi.fn();
vi.mock("@/lib/ai", () => ({
  gemini: () => ({ models: { generateContent } }),
  usageOf: (model: string) => ({ model, inputTokens: 1, outputTokens: 1, thinkingTokens: 0 }),
}));
vi.mock("@/lib/config", () => ({
  FALLBACKS: { "main-model": ["backup-model"] },
  RETRY: { attempts: 3, firstDelayMs: 1, maxDelayMs: 2 },
}));

const { callStructured, QuotaError, ReaderError } = await import("@/lib/reader/call");

const Schema = z.object({ answer: z.string() });
const busy = () => new ApiError({ status: 503, message: '{"error":{"code":503,"message":"This model is currently experiencing high demand."}}' });
const daily = () => new ApiError({ status: 429, message: '{"error":{"code":429,"details":[{"violations":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}]}}' });
const ok = (text: string, model = "main-model") => ({ text, modelVersion: model, candidates: [{ finishReason: "STOP" }], usageMetadata: {} });

const call = (onWait?: (s: number) => void) =>
  callStructured({ step: "test", model: "main-model", system: "s", content: [{ text: `t${Math.random()}` }], schema: Schema, effort: "low", maxTokens: 100, fresh: true, onWait });

beforeEach(() => {
  generateContent.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("calm handling of the free tier", () => {
  it("retries a busy model and succeeds", async () => {
    generateContent.mockRejectedValueOnce(busy()).mockResolvedValueOnce(ok('{"answer":"yes"}'));
    const waits: number[] = [];
    const r = await call((s) => waits.push(s));
    expect(r.data.answer).toBe("yes");
    expect(r.model).toBe("main-model");
    expect(waits).toHaveLength(1);
  });

  it("moves to the fallback model when the main one stays busy, and records which model answered", async () => {
    generateContent.mockImplementation(async ({ model }: { model: string }) => {
      if (model === "main-model") throw busy();
      return ok('{"answer":"from backup"}', "backup-model");
    });
    const r = await call();
    expect(r.model).toBe("backup-model");
    expect(generateContent.mock.calls.filter(([a]) => a.model === "main-model")).toHaveLength(3);
  });

  it("gives up with a calm message, never the raw error", async () => {
    generateContent.mockRejectedValue(busy());
    const e = await call().catch((x) => x);
    expect(e).toBeInstanceOf(QuotaError);
    expect(e.message).toBe("The free AI quota is busy right now. Try again in a minute.");
    expect(e.message).not.toMatch(/503|error|high demand/i);
  });

  it("does not keep retrying when today's quota is used up", async () => {
    generateContent.mockRejectedValue(daily());
    const e = await call().catch((x) => x);
    expect(e).toBeInstanceOf(QuotaError);
    expect(e.daily).toBe(true);
    expect(generateContent).toHaveBeenCalledTimes(2); // one try per model, no retries
  });

  it("rejects an answer that does not match the schema", async () => {
    generateContent.mockResolvedValue(ok('{"something_else":1}'));
    const e = await call().catch((x) => x);
    expect(e).toBeInstanceOf(ReaderError);
    expect(e).not.toBeInstanceOf(QuotaError);
  });
});
