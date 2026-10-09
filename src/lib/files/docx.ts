// Word files are parsed in code, keeping paragraph numbers and table/row references.
import mammoth from "mammoth";

const decode = (s: string) =>
  s.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ").trim();

export async function readDocx(buf: Buffer): Promise<{ paragraphs: string[]; tables: string[][][] }> {
  const { value: html } = await mammoth.convertToHtml({ buffer: buf });
  const paragraphs: string[] = [];
  const tables: string[][][] = [];
  // Walk top-level blocks in order: tables are kept whole, paragraphs outside tables numbered.
  const re = /<table>([\s\S]*?)<\/table>|<(p|h\d|li)>([\s\S]*?)<\/\2>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[1] !== undefined) {
      const rows = [...m[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) =>
        [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => decode(c[1])),
      );
      tables.push(rows);
    } else {
      const t = decode(m[3]);
      if (t) paragraphs.push(t);
    }
  }
  return { paragraphs, tables };
}

/** Text shown to the model, every paragraph and table row labelled so it can cite them. */
export function docxToText(fileName: string, d: { paragraphs: string[]; tables: string[][][] }, html?: string): string {
  void html;
  const out = [`Word document: ${fileName}`, ""];
  d.paragraphs.forEach((p, i) => out.push(`[Paragraph ${i + 1}] ${p}`));
  d.tables.forEach((t, ti) => {
    out.push("", `[Table ${ti + 1}]`);
    t.forEach((row, ri) => out.push(`  [Table ${ti + 1}, row ${ri + 1}] ${row.join(" | ")}`));
  });
  return out.join("\n");
}
