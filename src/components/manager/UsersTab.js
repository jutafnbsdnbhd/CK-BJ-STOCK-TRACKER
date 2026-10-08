"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, Loader2, Power, UserPlus } from "lucide-react";
import { useProfile } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";
import { authFetch } from "@/lib/authClient";
import {
  BRANCH,
  CK_INCHARGE,
  CK_STAFF,
  MIN_PASSWORD,
  ROLE_LABELS,
  SUPER_ADMIN,
  canManageUser,
  creatableRoles,
  isValidUsername,
  normalizeUsername,
} from "@/lib/roles";

const GROUP_ORDER = [SUPER_ADMIN, CK_INCHARGE, CK_STAFF, BRANCH];

/**
 * Accounts. Who can do what:
 *   Super Admin → create CK Incharge, CK Staff + Branch accounts, manage everyone
 *   CK Incharge → create + manage CK Incharge and CK Staff accounts
 * Accounts are never deleted — deactivate instead, history stays intact.
 */
export default function UsersTab() {
  const me = useProfile();
  const roleOptions = creatableRoles(me.role);

  const [rows, setRows] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const emptyDraft = { display_name: "", username: "", password: "", role: roleOptions[0] || "", branch_id: "" };
  const [draft, setDraft] = useState(emptyDraft);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await authFetch("/api/users");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setError(json.error || "Could not load accounts");
    else {
      setRows(json.data || []);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    supabase
      .from("branches")
      .select("id, name")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setBranches(data || []));
  }, [load]);

  async function send(method, body) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await authFetch("/api/users", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Something went wrong");
      return false;
    }
    await load();
    return true;
  }

  async function create(e) {
    e.preventDefault();
    const username = normalizeUsername(draft.username);
    if (!isValidUsername(username)) {
      setError("Username: 3–30 characters, lowercase letters, numbers, dot, dash or underscore only");
      return;
    }
    if (draft.password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters`);
      return;
    }
    const ok = await send("POST", { ...draft, username });
    if (ok) {
      setNotice(`Account created. Username: ${username} — give them the password you set.`);
      setDraft(emptyDraft);
    }
  }

  async function resetPassword(row) {
    const password = window.prompt(
      `New password for ${row.display_name} (@${row.username})\nAt least ${MIN_PASSWORD} characters:`
    );
    if (password === null) return;
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters`);
      return;
    }
    const ok = await send("PATCH", { id: row.id, action: "reset_password", password });
    if (ok) setNotice(`Password changed for @${row.username}.`);
  }

  async function toggleActive(row) {
    const activate = !row.is_active;
    if (
      !activate &&
      !window.confirm(
        `Deactivate ${row.display_name} (@${row.username})?\nThey will be logged out and cannot log in again until reactivated.`
      )
    )
      return;
    const ok = await send("PATCH", { id: row.id, action: activate ? "activate" : "deactivate" });
    if (ok) setNotice(`@${row.username} ${activate ? "reactivated" : "deactivated"}.`);
  }

  const groups = useMemo(() => {
    const visible = showInactive ? rows : rows.filter((r) => r.is_active);
    return GROUP_ORDER.map((role) => ({
      role,
      rows: visible.filter((r) => r.role === role),
    })).filter((g) => g.rows.length > 0);
  }, [rows, showInactive]);

  return (
    <div>
      {roleOptions.length > 0 ? (
        <form onSubmit={create} className="card p-4 mb-4 grid gap-3">
          <p className="font-semibold flex items-center gap-2">
            <UserPlus size={17} className="text-accent" /> New account
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className="input"
              placeholder="Display name — real name for CK people, e.g. Chamee"
              value={draft.display_name}
              onChange={(e) => setDraft({ ...draft, display_name: e.target.value })}
            />
            <input
              className="input"
              placeholder="Username e.g. trx"
              value={draft.username}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setDraft({ ...draft, username: normalizeUsername(e.target.value) })}
            />
            <input
              className="input"
              placeholder={`Password (min ${MIN_PASSWORD})`}
              value={draft.password}
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
            />
            <select
              className="input"
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value, branch_id: "" })}
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            {draft.role === BRANCH ? (
              <select
                className="input sm:col-span-2"
                value={draft.branch_id}
                onChange={(e) => setDraft({ ...draft, branch_id: e.target.value })}
              >
                <option value="">Which branch?</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <button
            className="btn-primary"
            disabled={
              busy ||
              !draft.display_name.trim() ||
              !draft.username ||
              !draft.password ||
              (draft.role === BRANCH && !draft.branch_id)
            }
          >
            {busy ? <Loader2 className="animate-spin" size={17} /> : <UserPlus size={17} />}
            Create account
          </button>
          <p className="text-xs text-muted">
            The password is shown while you type so you can pass it on. Ask them to keep it private.
          </p>
        </form>
      ) : null}

      {notice ? (
        <p className="mb-3 text-sm text-green-800 bg-green-50 border border-green-200 rounded-xl p-3">{notice}</p>
      ) : null}
      {error ? (
        <p className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>
      ) : null}

      <label className="flex items-center gap-2 text-sm text-muted mb-3 px-1">
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
        Show deactivated
      </label>

      {loading ? (
        <div className="flex items-center gap-2 text-muted py-10 justify-center">
          <Loader2 className="animate-spin" size={18} /> Loading&hellip;
        </div>
      ) : groups.length === 0 ? (
        <p className="card px-4 py-6 text-sm text-muted text-center">No accounts yet.</p>
      ) : (
        groups.map(({ role, rows: list }) => (
          <section key={role} className="mb-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-accent mb-2 px-1">
              {ROLE_LABELS[role]}
            </h3>
            <div className="card divide-y divide-line">
              {list.map((row) => {
                const manageable = canManageUser(me, row);
                const isMe = row.id === me.id;
                return (
                  <div
                    key={row.id}
                    className={`px-4 py-3 flex items-center gap-3 ${row.is_active ? "" : "opacity-50"}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">
                        {row.display_name}
                        {isMe ? <span className="text-xs text-muted font-normal"> (you)</span> : null}
                      </p>
                      <p className="text-xs text-muted truncate">
                        @{row.username}
                        {row.branches?.name ? ` · ${row.branches.name}` : ""}
                        {row.is_active ? "" : " · deactivated"}
                      </p>
                    </div>
                    {manageable ? (
                      <div className="flex gap-2 shrink-0">
                        <button
                          className="btn-ghost py-2 px-3 text-sm"
                          disabled={busy}
                          onClick={() => resetPassword(row)}
                          title="Reset password"
                        >
                          <KeyRound size={15} />
                        </button>
                        {!isMe ? (
                          <button
                            className={`btn-ghost py-2 px-3 text-sm ${row.is_active ? "text-red-600" : ""}`}
                            disabled={busy}
                            onClick={() => toggleActive(row)}
                            title={row.is_active ? "Deactivate" : "Reactivate"}
                          >
                            <Power size={15} />
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
