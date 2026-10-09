import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Parakh · sourcing co-pilot",
  description: "Reads every vendor reply into one comparison you can trust.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
