"use client";
// "Verified by you" (design): the buyer's own sign-off that a price matches the document.
// Starts empty: nothing counts as checked until a person clicks "I've checked this".
// Kept in this browser, keyed "vendorId:lineId"; the award snapshot copies it when frozen.
import { useEffect, useState } from "react";

export interface Check { at: string; who: string }
export type Checks = Record<string, Check>;
export const VERIFIED_KEY = "parakh-verified";
const EVENT = "parakh-verified";
export const checkKey = (vendorId: string, lineId: string) => `${vendorId}:${lineId}`;

const read = (): Checks => {
  try { return JSON.parse(localStorage.getItem(VERIFIED_KEY) ?? "{}") ?? {}; } catch { return {}; }
};

export function useVerified(): [Checks, (key: string, c: Check | null) => void] {
  const [checks, setChecks] = useState<Checks>({});
  useEffect(() => {
    setChecks(read());
    const on = () => setChecks(read());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const set = (key: string, c: Check | null) => {
    const next = { ...read() };
    if (c) next[key] = c; else delete next[key];
    try { localStorage.setItem(VERIFIED_KEY, JSON.stringify(next)); } catch { /* kept for this visit */ }
    setChecks(next);
    window.dispatchEvent(new Event(EVENT));
  };
  return [checks, set];
}

export const stamp = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
