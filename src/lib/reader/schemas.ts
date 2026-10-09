// The exact shapes the model must return. Structured outputs guarantee the JSON matches;
// code then checks every source against the file before anything is trusted.
import { z } from "zod";

export const Source = z
  .object({
    file: z.string().describe("File name exactly as given in the document tag."),
    sheet: z.string().nullable().describe("Spreadsheet: sheet name. Otherwise null."),
    cell: z.string().nullable().describe("Spreadsheet: the cell reference shown in [brackets], e.g. G8. Otherwise null."),
    page: z.number().nullable().describe("PDF: 1-based page number. Otherwise null."),
    table: z.number().nullable().describe("Word: table number as labelled [Table n]. Otherwise null."),
    row: z
      .string()
      .nullable()
      .describe("Row label as it appears: a line id like L01, a serial number, or the printed row number on a photo. Word: the row number from the [Table n, row m] label."),
    snippet: z
      .string()
      .describe("The exact words from the document this comes from, copied character for character (keep the vendor's spelling, commas and symbols). Keep it short: one row or one sentence."),
    region: z
      .object({ x0: z.number(), y0: z.number(), x1: z.number(), y1: z.number() })
      .nullable()
      .describe("Photos and scanned pages only: approximate box around the row, as fractions 0..1 of image width (x) and height (y). Otherwise null."),
  })
  .describe("Where in the reply this was read.");

const Alternative = z.object({ value: z.number(), reason: z.string() });

export const PriceItem = z.object({
  vendor_wording: z.string().describe("The item description exactly as the vendor wrote it."),
  line_id: z.string().nullable().describe("The RFQ line this answers (L01..L30), or null if it matches no line."),
  match_basis: z
    .enum(["line_id_given", "name_and_spec", "name_only", "uncertain"])
    .describe("How the line was matched."),
  match_reason: z.string().describe("One short sentence: why this is that RFQ line."),
  raw_value_text: z.string().describe("The price exactly as written, e.g. '4,134.00' or '0.0551'."),
  raw_value: z.number().describe("The same price as a plain number, with no conversion of any kind."),
  unit: z
    .enum(["per_box", "per_piece", "per_100", "per_1000", "per_kg", "per_dozen", "lump_sum", "unclear"])
    .describe("What one unit of this price is, as the vendor states it."),
  unit_text: z.string().describe("The vendor's own words for the unit, e.g. 'Rs/pc', 'per 100 pcs', 'USD / box'."),
  currency: z.enum(["INR", "USD", "EUR", "other", "not_stated"]),
  price_basis: z
    .enum(["delivered", "ex_works", "not_stated"])
    .describe("Whether the price includes delivery to the buyer's plant, as stated anywhere in the reply."),
  offered_spec: z
    .string()
    .nullable()
    .describe("The board/spec the vendor says it is offering for this line (e.g. '3 PLY'), or null if not stated."),
  differs_from_rfq: z
    .boolean()
    .describe("True if what is offered differs from the RFQ spec for this line (different ply, size, board or print)."),
  difference: z.string().nullable().describe("If it differs: what differs, in plain words. Otherwise null."),
  legibility: z
    .enum(["clear", "unclear", "corrected_by_hand"])
    .describe("Whether the number can be read without doubt."),
  alternative_readings: z
    .array(Alternative)
    .describe("Other values this number could plausibly be (e.g. a pen digit that could be 1 or 7). Empty if clear."),
  source: Source,
});

export const RateRule = z.object({
  vendor_wording: z.string().describe("The vendor's words for this rate, exactly."),
  component: z
    .enum(["board_per_kg", "printing_per_colour", "die_cutting_per_piece", "other"])
    .describe("What the rate prices."),
  applies_to_ply: z.number().nullable().describe("3, 5 or 7 if the rate is for one ply count; null if it applies to all."),
  value: z.number(),
  value_text: z.string().describe("The rate exactly as written."),
  currency: z.enum(["INR", "USD", "EUR", "other", "not_stated"]),
  unit_text: z.string(),
  from_earlier_record: z
    .boolean()
    .describe("True if this rate is not in the reply itself but comes from the buyer's record of an earlier quote, because the reply points to it (e.g. 'same as last year')."),
  pointer: z
    .string()
    .nullable()
    .describe("If from an earlier record: the vendor's words that point to it, e.g. 'rest same as last year'. Otherwise null."),
  source: Source,
});

export const NotQuoted = z.object({
  line_id: z.string(),
  reason: z.string().describe("The vendor's stated reason, or 'not in the reply'."),
  stated_by_vendor: z.boolean().describe("True if the vendor explicitly says it does not quote this line."),
  source: Source.nullable().describe("Where the vendor says so; null if the line is simply absent."),
});

