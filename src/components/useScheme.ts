"use client";
// The buyer's quality marking scheme, kept in this browser and shared by every screen.
import { useEffect, useState } from "react";
import { DEFAULT_SCHEME, loadScheme, SCHEME_KEY, type QualityScheme } from "@/lib/qualityScheme";

const EVENT = "parakh-scheme";

export function useScheme(): [QualityScheme, (s: QualityScheme | null) => void] {
  const [scheme, setScheme] = useState<QualityScheme>(DEFAULT_SCHEME);
  useEffect(() => {
    setScheme(loadScheme());
    const on = () => setScheme(loadScheme());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const save = (s: QualityScheme | null) => {
    try { if (s) localStorage.setItem(SCHEME_KEY, JSON.stringify(s)); else localStorage.removeItem(SCHEME_KEY); } catch { /* kept for this visit */ }
    setScheme(s ?? DEFAULT_SCHEME);
    window.dispatchEvent(new Event(EVENT));
  };
  return [scheme, save];
}
