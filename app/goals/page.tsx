import { redirect } from "next/navigation";

// Projects merged into Vision (life area → milestone → tasks).
export default function Goals() {
  redirect("/vision");
}
