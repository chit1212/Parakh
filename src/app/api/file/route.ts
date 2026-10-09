// Serve an original file from the demo dataset, for "Open original" and the source panel.
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".eml": "text/plain; charset=utf-8",
};

export async function GET(req: Request) {
  const rel = new URL(req.url).searchParams.get("path") ?? "";
  const root = path.join(process.cwd(), "dataset");
  const full = path.resolve(process.cwd(), rel);
  // Only the folders the buyer would have: RFQ, inbox, replies, history, failure cases.
  const allowed = ["01_rfq", "02_inbox", "03_vendor_replies", "04_history", "05_failure_cases"];
  if (!allowed.some((d) => full.startsWith(path.join(root, d) + path.sep)))
    return new Response("Not found", { status: 404 });
  try {
    const buf = await fs.readFile(full);
    const ext = path.extname(full).toLowerCase();
    return new Response(new Uint8Array(buf), {
      headers: {
        "content-type": TYPES[ext] ?? "application/octet-stream",
        "content-disposition": `${[".pdf", ".jpg", ".jpeg", ".png", ".eml"].includes(ext) ? "inline" : "attachment"}; filename="${path.basename(full)}"`,
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
