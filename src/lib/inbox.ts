// The event inbox (stubbed plumbing): the demo replies are built from dataset/ folders,
// uploads arrive as files. Which vendor sent what is matched by sender address in code.
import fs from "node:fs/promises";
import path from "node:path";
import { loadFile } from "./files";
import { datasetPath, loadEvent } from "./rfq";
import type { Reply, ReplyFile, Vendor } from "./types";

const ADDR = /<?([^\s<>]+@[^\s<>]+)>?/;

export function vendorForSender(vendors: Vendor[], from: string | null | undefined): Vendor | null {
  const addr = from?.match(ADDR)?.[1]?.toLowerCase();
  if (!addr) return null;
  const exact = vendors.find((v) => v.email.toLowerCase() === addr);
  if (exact) return exact;
  const domain = addr.split("@")[1];
  // Same company domain, different person (generic mail domains excluded).
  if (domain && !/^(gmail|yahoo|outlook|hotmail|example)\.(com|in)$/.test(domain))
    return vendors.find((v) => v.email.toLowerCase().endsWith("@" + domain)) ?? null;
  return null;
}

async function fileAt(rel: string): Promise<ReplyFile> {
  const buf = await fs.readFile(datasetPath(rel));
  return loadFile(path.basename(rel), `dataset/${rel}`, buf);
}

const toIso = (d: string | undefined | null) => {
  if (!d) return null;
  const t = Date.parse(d);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};

let demoCache: Promise<Reply[]> | null = null;

/** All replies in the demo event, oldest first. */
export function loadDemoInbox(): Promise<Reply[]> {
  demoCache ??= buildDemoInbox();
  return demoCache;
}

async function buildDemoInbox(): Promise<Reply[]> {
  const ev = await loadEvent();
  const inboxNames = (await fs.readdir(datasetPath("02_inbox"))).filter((f) => f.endsWith(".eml")).sort();
  const inbox = await Promise.all(inboxNames.map((n) => fileAt(`02_inbox/${n}`)));
  const used = new Set<ReplyFile>();
  const replies: Reply[] = [];

  const push = (id: string, cover: ReplyFile | null, files: ReplyFile[]) => {
    const from = cover?.email?.from ?? null;
    replies.push({
      id,
      receivedAt: toIso(cover?.email?.date),
      from,
      subject: cover?.email?.subject ?? null,
      cover,
      files,
      vendorId: vendorForSender(ev.vendors, from)?.id ?? null,
      origin: "demo",
    });
  };

  // Each folder in 03_vendor_replies is one reply.
  const dirs = (await fs.readdir(datasetPath("03_vendor_replies"), { withFileTypes: true }))
    .filter((d) => d.isDirectory()).map((d) => d.name).sort();
  for (const dir of dirs) {
    const names = (await fs.readdir(datasetPath(`03_vendor_replies/${dir}`))).filter((n) => !n.startsWith(".")).sort();
    const own = names.find((n) => n.endsWith(".eml"));
    const files = await Promise.all(names.filter((n) => n !== own).map((n) => fileAt(`03_vendor_replies/${dir}/${n}`)));
    let cover: ReplyFile | null = null;
    if (own) {
      cover = await fileAt(`03_vendor_replies/${dir}/${own}`);
      // The inbox copy of the same email (same sender and time) is not a second reply.
      for (const m of inbox) if (m.email?.from === cover.email?.from && m.email?.date === cover.email?.date) used.add(m);
    } else {
      cover = inbox.find((m) => m.email?.attachmentNames.some((a) => names.includes(a))) ?? null;
      if (cover) used.add(cover);
    }
    push(dir, cover, files);
  }

  // Inbox emails not tied to a folder are replies on their own.
  for (const m of inbox) if (!used.has(m)) push(path.basename(m.name, ".eml"), m, []);

  // Failure cases: each file arrives on its own.
  const fails = (await fs.readdir(datasetPath("05_failure_cases"))).filter((n) => !n.startsWith(".")).sort();
  for (const n of fails) {
    const f = await fileAt(`05_failure_cases/${n}`);
    if (f.kind === "eml") push(path.basename(n, ".eml"), f, []);
    else push(path.basename(n, path.extname(n)), null, [f]);
  }

  return replies.sort((a, b) => (a.receivedAt ?? "9999").localeCompare(b.receivedAt ?? "9999"));
}
