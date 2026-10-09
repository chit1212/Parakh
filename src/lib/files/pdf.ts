// PDFs go to the model as documents; code reads their text layer only to check sources and page counts.
import { extractText, getDocumentProxy } from "unpdf";

export async function readPdfText(buf: Buffer): Promise<{ pages: string[] }> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: false });
  return { pages: text as string[] };
}
