// =====================================================================
// Roles and usernames — shared by the screens and the server.
// =====================================================================

export const SUPER_ADMIN = "super_admin";
export const CK_INCHARGE = "ck_incharge";
export const CK_STAFF = "ck_staff";
export const BRANCH = "branch";

// Everyone who works at CK Store: Stock In / Stock Out / DOs.
export const CK_ROLES = [SUPER_ADMIN, CK_INCHARGE, CK_STAFF];
// CK people who may also use Manager (items, branches, accounts, reports).
export const CK_MANAGER_ROLES = [SUPER_ADMIN, CK_INCHARGE];
export const ALL_ROLES = [SUPER_ADMIN, CK_INCHARGE, CK_STAFF, BRANCH];

export const ROLE_LABELS = {
  [SUPER_ADMIN]: "Super Admin",
  [CK_INCHARGE]: "CK Incharge",
  [CK_STAFF]: "CK Staff",
  [BRANCH]: "Branch",
};

// Staff type a plain username. Supabase Auth needs an email, so we add a
// fixed ending behind the scenes. No email is ever sent to it.
// ⚠️ Changing this after accounts exist breaks every existing login.
export const USERNAME_DOMAIN = "ckstore.local";

export function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

export function isValidUsername(value) {
  return /^[a-z0-9._-]{3,30}$/.test(value);
}

export function usernameToEmail(value) {
  return `${normalizeUsername(value)}@${USERNAME_DOMAIN}`;
}

export const MIN_PASSWORD = 8;

// Where each role lands after logging in.
export function homeFor(role) {
  return role === BRANCH ? "/branch" : "/menu";
}

// Which roles this account may create.
//   Super Admin → CK Incharge, CK Staff, Branch
//   CK Incharge → CK Incharge, CK Staff
// Nobody creates a Super Admin from the app.
export function creatableRoles(callerRole) {
  if (callerRole === SUPER_ADMIN) return [CK_INCHARGE, CK_STAFF, BRANCH];
  if (callerRole === CK_INCHARGE) return [CK_INCHARGE, CK_STAFF];
  return [];
}

// Whether this account may reset / deactivate another account.
export function canManageUser(caller, target) {
  if (!caller || !target) return false;
  if (caller.role === SUPER_ADMIN) return true;
  if (caller.role === CK_INCHARGE) return [CK_INCHARGE, CK_STAFF].includes(target.role);
  return false;
}
