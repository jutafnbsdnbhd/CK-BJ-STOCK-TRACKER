import { requireRoles } from "@/lib/apiAuth";
import {
  BRANCH,
  CK_ROLES,
  MIN_PASSWORD,
  canManageUser,
  creatableRoles,
  isValidUsername,
  normalizeUsername,
  usernameToEmail,
} from "@/lib/roles";

export const dynamic = "force-dynamic";

// Long enough to mean "never". Deactivated accounts cannot log in again
// until reactivated.
const BAN_FOREVER = "876000h";

function bad(message, status = 400) {
  return Response.json({ error: message }, { status });
}

// ---------------------------------------------------------------- list
export async function GET(request) {
  const caller = await requireRoles(request, CK_ROLES);
  if (caller.error) return caller.error;

  const { data, error } = await caller.admin
    .from("app_users")
    .select("id, username, display_name, role, branch_id, is_active, created_at, branches(name)")
    .order("role")
    .order("username");

  if (error) return bad(error.message, 500);
  return Response.json({ data });
}

// -------------------------------------------------------------- create
export async function POST(request) {
  const caller = await requireRoles(request, CK_ROLES);
  if (caller.error) return caller.error;
  const { admin, profile } = caller;

  const body = await request.json().catch(() => ({}));
  const username = normalizeUsername(body.username);
  const displayName = String(body.display_name || "").trim();
  const password = String(body.password || "");
  const role = String(body.role || "");
  const branchId = role === BRANCH ? body.branch_id || null : null;

  if (!creatableRoles(profile.role).includes(role)) {
    return bad("Your account cannot create this type of account", 403);
  }
  if (!isValidUsername(username)) {
    return bad("Username: 3–30 characters, lowercase letters, numbers, dot, dash or underscore only");
  }
  if (!displayName) return bad("Display name is required");
  if (password.length < MIN_PASSWORD) {
    return bad(`Password must be at least ${MIN_PASSWORD} characters`);
  }

  if (role === BRANCH) {
    if (!branchId) return bad("Choose which branch this account belongs to");
    const { data: branch } = await admin
      .from("branches")
      .select("id, is_active")
      .eq("id", branchId)
      .maybeSingle();
    if (!branch || !branch.is_active) return bad("That branch does not exist or is inactive");
  }

  const { data: taken } = await admin
    .from("app_users")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (taken) return bad("That username is already taken");

  // 1. The login (Supabase Auth). email_confirm: true — no email is sent.
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (authError || !created?.user) {
    const msg = authError?.message || "Could not create the login";
    return bad(/already|registered|exists/i.test(msg) ? "That username is already taken" : msg, 400);
  }

  // 2. The account row. If this fails, remove the login so nothing is
  //    left half-created.
  const { data: row, error: rowError } = await admin
    .from("app_users")
    .insert({
      id: created.user.id,
      username,
      display_name: displayName,
      role,
      branch_id: branchId,
      created_by: profile.id,
    })
    .select("id, username, display_name, role, branch_id, is_active")
    .single();

  if (rowError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return bad(rowError.message, 500);
  }

  return Response.json({ data: row });
}

// -------------------------------------------------------------- change
// body: { id, action: "reset_password" | "deactivate" | "activate" | "rename",
//         password?, display_name? }
export async function PATCH(request) {
  const caller = await requireRoles(request, CK_ROLES);
  if (caller.error) return caller.error;
  const { admin, profile } = caller;

  const body = await request.json().catch(() => ({}));
  if (!body.id || !body.action) return bad("id and action are required");

  const { data: target } = await admin
    .from("app_users")
    .select("id, username, role, is_active")
    .eq("id", body.id)
    .maybeSingle();
  if (!target) return bad("Account not found", 404);

  if (!canManageUser(profile, target)) {
    return bad("Your account cannot change this account", 403);
  }

  const isSelf = target.id === profile.id;

  if (body.action === "reset_password") {
    const password = String(body.password || "");
    if (password.length < MIN_PASSWORD) {
      return bad(`Password must be at least ${MIN_PASSWORD} characters`);
    }
    const { error } = await admin.auth.admin.updateUserById(target.id, { password });
    if (error) return bad(error.message, 500);
    return Response.json({ ok: true });
  }

  if (body.action === "rename") {
    const displayName = String(body.display_name || "").trim();
    if (!displayName) return bad("Display name is required");
    const { error } = await admin
      .from("app_users")
      .update({ display_name: displayName })
      .eq("id", target.id);
    if (error) return bad(error.message, 500);
    return Response.json({ ok: true });
  }

  if (body.action === "deactivate" || body.action === "activate") {
    const activate = body.action === "activate";
    if (isSelf && !activate) return bad("You cannot deactivate your own account");

    // Ban/unban the login first, then flip the account row. The row is what
    // the database checks, so access stops the moment it changes.
    const { error: banError } = await admin.auth.admin.updateUserById(target.id, {
      ban_duration: activate ? "none" : BAN_FOREVER,
    });
    if (banError) return bad(banError.message, 500);

    const { error } = await admin
      .from("app_users")
      .update({ is_active: activate })
      .eq("id", target.id);
    if (error) return bad(error.message, 500);
    return Response.json({ ok: true });
  }

  return bad("Unknown action");
}
