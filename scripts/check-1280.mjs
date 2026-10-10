// Review fix 3: no page-level horizontal scroll at 1280 × 800. Run against a running app:
//   BASE=http://localhost:3000 node scripts/check-1280.mjs
// Uses Playwright (the environment's copy if the project has none).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); } catch { playwright = require("/opt/node22/lib/node_modules/playwright"); }

const base = process.env.BASE ?? "http://localhost:3000";
const pages = ["/events/SE-2026-041/compare", "/events/SE-2026-041/rfq", "/events/SE-2026-041/compare#scenario=base&view=chart", "/events/SE-2026-041/replies", "/events/SE-2026-041/award", "/events"];
const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
let failed = 0;
for (const path of pages) {
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  const ok = w <= 1280;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${path}: scrollWidth ${w}`);
}
await browser.close();
process.exit(failed ? 1 : 0);
