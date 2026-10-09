// One structured model call: strict JSON out (a JSON schema), checked again in code,
// retried calmly on the free tier's rate limits, result cached by content hash.
import { ApiError, ThinkingLevel, type Part } from "@google/genai";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { gemini, usageOf, type Usage } from "../ai";
import { FALLBACKS, RETRY } from "../config";

const CACHE_DIR = process.env.VERCEL ? path.join(os.tmpdir(), "parakh-cache") : path.join(process.cwd(), ".cache", "readings");

export function hashOf(...parts: (string | Buffer)[]): string {
  const h = crypto.createHash("sha256");
  for (const p of parts) h.update(p);
  return h.digest("hex").slice(0, 24);
}

/** What the cache keeps: the answer, which model gave it, and when. */
interface Cached<T> {
  data: T;
  model: string;
  at: string;
}

async function cacheGet<T>(key: string): Promise<Cached<T> | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(CACHE_DIR, key + ".json"), "utf8")) as Cached<T>;
  } catch {
    return null;
  }
}

async function cachePut(key: string, value: Cached<unknown>) {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(path.join(CACHE_DIR, key + ".json"), JSON.stringify(value));
  } catch {
    // A read-only disk only costs us the cache.
  }
}

export class ReaderError extends Error {}

/** The free quota is busy or used up. The message is written for the buyer, never a raw API error. */
export class QuotaError extends ReaderError {
  constructor(readonly daily: boolean) {
    super(
      daily
        ? "The free AI quota for today is used up. Saved readings still show; live reading comes back tomorrow."
        : "The free AI quota is busy right now. Try again in a minute.",
    );
  }
}

export interface CallResult<T> {
  data: T;
  usage: Usage | null; // null when served from cache
  cached: boolean;
  /** The model that actually answered (a fallback if the first choice was busy). */
  model: string;
  /** When the model answered. */
  at: string;
  ms: number;
}

/** A JSON schema Gemini accepts, generated from the same zod schema code validates against. */
function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const js = z.toJSONSchema(schema) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

const LEVEL = { low: ThinkingLevel.LOW, medium: ThinkingLevel.MEDIUM, high: ThinkingLevel.HIGH } as const;

