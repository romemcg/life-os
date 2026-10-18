import { redirect } from "next/navigation";

export default function Reading() {
  redirect("/learning?tab=books");
}
