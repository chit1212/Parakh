// Turn raw bytes into a ReplyFile: detect the kind and parse what code can parse.
import path from "node:path";
import type { FileKind, ReplyFile } from "../types";
import { docxToText, readDocx } from "./docx";
import { emailToText, readEmail } from "./eml";
import { readPdfText } from "./pdf";
import { readWorkbook, workbookToText } from "./xlsx";
import { MAX_DOC_CHARS } from "../config";

const MIME: Record<string, string> = {
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".eml": "message/rfc822",
  ".txt": "text/plain",
  ".csv": "text/csv",
};

export function kindOf(name: string, buf: Buffer): FileKind {
  const ext = path.extname(name).toLowerCase();
  const head = buf.subarray(0, 8);
  if (head.subarray(0, 5).toString() === "%PDF-") return "pdf";
  if (head[0] === 0xff && head[1] === 0xd8) return "image"; // JPEG
  if (head.subarray(1, 4).toString() === "PNG") return "image";
  if (head.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image";
  if (head[0] === 0x50 && head[1] === 0x4b) return ext === ".docx" ? "docx" : ext === ".xlsx" ? "xlsx" : "unknown"; // zip
  if (ext === ".eml") return "eml";
  if (ext === ".txt" || ext === ".csv") return "text";
  if (ext === ".pdf") return "pdf"; // named .pdf but not a valid header: still treated as a (broken) PDF
  return "unknown";
}

const cap = (s: string) => (s.length > MAX_DOC_CHARS ? s.slice(0, MAX_DOC_CHARS) + "\n[... truncated: file too long]" : s);

export async function loadFile(name: string, filePath: string, buf: Buffer): Promise<ReplyFile> {
  const kind = kindOf(name, buf);
  const ext = path.extname(name).toLowerCase();
  const mime = kind === "image" ? (buf[0] === 0xff ? "image/jpeg" : buf.subarray(1, 4).toString() === "PNG" ? "image/png" : "image/webp")
    : MIME[ext] ?? "application/octet-stream";
  const f: ReplyFile = { name, path: filePath, kind, mime, bytes: buf.length };
  try {
    if (kind === "xlsx") {
      f.sheets = await readWorkbook(buf);
      f.text = cap(workbookToText(name, f.sheets));
    } else if (kind === "docx") {
      f.docx = await readDocx(buf);
      f.text = cap(docxToText(name, f.docx));
    } else if (kind === "eml") {
      const e = await readEmail(buf);
      const { attachments: _a, ...parts } = e;
      void _a;
      f.email = parts;
      f.text = cap(emailToText(name, parts));
    } else if (kind === "text") {
      f.text = cap(`Text file: ${name}\n\n${buf.toString("utf8")}`);
    } else if (kind === "pdf") {
      f.base64 = buf.toString("base64");
      f.pdfPages = (await readPdfText(buf)).pages;
    } else if (kind === "image") {
      f.base64 = buf.toString("base64");
    } else if (kind === "unknown") {
      f.parseError = "This file type is not supported.";
    }
  } catch (e) {
    f.parseError = `The file could not be opened (${(e as Error).message}).`;
  }
  return f;
}
