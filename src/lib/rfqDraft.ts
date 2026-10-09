// The draft RFQ the co-pilot edits, and the edits it can return.
export interface DraftLine { id: string; name: string; size: string; spec: string; qty: number | null }
export interface DraftRfq { lines: DraftLine[]; questions: { id: string; text: string; type: string }[]; terms: Record<string, string> }
export type Edit =
  | { op: "update_line"; lineId: string; field: "name" | "size" | "spec" | "qty"; value: string }
  | { op: "add_line"; name: string; size: string; spec: string; qty: number }
  | { op: "remove_line"; lineId: string }
  | { op: "add_question"; text: string; type: "Mandatory" | "Scored" }
  | { op: "update_term"; key: string; value: string };
