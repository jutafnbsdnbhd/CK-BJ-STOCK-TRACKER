import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const COOKIE_NAME = "bj_mgr";
export const MAX_AGE = 60 * 60 * 12; // 12 hours — one shift

function secret() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-secret";
}

// The cookie is a signed token, not the password itself. Signing it with a
// server-only secret means a staff member cannot forge one from the browser.
export function makeToken() {
  const issued = Date.now().toString();
  const sig = createHmac("sha256", secret()).update(issued).digest("hex");
  return `${issued}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== "string") return false;
  const [issued, sig] = token.split(".");
  if (!issued || !sig) return false;
  if (Date.now() - Number(issued) > MAX_AGE * 1000) return false;
  const expected = createHmac("sha256", secret()).update(issued).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isManager() {
  return verifyToken(cookies().get(COOKIE_NAME)?.value);
}

export function requireManager() {
  if (!isManager()) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }
  return null;
}
