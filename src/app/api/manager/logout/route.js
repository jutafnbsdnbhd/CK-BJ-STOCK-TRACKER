import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/managerAuth";

export const dynamic = "force-dynamic";

export async function POST() {
  cookies().delete(COOKIE_NAME);
  return Response.json({ ok: true });
}
