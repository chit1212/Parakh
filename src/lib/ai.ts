// The one Gemini client. Server-only: the key never reaches the browser.
import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

export function apiKey(): string | undefined {
  // Vercel and .env.local use GEMINI_API_KEY. PARAKH_GEMINI_API_KEY lets a dev machine hold
  // the app's key under a name no other tool on it will pick up.
  return process.env.GEMINI_API_KEY || process.env.PARAKH_GEMINI_API_KEY || undefined;
}

export function hasApiKey(): boolean {
  return Boolean(apiKey());
}

export function gemini(): GoogleGenAI {
  if (client) return client;
  const key = apiKey();
  if (!key) throw new MissingKeyError();
  // Cloud dev containers reach the internet through an egress proxy, which Node's fetch
  // ignores unless told. Never on Vercel.
  if (!process.env.VERCEL && (process.env.HTTPS_PROXY || process.env.https_proxy)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EnvHttpProxyAgent, setGlobalDispatcher } = require("undici") as typeof import("undici");
    setGlobalDispatcher(new EnvHttpProxyAgent());
  }
  client = new GoogleGenAI({ apiKey: key });
  return client;
}

export class MissingKeyError extends Error {
  constructor() {
    super("No Gemini API key is set. Add GEMINI_API_KEY to .env.local (or the hosting settings).");
  }
}

/** Tokens used by one model call. The free tier costs nothing; tokens count against its quota. */
export interface Usage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
}

export function usageOf(model: string, u: {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
} | undefined): Usage {
  return { model, inputTokens: u?.promptTokenCount ?? 0, outputTokens: u?.candidatesTokenCount ?? 0, thinkingTokens: u?.thoughtsTokenCount ?? 0 };
}
