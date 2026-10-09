// The one Gemini client. Server-only: the key never reaches the browser.
import { ApiError, GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

export function apiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || undefined;
}

/**
 * Cloud dev containers can hold the key as a "network secret": an egress proxy adds the
 * x-goog-api-key header to requests for the Gemini API, so the key never sits on the machine.
 * Used only when no key is set, a proxy is configured, and we are not on Vercel.
 */
function proxyMode(): boolean {
  return !apiKey() && !process.env.VERCEL && Boolean(process.env.HTTPS_PROXY || process.env.https_proxy);
}

export function hasApiKey(): boolean {
  return Boolean(apiKey()) || proxyMode();
}

export function gemini(): GoogleGenAI {
  if (client) return client;
  const key = apiKey();
  if (key) {
    client = new GoogleGenAI({ apiKey: key });
  } else if (proxyMode()) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const undici = require("undici") as typeof import("undici");
    const dispatcher = new undici.ProxyAgent(process.env.HTTPS_PROXY || process.env.https_proxy!);
    client = new GoogleGenAI({
      apiKey: "added-by-network-secret",
      httpOptions: {
        // Drop the placeholder header; the proxy adds the real one.
        fetch: ((url: string | URL | Request, init?: RequestInit) => {
          const headers = new Headers(init?.headers);
          headers.delete("x-goog-api-key");
          return undici.fetch(String(url instanceof Request ? url.url : url), { ...(init as object), headers, dispatcher } as never);
        }) as unknown as typeof fetch,
      },
    });
  } else throw new MissingKeyError();
  return client;
}

export class MissingKeyError extends Error {
  constructor() {
    super("No Gemini API key is set. Add GEMINI_API_KEY to .env.local (or the hosting settings).");
  }
}

/** The free AI quota is used up for now. The message is safe to show the buyer. */
export class QuotaBusyError extends Error {}

export interface Usage {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export function usageOf(
  model: string,
  u: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } | undefined,
): Usage {
  return { model, inputTokens: u?.promptTokenCount ?? 0, outputTokens: (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Seconds the API asks us to wait, from a 429's RetryInfo ("retryDelay": "31s"), if given. */
function retryDelayOf(e: ApiError): number | null {
  const m = e.message.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return m ? Number(m[1]) : null;
}

const isBusy = (e: unknown) => e instanceof ApiError && (e.status === 429 || e.status === 503 || e.status === 500);
/** A daily quota cannot be waited out in a request; a per-minute one can. */
const isDaily = (e: ApiError) => /PerDay|per day|RequestsPerDay/i.test(e.message);

/**
 * Run a model call, retrying with backoff when the free tier is rate-limited or busy.
 * Gives up with a QuotaBusyError (a calm message) rather than a raw API error.
 */
export async function withBackoff<T>(fn: () => Promise<T>, opts: { tries?: number; maxWaitS?: number } = {}): Promise<T> {
  const tries = opts.tries ?? 4;
  const maxWait = opts.maxWaitS ?? 40;
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (!isBusy(e)) throw e;
      const err = e as ApiError;
      if (err.status === 429 && isDaily(err))
        throw new QuotaBusyError("Today's free AI quota is used up. Saved readings still show; live reading works again tomorrow.");
      const asked = retryDelayOf(err);
      const wait = Math.min(maxWait, asked ?? 2 ** i * 4 + Math.random() * 2);
      if (i + 1 >= tries || (asked !== null && asked > maxWait))
        throw new QuotaBusyError("The free AI quota is busy right now. Try again in a minute.");
      await sleep(wait * 1000);
    }
  }
}

/** Turn any error from a model call into words fit for the buyer. Raw details go to the server log. */
export function calmMessage(e: unknown): string {
  if (e instanceof QuotaBusyError || e instanceof MissingKeyError) return e.message;
  const name = (e as Error)?.constructor?.name;
  if (name === "ReaderError" || name === "RateLimitedError") return (e as Error).message;
  console.error("[parakh] model call failed:", e);
  if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return "The AI service did not accept this app's key. Readings already saved still show.";
  return "Something went wrong while reading. Nothing was changed; try again in a minute.";
}
