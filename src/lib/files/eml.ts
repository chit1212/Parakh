// Emails are read as text: headers, body, and the names of any attachments.
import PostalMime from "postal-mime";
import type { EmailParts } from "../types";

export interface ParsedEmail extends EmailParts {
  attachments: { filename: string; mimeType: string; content: Uint8Array }[];
}

export async function readEmail(buf: Buffer): Promise<ParsedEmail> {
  const raw = buf.toString("utf8");
  const parsed = await PostalMime.parse(raw);
  const addr = (a?: { name?: string; address?: string } | null) =>
    a ? (a.name ? `${a.name} <${a.address ?? ""}>` : a.address ?? "") : "";
  // The demo inbox lists attachments in a plain "Attachments:" header instead of MIME parts.
  const header = raw.split(/\r?\n\r?\n/)[0].match(/^Attachments:\s*(.+)$/im);
  const listed = header ? header[1].split(",").map((s) => s.trim()).filter(Boolean) : [];
  const attachments = (parsed.attachments ?? []).map((a) => ({
    filename: a.filename ?? "attachment",
    mimeType: a.mimeType,
    content: typeof a.content === "string" ? new TextEncoder().encode(a.content) : new Uint8Array(a.content as ArrayBuffer),
  }));
  return {
    from: addr(parsed.from as { name?: string; address?: string }),
    to: (parsed.to ?? []).map((t) => addr(t as { name?: string; address?: string })).join(", "),
    date: parsed.date ?? "",
    subject: parsed.subject ?? "",
    body: (parsed.text ?? "").trim(),
    attachmentNames: [...new Set([...listed, ...attachments.map((a) => a.filename)])],
    attachments,
  };
}

export function emailToText(fileName: string, e: EmailParts): string {
  return [
    `Email: ${fileName}`,
    `From: ${e.from}`,
    `To: ${e.to}`,
    `Date: ${e.date}`,
    `Subject: ${e.subject}`,
    e.attachmentNames.length ? `Attachments: ${e.attachmentNames.join(", ")}` : "Attachments: none",
    "",
    "[Email body]",
    e.body,
  ].join("\n");
}
