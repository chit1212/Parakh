// Run the reader on every reply in the demo inbox and grade it against the answer key.
//   npm run scorecard            uses cached readings when the files and prompts are unchanged
//   npm run scorecard -- --fresh reads everything again (costs API credit)
//   npm run scorecard -- --only=4_anand_photo
//   npm run scorecard -- --save  after a full run with no errors, save the model answers it used to
//                                data/saved-readings (committed), so the demo opens without paid calls
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "./env";
loadEnv();

import { hasApiKey } from "@/lib/ai";
import { loadDemoInbox } from "@/lib/inbox";
import { saveUsedReadings } from "@/lib/reader/call";
import { readReply, type ReplyReading } from "@/lib/reader/pipeline";
import { loadEvent } from "@/lib/rfq";
import { grade, loadKey } from "@/lib/scorecard";

const args = process.argv.slice(2);
const fresh = args.includes("--fresh");
const save = args.includes("--save");
const only = args.find((a) => a.startsWith("--only="))?.split("=")[1];
const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : "-");

async function main() {
  if (!hasApiKey()) {
    console.error("No API key. Put ANTHROPIC_API_KEY=... in .env.local (see README).");
    process.exit(1);
  }
  const ev = await loadEvent();
  const inbox = (await loadDemoInbox()).filter((r) => !only || r.id === only);
  const readings: ReplyReading[] = [];
  const queue = [...inbox];
  const worker = async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      const reply = r;
      const t = Date.now();
      const res = await readReply(reply, ev, { fresh });
      readings.push(res);
      const cost = res.usage.reduce((s, u) => s + u.costUsd, 0);
      console.log(`  ${reply.id.padEnd(24)} ${res.status.padEnd(11)} ${((Date.now() - t) / 1000).toFixed(1).padStart(5)}s ${res.cached ? "(cached)" : `$${cost.toFixed(3)}`}  ${res.headline}`);
    }
  };
  console.log(`Reading ${inbox.length} replies...`);
  await Promise.all([worker(), worker(), worker(), worker()]);

  const out = path.join(process.cwd(), ".cache");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "readings-latest.json"), JSON.stringify(readings, null, 1));
  if (only) {
    if (save) console.log("--save needs a full run (without --only).");
    return;
  }

  const sc = grade(ev, await loadKey(), readings);
  fs.writeFileSync(path.join(out, "scorecard-latest.json"), JSON.stringify(sc, null, 1));

  console.log("\nField-level accuracy (150 cells: 5 vendors x 30 lines)");
  for (const f of sc.fields) console.log(`  ${f.field.padEnd(18)} ${String(f.right).padStart(4)} / ${String(f.total).padEnd(4)} ${pct(f.right, f.total)}`);
  const all = sc.fields.reduce((a, f) => [a[0] + f.right, a[1] + f.total], [0, 0]);
  console.log(`  ${"ALL FIELDS".padEnd(18)} ${String(all[0]).padStart(4)} / ${String(all[1]).padEnd(4)} ${pct(all[0], all[1])}`);
  console.log("\nBy vendor");
  for (const v of sc.byVendor) console.log(`  ${v.vendor}  ${pct(v.right, v.total)}  (${v.right}/${v.total})`);
  const wrong = sc.cells.filter((c) => !c.ok);
  if (wrong.length) {
    console.log(`\nCells with a miss (${wrong.length})`);
    for (const c of wrong) console.log(`  ${c.vendor}|${c.line}  expected "${c.expected}"  got "${c.got}"  missed: ${c.misses.join(", ")}`);
  }
  console.log("\nPlanted edges");
  for (const e of sc.edges) console.log(`  ${e.ok ? "PASS" : "FAIL"}  ${e.name}  [${e.detail}]`);
  console.log("\nFailure cases");
  for (const e of sc.failures) console.log(`  ${e.ok ? "PASS" : "FAIL"}  ${e.name}  [${e.detail}]`);
  console.log(`\nNot graded yet: ${sc.notYet.join("; ")}`);
  console.log(`API cost this run: $${sc.costUsd.toFixed(3)}`);

  if (save) {
    const failed = readings.filter((r) => r.status === "error");
    if (failed.length) console.log(`\nNot saved: ${failed.length} replies stopped with an error (${failed.map((r) => r.replyId).join(", ")}).`);
    else console.log(`\nSaved ${await saveUsedReadings()} model answers to data/saved-readings.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
