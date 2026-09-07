import { cookies } from "next/headers";
import { COOKIE_NAME, MAX_AGE, makeToken } from "@/lib/managerAuth";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const { password } = await request.json().catch(() => ({}));
  const expected = process.env.MANAGER_PASSWORD;

  if (!expected) {
    return Response.json(
      { error: "MANAGER_PASSWORD is not set on the server." },
      { status: 500 }
    );
  }
  if (typeof password !== "string" || password !== expected) {
    // Small delay so the endpoint is not a fast oracle for guessing.
    await new Promise((r) => setTimeout(r, 400));
    return Response.json({ error: "Wrong code" }, { status: 401 });
  }

  cookies().set({
    name: COOKIE_NAME,
    value: makeToken(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });

  return Response.json({ ok: true });
}
