"use client";
// Every screen: the icon rail, then the content, starting 8 px from the rail (design: App shell).
import { Rail } from "./Rail";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", minWidth: 1360, fontSize: 13, lineHeight: 1.45, fontVariantNumeric: "tabular-nums" }}>
      <Rail />
      <main style={{ flex: 1, minWidth: 0, padding: "18px 40px 40px 8px" }}>{children}</main>
    </div>
  );
}
