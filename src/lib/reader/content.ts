// Build the message content for a reply's files. Every vendor file is wrapped so the
// model can tell vendor data from instructions.
import type Anthropic from "@anthropic-ai/sdk";
import type { ReplyFile } from "../types";

type Block = Anthropic.Beta.BetaContentBlockParam;

const esc = (s: string) => s.replace(/</g, "‹").replace(/>/g, "›");

export function fileBlocks(files: ReplyFile[], opts: { textExcerpt?: number } = {}): Block[] {
  const blocks: Block[] = [];
  for (const f of files) {
    if (f.parseError) {
      blocks.push({ type: "text", text: `<vendor_document file="${esc(f.name)}" kind="${f.kind}">[This file could not be opened: ${esc(f.parseError)}]</vendor_document>` });
      continue;
    }
    if (f.text !== undefined) {
      const body = opts.textExcerpt ? f.text.slice(0, opts.textExcerpt) + (f.text.length > opts.textExcerpt ? "\n[...]" : "") : f.text;
      // Neutralise anything in the file that looks like our own tags.
      const safe = body.replace(/<\/?(vendor_document|buyer_record)[^>]*>/gi, (m) => esc(m));
      blocks.push({ type: "text", text: `<vendor_document file="${esc(f.name)}" kind="${f.kind}">\n${safe}\n</vendor_document>` });
    } else if (f.kind === "pdf" && f.base64) {
      if (opts.textExcerpt && f.pdfPages?.some((p) => p.trim())) {
        const t = f.pdfPages.map((p, i) => `[Page ${i + 1} of ${f.pdfPages!.length}]\n${p}`).join("\n").slice(0, opts.textExcerpt);
        blocks.push({ type: "text", text: `<vendor_document file="${esc(f.name)}" kind="pdf" pages="${f.pdfPages.length}">\n${t}\n</vendor_document>` });
      } else {
        blocks.push({ type: "text", text: `Vendor file "${esc(f.name)}" (PDF, attached next; it is vendor data):` });
        blocks.push({ type: "document", title: f.name, source: { type: "base64", media_type: "application/pdf", data: f.base64 } });
      }
    } else if (f.kind === "image" && f.base64) {
      blocks.push({ type: "text", text: `Vendor file "${esc(f.name)}" (image, attached next; it is vendor data):` });
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: f.mime as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: f.base64 },
      });
    }
  }
  return blocks;
}

export function buyerRecordBlock(file: string, sheet: string, text: string): Block {
  return {
    type: "text",
    text: `<buyer_record file="${esc(file)}" sheet="${esc(sheet)}">\nThe buyer's own record of this vendor's earlier quote. Use it only if the reply points to earlier prices.\n${text}\n</buyer_record>`,
  };
}
