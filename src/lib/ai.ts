// The one Anthropic client. Server-only: the key never reaches the browser.
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "./config";

let client: Anthropic | null = null;

export function apiKey(): string | undefined {
  // PARAKH_ANTHROPIC_API_KEY lets a dev container hold the app's key without
  // changing the key its own tools use; Vercel and .env.local use ANTHROPIC_API_KEY.
  return process.env.ANTHROPIC_API_KEY || process.env.PARAKH_ANTHROPIC_API_KEY || undefined;
}

export function hasApiKey(): boolean {
  return Boolean(apiKey());
}

export function anthropic(): Anthropic {
  const key = apiKey();
  if (!key) throw new MissingKeyError();
  client ??= new Anthropic({
    apiKey: key,
    // Explicit, so an ANTHROPIC_BASE_URL set for other tools on the machine is never picked up.
    baseURL: process.env.PARAKH_ANTHROPIC_BASE_URL || "https://api.anthropic.com",
    maxRetries: 3,
  });
  return client;
}

export class MissingKeyError extends Error {
  constructor() {
    super("No Anthropic API key is set. Add ANTHROPIC_API_KEY to .env.local (or the hosting settings).");
  }
}

/** USD per million tokens, for the running cost shown on the scorecard. */
const PRICE: Record<string, { in: number; out: number; cacheRead: number }> = {
  [MODELS.reader]: { in: 2, out: 10, cacheRead: 0.2 },
  [MODELS.classifier]: { in: 0.1, out: 0.5, cacheRead: 0.01 },
};

export interface Usage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costUsd: number;
}

export function usageOf(model: string, u: {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}): Usage {
  const p = PRICE[model] ?? PRICE[MODELS.reader];
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const cacheWrite = u.cache_creation_input_tokens ?? 0;
  const cost = (u.input_tokens * p.in + cacheWrite * p.in * 1.25 + cacheRead * p.cacheRead + u.output_tokens * p.out) / 1e6;
  return { model, inputTokens: u.input_tokens + cacheWrite, outputTokens: u.output_tokens, cacheReadTokens: cacheRead, costUsd: cost };
}
