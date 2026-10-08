import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Who is calling this API route?
 *
 * Reads the login token the browser sends (see authFetch), asks Supabase
 * whether it is genuine, then loads the account row. A deactivated account
 * is refused even if its session has not expired yet.
 *
 * Returns { admin, profile } on success, or { error: Response } to send back.
 */
export async function getCaller(request) {
  const header = request.headers.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return { error: Response.json({ error: "Not logged in" }, { status: 401 }) };
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    return {
      error: Response.json({ error: "Session expired — please log in again" }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await admin
    .from("app_users")
    .select("id, username, display_name, role, branch_id, is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    return { error: Response.json({ error: profileError.message }, { status: 500 }) };
  }
  if (!profile || !profile.is_active) {
    return { error: Response.json({ error: "This account is not active" }, { status: 403 }) };
  }

  return { admin, profile };
}

/** Same as getCaller, but also refuses any role not in `roles`. */
export async function requireRoles(request, roles) {
  const caller = await getCaller(request);
  if (caller.error) return caller;
  if (!roles.includes(caller.profile.role)) {
    return {
      error: Response.json({ error: "Not allowed for your account" }, { status: 403 }),
    };
  }
  return caller;
}
