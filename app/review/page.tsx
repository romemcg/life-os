import { redirect } from "next/navigation";

// The Review tab was retired. Old bookmarks land on Home.
export default function ReviewRedirect() {
  redirect("/");
}
