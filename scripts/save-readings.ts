// Read the demo replies once with the real pipeline and save the results in data/readings/
// (committed). The demo opens with these, so visitors don't spend the free AI quota.
//   npm run save-readings                 reads every reply that has no saved reading yet
//   npm run save-readings -- --again      reads every reply again
//   npm run save-readings -- --only=4_anand_photo
// One reply at a time, so the free tier's per-minute limit is respected. Safe to stop and
// re-run: finished replies are kept, and calls already made are served from the local cache.
import { loadEnv } from "./env";
loadEnv();

import { hasApiKey } from "@/lib/ai";
import { loadDemoInbox } from "@/lib/inbox";
import { readReply } from "@/lib/reader/pipeline";
import { loadEvent } from "@/lib/rfq";
import { loadSavedReadings, saveReading } from "@/lib/saved";

const args = process.argv.slice(2);
const again = args.includes("--again");
const only = args.find((a) => a.startsWith("--only="))?.split("=")[1];

async function main() {
  if (!hasApiKey()) {
    console.error("No API key. Put GEMINI_API_KEY=... in .env.local.");
    process.exit(1);
  }
  const ev = await loadEvent();
  const saved = await loadSavedReadings();
  // The five vendor quotes first: they matter most if the day's quota runs out part way.
  const rank = (id: string) => (/^\d_/.test(id) && !id.startsWith("6_") ? 0 : 1);
  const inbox = (await loadDemoInbox())
    .filter((r) => (only ? r.id === only : again || !saved[r.id]))
    .sort((a, b) => rank(a.id) - rank(b.id));
  if (!inbox.length) return console.log("Every reply already has a saved reading. Use --again to read them again.");

  console.log(`Reading ${inbox.length} replies, one at a time...`);
  for (const reply of inbox) {
    const t = Date.now();
    const r = await readReply(reply, ev, { fresh: again || Boolean(only) });
    const secs = ((Date.now() - t) / 1000).toFixed(0);
    if (r.status === "error") {
      console.log(`  ${reply.id.padEnd(24)} not saved (${secs}s): ${r.error}`);
      if (/quota/i.test(r.error ?? "")) {
        console.log("\nStopped: the free quota is used up. Run this again later; finished replies are kept.");
        process.exit(2);
      }
      continue;
    }
    await saveReading(r);
    const tokens = r.usage.reduce((s, u) => s + u.inputTokens + u.outputTokens, 0);
    console.log(`  ${reply.id.padEnd(24)} ${r.status.padEnd(11)} ${secs.padStart(4)}s  ${r.usage.length} calls, ${tokens} tokens  ${r.headline}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
