// One structured model call: strict JSON out, usage counted, result cached by content hash.
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { z } from "zod";
import { anthropic, usageOf, type Usage } from "../ai";
import { MODELS } from "../config";

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

export interface CallResult<T> {
  data: T;
  usage: Usage | null; // null when served from cache
  cached: boolean;
  ms: number;
}

export async function callStructured<S extends z.ZodType>(opts: {
  step: string;
  model: string;
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  schema: S;
  effort: "low" | "medium" | "high";
  maxTokens: number;
  /** Ask for the content again even if a cached answer exists. */
  fresh?: boolean;
  /** Called before any paid model call (not for cache hits); throw to refuse it. */
  beforeCall?: () => void;
}): Promise<CallResult<z.infer<S>>> {
  const key = `${opts.step}-${hashOf(opts.model, opts.effort, opts.system, JSON.stringify(opts.content))}`;
  const t0 = Date.now();
  if (!opts.fresh) {
    const hit = await cacheGet<z.infer<S>>(key);
    if (hit) return { data: hit, usage: null, cached: true, ms: Date.now() - t0 };
  }

  opts.beforeCall?.();
  const isReader = opts.model === MODELS.reader;
  const stream = anthropic().beta.messages.stream({
    model: opts.model,
    max_tokens: opts.maxTokens,
    system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: opts.content }],
    output_config: { format: betaZodOutputFormat(opts.schema), effort: opts.effort },
    // On a safety decline, the API re-runs the request on a fallback model in the same call.
    ...(isReader ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new ReaderError(`The model declined to read this (${opts.step}).`);
  if (msg.stop_reason === "max_tokens") throw new ReaderError(`The reply was too long to read in one pass (${opts.step}).`);
  const data = msg.parsed_output as z.infer<S> | null;
  if (!data) throw new ReaderError(`The model's answer did not match the expected format (${opts.step}).`);
  await cachePut(key, data);
  return { data, usage: usageOf(msg.model ?? opts.model, msg.usage), cached: false, ms: Date.now() - t0 };
}
