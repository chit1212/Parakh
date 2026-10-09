import { redirect } from "next/navigation";
import { HOME } from "@/lib/routes";

// Compare is the home screen (design: App shell).
export default function Home() {
  redirect(HOME);
}