/** Reads Google's error body: is this a rate limit, a daily cap, and how long does it ask us to wait? */
function classifyError(e: unknown): { retry: boolean; daily: boolean; waitMs: number | null } {
  if (!(e instanceof ApiError)) return { retry: false, daily: false, waitMs: null };
  const busy = e.status === 429 || e.status === 503 || e.status === 500;
  const msg = e.message ?? "";
  // Google names the limit hit; it is the daily one only if every named limit is per day.
  const ids = [...msg.matchAll(/"quotaId"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
  const daily = e.status === 429 && (ids.length ? ids.every((id) => /PerDay/i.test(id)) : /per day|daily/i.test(msg));
  const delay = msg.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return { retry: busy && !daily, daily, waitMs: delay ? Number(delay[1]) * 1000 : null };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function callStructured<S extends z.ZodType>(opts: {
  step: string;
  model: string;
  system: string;
  content: Part[];
  schema: S;
  effort: "low" | "medium" | "high";
  maxTokens: number;
  /** Ask for the content again even if a cached answer exists. */
  fresh?: boolean;
  /** Called before any model call (not for cache hits); throw to refuse it. */
  beforeCall?: () => void;
  /** Told when a call is waiting on the rate limit, so the screen can say so. */
  onWait?: (seconds: number) => void;
}): Promise<CallResult<z.infer<S>>> {
  const key = `${opts.step}-${hashOf("gemini-v1", opts.model, opts.effort, opts.system, JSON.stringify(opts.content))}`;
  const t0 = Date.now();
  if (!opts.fresh) {
    const hit = await cacheGet<z.infer<S>>(key);
    if (hit) return { data: hit.data, usage: null, cached: true, model: hit.model, at: hit.at, ms: Date.now() - t0 };
  }

  opts.beforeCall?.();
  const models = [opts.model, ...(FALLBACKS[opts.model] ?? [])];
  let busy = false; // any model was only busy, not out of quota for the day
  for (const model of models) {
    if (isUsedUp(model)) continue;
    let delay: number = RETRY.firstDelayMs;
    for (let attempt = 1; attempt <= RETRY.attempts; attempt++) {
      try {
        const res = await gemini().models.generateContent({
          model,
          contents: [{ role: "user", parts: opts.content }],
          config: {
            systemInstruction: opts.system,
            responseMimeType: "application/json",
            responseJsonSchema: jsonSchemaOf(opts.schema),
            maxOutputTokens: opts.maxTokens,
            // Flash-Lite models answer without a thinking step.
            ...(model.includes("lite") ? {} : { thinkingConfig: { thinkingLevel: LEVEL[opts.effort] } }),
          },
        });
        const finish = res.candidates?.[0]?.finishReason;
        if (res.promptFeedback?.blockReason || finish === "SAFETY" || finish === "PROHIBITED_CONTENT")
          throw new ReaderError(`The model declined to read this (${opts.step}).`);
        if (finish === "MAX_TOKENS") throw new ReaderError(`The reply was too long to read in one pass (${opts.step}).`);
        let json: unknown;
        try {
          json = JSON.parse(res.text ?? "");
        } catch {
          throw new ReaderError(`The model's answer was not valid JSON (${opts.step}).`);
        }
        // The schema is enforced by the API, and checked again here: nothing unshaped gets through.
        const parsed = opts.schema.safeParse(json);
        if (!parsed.success) throw new ReaderError(`The model's answer did not match the expected format (${opts.step}).`);
        const at = new Date().toISOString();
        const answered = res.modelVersion ?? model;
        await cachePut(key, { data: parsed.data, model: answered, at });
        return { data: parsed.data, usage: usageOf(answered, res.usageMetadata), cached: false, model: answered, at, ms: Date.now() - t0 };
      } catch (e) {
        const c = classifyError(e);
        if (c.daily) {
          markUsedUp(model);
          break; // this model's day is used up; a fallback has its own quota
        }
        busy = true;
        // Server log only (never shown to the buyer): which model refused, and how.
        console.warn(`[gemini] ${opts.step} ${model} attempt ${attempt}: ${e instanceof ApiError ? e.status : "error"} ${(e as Error).message.slice(0, 120)}`);
        if (!c.retry) throw e instanceof ReaderError ? e : new ReaderError(`Reading failed (${opts.step}): ${(e as Error).message.slice(0, 200)}`);
        if (attempt === RETRY.attempts) break;
        const wait = Math.min(c.waitMs ?? delay, RETRY.maxDelayMs);
        opts.onWait?.(Math.round(wait / 1000));
        await sleep(wait);
        delay = Math.min(delay * 2, RETRY.maxDelayMs);
      }
    }
  }
  throw new QuotaError(!busy);
}

/**
 * Run any model call with the same free-tier handling as the reader: retry with backoff on busy or
 * per-minute limits, fall back to the next model, then a calm QuotaError. Used by the analyst chat.
 */
/** Models whose free daily quota ran out, with the day it happened (UTC); skipped until the next day. */
const usedUp = new Map<string, string>();
const today = () => new Date().toISOString().slice(0, 10);
export const isUsedUp = (m: string) => usedUp.get(m) === today();
export const markUsedUp = (m: string) => {
  console.warn(`[gemini] ${m}: free daily quota used up; skipped until tomorrow (UTC)`);
  usedUp.set(m, today());
};
/** Tests only. */
export const resetUsedUp = () => usedUp.clear();

export async function withModels<T>(step: string, first: string, fn: (model: string) => Promise<T>, onWait?: (s: number) => void): Promise<{ value: T; model: string }> {
  let busy = false; // any model was only busy, not out of quota for the day
  for (const model of [first, ...(FALLBACKS[first] ?? [])]) {
    if (isUsedUp(model)) continue;
    let delay: number = RETRY.firstDelayMs;
    for (let attempt = 1; attempt <= RETRY.attempts; attempt++) {
      try {
        return { value: await fn(model), model };
      } catch (e) {
        const c = classifyError(e);
        if (c.daily) { markUsedUp(model); break; }
        busy = true;
        console.warn(`[gemini] ${step} ${model} attempt ${attempt}: ${e instanceof ApiError ? e.status : "error"} ${(e as Error).message.slice(0, 120)}`);
        if (!c.retry) throw e;
        if (attempt === RETRY.attempts) break;
        const wait = Math.min(c.waitMs ?? delay, RETRY.maxDelayMs);
        onWait?.(Math.round(wait / 1000));
        await sleep(wait);
        delay = Math.min(delay * 2, RETRY.maxDelayMs);
      }
    }
  }
  throw new QuotaError(!busy);
}
