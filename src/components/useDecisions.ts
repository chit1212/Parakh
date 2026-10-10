"use client";
// The buyer's decisions on doubts, kept in this browser and shared by every screen.
import { useEffect, useState } from "react";
import { DECISIONS_KEY, parseDecisions, type Decision } from "@/lib/decisions";

const EVENT = "parakh-decisions";
const read = (): Decision[] => {
  try { return parseDecisions(JSON.parse(localStorage.getItem(DECISIONS_KEY) ?? "[]")); } catch { return []; }
};

export function useDecisions(): [Decision[], (d: Decision) => void, (key: string) => void] {
  const [list, setList] = useState<Decision[]>([]);
  useEffect(() => {
    setList(read());
    const on = () => setList(read());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const save = (next: Decision[]) => {
    try { localStorage.setItem(DECISIONS_KEY, JSON.stringify(next)); } catch { /* kept for this visit */ }
    setList(next);
    window.dispatchEvent(new Event(EVENT));
  };
  const record = (d: Decision) => save([...read().filter((x) => x.key !== d.key), d]);
  const undo = (key: string) => save(read().filter((x) => x.key !== key));
  return [list, record, undo];
}
