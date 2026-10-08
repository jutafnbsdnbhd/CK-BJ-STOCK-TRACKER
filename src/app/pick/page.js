import { redirect } from "next/navigation";

// The name picker was removed in v3.1 — each person now has their own
// login. Kept as a redirect so old bookmarks / home-screen links still work.
export default function PickPage() {
  redirect("/menu");
}
