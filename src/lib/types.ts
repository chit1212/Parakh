// Domain types shared by the reader, the checks and the screens.

/** One line of the RFQ, with the geometry code derives from its spec. */
export interface RfqLine {
  id: string; // "L01"
  name: string; // "Steam iron, unit carton"
  size: string; // "280 x 140 x 150 mm (internal)" or "0.62 m2 board area"
  spec: string; // "3-ply E, 150/120/120 GSM, top 18 BF, flute E, 4-colour flexo print"
  qty: number;
  kind: "RSC" | "ACC"; // regular slotted carton, or a flat accessory given by board area
  dimsMm: { L: number; W: number; H: number } | null;
  ply: string; // "3-ply E"
  plyN: number; // 3, 5 or 7
  flutes: string[]; // ["B", "C"]
  layersGsm: number[]; // [180, 120, 120, 120, 150]
  colours: number; // 0 = unprinted
  dieCut: boolean;
  /** Computed in code from the spec. */
  areaM2: number;
  boardGsm: number;
  weightKg: number;
  shouldCost: number;
  shouldCostCalc: string;
}

export interface Question {
  id: string; // "Q1"
  text: string;
  type: "Mandatory" | "Scored";
}

export interface SourcingEvent {
  id: string;
  title: string;
  buyerCo: string;
  plant: string;
  buyer: string;
  buyerRole: string;
  buyerEmail: string;
  vp: string;
  vpRole: string;
  issued: string;
  due: string;
  basis: string;
  lyEventId: string;
  lines: RfqLine[];
  questions: Question[];
  passRule: string;
  /** Free-text notes in the RFQ the reader should know (spec changes, PO sizes). */
  notes: string[];
  /** Vendors the RFQ was sent to. */
  vendors: Vendor[];
}

/** Last year's awarded price for one line (from 04_history). */
export interface LastYearLine {
  lineId: string;
  board: string; // board as awarded last year, e.g. "5-ply BC"
  vendor: string;
  price: number; // INR/box delivered ex-GST
  source: CellSource;
}

// ---------------------------------------------------------------- files

export type FileKind = "xlsx" | "docx" | "pdf" | "image" | "eml" | "text" | "unknown";

/** A file as it arrived, plus whatever code could parse from it. */
export interface ReplyFile {
  name: string;
  path: string; // repo-relative for dataset files, "upload:<id>" for uploads
  kind: FileKind;
  mime: string;
  bytes: number;
  /** Parsed text representation sent to the model (xlsx, docx, eml, text). */
  text?: string;
  /** Per-page text from a PDF's text layer (used for checks, not sent to the model). */
  pdfPages?: string[];
  /** Set when code could not open the file at all. */
  parseError?: string;
  /** Structured parse kept for checking sources (never sent to the model as-is). */
  sheets?: import("./files/xlsx").Sheet[];
  docx?: { paragraphs: string[]; tables: string[][][] };
  email?: EmailParts;
  /** Raw bytes as base64, for PDFs and images that go to the model as documents. */
  base64?: string;
}

export interface Vendor {
  id: string; // short code used across the app, e.g. "SB"
  name: string;
  city: string;
  contact: string;
  email: string;
}

/** One reply in the event inbox: a cover email (if any) and its files. */
export interface Reply {
  id: string;
  receivedAt: string | null; // ISO date
  from: string | null;
  subject: string | null;
  /** The cover email, when the reply came by email. Its body is read too. */
  cover: ReplyFile | null;
  /** Attachments, or the single uploaded file. */
  files: ReplyFile[];
  /** Matched by sender address in code; null until known. */
  vendorId: string | null;
  origin: "demo" | "upload";
}

export interface EmailParts {
  from: string;
  to: string;
  date: string;
  subject: string;
  body: string;
  /** Attachment names, from real MIME parts or from an "Attachments:" header in the demo inbox. */
  attachmentNames: string[];
}

// ---------------------------------------------------------------- sources

export interface CellSource {
  kind: "cell";
  file: string;
  sheet: string;
  cell: string;
}

/**
 * Where a value was read from. A flat shape so it can travel through a strict
 * output schema; which fields are set depends on the file kind.
 */
export interface SourceRef {
  file: string;
  /** Spreadsheet sheet and cell, e.g. "Offer", "G8". */
  sheet: string | null;
  cell: string | null;
  /** PDF page number, 1-based. */
  page: number | null;
  /** Word table number, 1-based. */
  table: number | null;
  /** Row label as printed: a line id, a serial number, or the photo's row number. */
  row: string | null;
  /** The exact words in the document the value comes from. */
  snippet: string;
  /** Approximate area on a photo or page image, as fractions 0..1 of width and height. */
  region: { x0: number; y0: number; x1: number; y1: number } | null;
}

export type VerifyStatus =
  | "verified" // code found the value at the stated place in the file
  | "photo" // read from an image; code cannot check text in a photo
  | "failed"; // code could not find it where the reader said: never enters the grid

export interface Verification {
  status: VerifyStatus;
  note: string;
}
