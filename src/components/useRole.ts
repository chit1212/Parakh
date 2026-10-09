"use client";
// Demo: who is using Parakh, the buyer or the VP (design: workspace menu, "Demo: view as").
// In production this comes from the signed-in user's permissions. Kept in this browser and
// broadcast, so the chat's "Asking as" and the award buttons follow it.
import { useEffect, useState } from "react";

export type Role = "Buyer" | "VP";
const KEY = "parakh-role";
const EVENT = "parakh-role";

const read = (): Role => {
  try { return localStorage.getItem(KEY) === "VP" ? "VP" : "Buyer"; } catch { return "Buyer"; }
};

export function useRole(): [Role, (r: Role) => void] {
  const [role, setRole] = useState<Role>("Buyer");
  useEffect(() => {
    setRole(read());
    const on = () => setRole(read());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const set = (r: Role) => {
    try { localStorage.setItem(KEY, r); } catch { /* kept for this visit */ }
    setRole(r);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: r }));
  };
  return [role, set];
}