export const Extraction = z.object({
  prices: z.array(PriceItem).describe("Every per-line price in the reply."),
  rate_rules: z
    .array(RateRule)
    .describe("Rates that price lines indirectly (per kg of box, per colour, per piece for die-cutting), instead of per-line prices."),
  not_quoted: z.array(NotQuoted).describe("RFQ lines this reply does not price, directly or through a rate rule."),
  reading_notes: z
    .array(z.string())
    .describe("Anything the buyer should know about how this reply was read: ambiguities, items that match no RFQ line, pages that seem missing. Short sentences."),
});
export type Extraction = z.infer<typeof Extraction>;

export const TermItem = z.object({
  kind: z.enum([
    "freight", "handling", "gst", "discount", "validity", "payment", "lead_time",
    "price_basis", "currency", "price_revision_clause", "tooling_or_plates", "packaging_or_deposit", "other",
  ]),
  summary: z.string().describe("Plain-English statement of the term, one sentence."),
  value: z.number().nullable().describe("The number in the term, as written (e.g. 0.35, 15, 2.5, 30). Null if the term states no amount."),
  value_unit: z
    .enum(["inr_per_box", "usd_per_box", "percent", "days", "inr", "usd", "other", "none"])
    .describe("Unit of the value."),
  applies_to: z.string().nullable().describe("What the term applies to, e.g. 'freight' for a handling charge on freight, 'all items', 'printed items'."),
  amount_stated: z.boolean().describe("False when the reply says a charge exists but gives no amount (e.g. 'freight extra')."),
  condition: z.string().nullable().describe("Any condition that must hold for the term to apply, in the vendor's words. Null if unconditional."),
  condition_threshold_inr: z.number().nullable().describe("If the condition is a rupee threshold (e.g. a single PO above INR 25,00,000), that number in rupees. Otherwise null."),
  source: Source,
});

export const QuestionnaireAnswer = z.object({
  question_id: z.string().describe("Q1..Q8 as in the RFQ."),
  answer: z.string().describe("The vendor's answer, as written."),
  source: Source,
});

export const QualityDoc = z.object({
  kind: z.enum(["iso_certificate", "test_report", "other"]),
  summary: z.string(),
  identifier: z.string().nullable().describe("Certificate or report number, if any."),
  date: z.string().nullable().describe("Test date or issue date as written."),
  valid_until: z.string().nullable().describe("Expiry date as written, if any."),
  marked_as_sample: z.boolean().describe("True if the document says it is a sample, specimen or not a real certificate."),
  source: Source,
});

export const TermsSweep = z.object({
  terms: z.array(TermItem).describe("Every commercial term anywhere in the reply, including footnotes, second sheets, paragraphs and the cover email."),
  questionnaire: z.array(QuestionnaireAnswer).describe("The vendor's answers to the RFQ questionnaire, if any."),
  quality_documents: z.array(QualityDoc).describe("Certificates and test reports attached."),
  revision: z
    .object({
      is_revision: z.boolean(),
      supersedes: z.string().nullable().describe("Which earlier offer it replaces, in the vendor's words."),
      changes_claimed: z.string().nullable().describe("What the vendor says changed, in the vendor's words."),
      source: Source.nullable(),
    })
    .describe("Whether this reply revises an earlier offer."),
});
export type TermsSweep = z.infer<typeof TermsSweep>;

export const Classification = z.object({
  category: z
    .enum(["quote", "revised_quote", "not_a_quote_yet", "spam", "unrelated"])
    .describe("quote: prices for this RFQ. revised_quote: replaces an earlier offer. not_a_quote_yet: about this RFQ but no prices yet. spam: marketing or junk. unrelated: something else."),
  vendor_name: z.string().nullable().describe("The company replying, if stated."),
  reason: z.string().describe("One sentence explaining the category."),
  files: z
    .array(
      z.object({
        name: z.string(),
        role: z.enum(["quote", "questionnaire", "certificate", "test_report", "cover_note", "other"]),
      }),
    )
    .describe("The role of each attached file. A file that contains both prices and questionnaire answers is a quote."),
  looks_incomplete: z.boolean().describe("True if the reply itself shows something is missing, e.g. 'Page 1 of 2' with only one page, or 'continued' with nothing following."),
  incomplete_evidence: z.string().nullable(),
  promised_followup: z.string().nullable().describe("If the sender promises to send prices or documents later, what and when, in their words."),
});
export type Classification = z.infer<typeof Classification>;
