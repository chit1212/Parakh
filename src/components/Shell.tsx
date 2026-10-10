"use client";
// Every screen: the icon rail, then the content, starting 8 px from the rail (design: App shell).
import { Rail } from "./Rail";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", fontSize: 16, lineHeight: 1.45, fontVariantNumeric: "tabular-nums" }}>
      <Rail />
      <main style={{ flex: 1, minWidth: 0, padding: "20px 40px 40px 12px" }}>{children}</main>
    </div>
  );
}
