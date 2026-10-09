// The one Anthropic client. Server-only: the key never reaches the browser.
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "./config";

let client: Anthropic | null = null;

export function apiKey(): string | undefined {
  // Vercel and .env.local use ANTHROPIC_API_KEY. PARAKH_ANTHROPIC_API_KEY lets a dev
  // machine hold the app's key without changing the key its own tools use.
  return process.env.ANTHROPIC_API_KEY || process.env.PARAKH_ANTHROPIC_API_KEY || undefined;
}

/**
 * Cloud dev containers can hold the key as a "network secret": an egress proxy adds the
 * x-api-key header to requests for api.anthropic.com, so the key never sits on the machine.
 * Used only when no key is set, a proxy is configured, and we are not on Vercel.
 */
function proxyMode(): boolean {
  return !apiKey() && !process.env.VERCEL && Boolean(process.env.HTTPS_PROXY || process.env.https_proxy);
}

export function hasApiKey(): boolean {
  return Boolean(apiKey()) || proxyMode();
}

export function anthropic(): Anthropic {
  if (client) return client;
  // Explicit base URL, so an ANTHROPIC_BASE_URL set for other tools on the machine is never picked up.
  const baseURL = process.env.PARAKH_ANTHROPIC_BASE_URL || "https://api.anthropic.com";
  const key = apiKey();
  if (key) {
    client = new Anthropic({ apiKey: key, baseURL, maxRetries: 3 });
  } else if (proxyMode()) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ProxyAgent } = require("undici") as typeof import("undici");
    client = new Anthropic({
      apiKey: "added-by-network-secret",
      baseURL,
      maxRetries: 3,
      defaultHeaders: { "x-api-key": null }, // the proxy adds the real one
      fetchOptions: { dispatcher: new ProxyAgent(process.env.HTTPS_PROXY || process.env.https_proxy!) } as unknown as NonNullable<ConstructorParameters<typeof Anthropic>[0]>["fetchOptions"],
    });
  } else throw new MissingKeyError();
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
