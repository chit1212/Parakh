// One structured model call: JSON out against a schema, checked again in code, usage counted,
// result cached by content hash, retried with backoff when the free tier is busy.
import { ThinkingLevel, type Part } from "@google/genai";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { gemini, usageOf, withBackoff, type Usage } from "../ai";

const CACHE_DIR = process.env.VERCEL ? path.join(os.tmpdir(), "parakh-cache") : path.join(process.cwd(), ".cache", "readings");

export function hashOf(...parts: (string | Buffer)[]): string {
  const h = crypto.createHash("sha256");
  for (const p of parts) h.update(p);
  return h.digest("hex").slice(0, 24);
}

async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(CACHE_DIR, key + ".json"), "utf8")) as T;
  } catch {
    return null;
  }
}

async function cachePut(key: string, value: unknown) {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(path.join(CACHE_DIR, key + ".json"), JSON.stringify(value));
  } catch {
    // A read-only disk only costs us the cache.
  }
}

export class ReaderError extends Error {}

const LEVEL = { minimal: ThinkingLevel.MINIMAL, low: ThinkingLevel.LOW, medium: ThinkingLevel.MEDIUM, high: ThinkingLevel.HIGH } as const;

export interface CallResult<T> {
  data: T;
  model: string;
  usage: Usage | null; // null when served from cache
  cached: boolean;
  ms: number;
}

/** The JSON schema Gemini is held to, from the same zod schema code checks the answer with. */
export function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const s = z.toJSONSchema(schema) as Record<string, unknown>;
  delete s.$schema;
  return s;
}

export async function callStructured<S extends z.ZodType>(opts: {
  step: string;
  model: string;
  system: string;
  content: Part[];
  schema: S;
  effort: "minimal" | "low" | "medium" | "high";
  maxTokens: number;
  /** Ask for the content again even if a cached answer exists. */
  fresh?: boolean;
  /** Called before any live model call (not for cache hits); throw to refuse it. */
  beforeCall?: () => void;
}): Promise<CallResult<z.infer<S>>> {
  const key = `${opts.step}-${hashOf(opts.model, opts.effort, opts.system, JSON.stringify(opts.content))}`;
  const t0 = Date.now();
  if (!opts.fresh) {
    const hit = await cacheGet<z.infer<S>>(key);
    if (hit) return { data: hit, model: opts.model, usage: null, cached: true, ms: Date.now() - t0 };
  }

  opts.beforeCall?.();
  const res = await withBackoff(() =>
    gemini().models.generateContent({
      model: opts.model,
      contents: [{ role: "user", parts: opts.content }],
      config: {
        systemInstruction: opts.system,
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchemaOf(opts.schema),
        thinkingConfig: { thinkingLevel: LEVEL[opts.effort] },
        maxOutputTokens: opts.maxTokens,
      },
    }),
  );
  const cand = res.candidates?.[0];
  const finish = cand?.finishReason ?? res.promptFeedback?.blockReason;
  if (finish === "MAX_TOKENS") throw new ReaderError(`The reply was too long to read in one pass (${opts.step}).`);
  if (finish && finish !== "STOP") throw new ReaderError(`The AI declined to read this (${opts.step}: ${String(finish).toLowerCase()}).`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(res.text ?? "");
  } catch {
    throw new ReaderError(`The AI's answer was not in the expected format (${opts.step}).`);
  }
  // Structured output is a request, not a guarantee: code checks the shape again.
  const ok = opts.schema.safeParse(parsed);
  if (!ok.success) throw new ReaderError(`The AI's answer did not match the expected format (${opts.step}).`);
  await cachePut(key, ok.data);
  const model = res.modelVersion ?? opts.model;
  return { data: ok.data as z.infer<S>, model, usage: usageOf(model, res.usageMetadata), cached: false, ms: Date.now() - t0 };
}
