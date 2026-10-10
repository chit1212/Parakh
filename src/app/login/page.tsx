"use client";
// Sign in (design: Shared Screens #login), shown after "Sign out". Stubbed: there is no identity
// provider in the demo, so "Continue" returns to the comparison. The icon rail is hidden here.
import { useRouter } from "next/navigation";
import { HOME, PEOPLE } from "@/lib/routes";

export default function LoginPage() {
  const router = useRouter();
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", paddingLeft: "14vw", fontSize: 16 }}>
      <form onSubmit={(e) => { e.preventDefault(); router.push(HOME); }} style={{ maxWidth: 620, width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
        <span style={{ fontSize: 26, fontWeight: 600 }}>Parakh</span>
        <h1 style={{ fontSize: 40, margin: 0, lineHeight: 1.1 }}>Sign in</h1>
        <p style={{ margin: 0, color: "var(--color-neutral-800)" }}>Your sourcing workspace at {PEOPLE.company}.</p>
        <label className="field" style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 380 }}>
          <span style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>Work email</span>
          <input className="input" type="email" placeholder="name@sahyadri-appliances.example" />
        </label>
        <button className="btn btn-primary" type="submit" style={{ alignSelf: "flex-start", whiteSpace: "nowrap" }}>Continue with company sign-in</button>
        <span style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>Single sign-on · no separate password</span>
        <span style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>You’ve been signed out. Your checks, scenarios and draft emails are saved with the event. (Demo: sign-in is stubbed; continuing returns you to the comparison.)</span>
      </form>
    </div>
  );
}
