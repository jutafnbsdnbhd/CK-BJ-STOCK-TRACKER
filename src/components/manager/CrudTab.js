"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Undo2 } from "lucide-react";
import { CATEGORY_ORDER } from "@/lib/constants";

/**
 * Generic manager CRUD table for items / staff / branches.
 * `fields` describes the editable columns beyond `name`.
 */
export default function CrudTab({ endpoint, label, fields = [] }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/manager/${endpoint}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setError(json.error || "Could not load");
    else {
      setRows(json.data || []);
      setError(null);
    }
    setLoading(false);
  }, [endpoint]);

  useEffect(() => {
    load();
  }, [load]);

  async function send(method, body, query = "") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/manager/${endpoint}${query}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
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

  async function add(e) {
    e.preventDefault();
    const payload = { name: draft.name };
    for (const f of fields) payload[f.key] = draft[f.key] || f.default || "";
    if (await send("POST", payload)) setDraft({});
  }

  const visible = showInactive ? rows : rows.filter((r) => r.is_active);

  return (
    <div>
      <form onSubmit={add} className="card p-3 mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            className="input"
            placeholder={`New ${label} name`}
            value={draft.name || ""}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          {fields.map((f) =>
            f.key === "category" ? (
              <select
                key={f.key}
                className="input"
                value={draft.category || CATEGORY_ORDER[0]}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              >
                {CATEGORY_ORDER.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            ) : (
              <input
                key={f.key}
                className="input"
                placeholder={f.placeholder}
                value={draft[f.key] || ""}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              />
            )
          )}
        </div>
        <button className="btn-primary" disabled={busy || !draft.name?.trim()}>
          <Plus size={17} /> Add
        </button>
      </form>

      {error ? (
        <p className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
          {error}
        </p>
      ) : null}

      <label className="flex items-center gap-2 text-sm text-muted mb-3 px-1">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
        />
        Show deactivated
      </label>

      {loading ? (
        <div className="flex items-center gap-2 text-muted py-10 justify-center">
          <Loader2 className="animate-spin" size={18} /> Loading&hellip;
        </div>
      ) : (
        <div className="card divide-y divide-line">
          {visible.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted text-center">Nothing here yet.</p>
          ) : (
            visible.map((row) => (
              <div
                key={row.id}
                className={`px-3 py-2.5 grid gap-2 sm:grid-cols-[1fr_auto] items-center ${
                  row.is_active ? "" : "opacity-50"
                }`}
              >
                <div className="grid gap-2 sm:grid-cols-3">
                  <input
                    className="input py-2"
                    defaultValue={row.name}
                    onBlur={(e) =>
                      e.target.value.trim() !== row.name &&
                      send("PATCH", { id: row.id, name: e.target.value })
                    }
                  />
                  {fields.map((f) =>
                    f.key === "category" ? (
                      <select
                        key={f.key}
                        className="input py-2"
                        defaultValue={row.category}
                        onChange={(e) => send("PATCH", { id: row.id, category: e.target.value })}
                      >
                        {[...new Set([...CATEGORY_ORDER, row.category])].map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        key={f.key}
                        className="input py-2"
                        defaultValue={row[f.key]}
                        placeholder={f.placeholder}
                        onBlur={(e) =>
                          e.target.value !== row[f.key] &&
                          send("PATCH", { id: row.id, [f.key]: e.target.value })
                        }
                      />
                    )
                  )}
                </div>
                {row.is_active ? (
                  <button
                    className="btn-ghost py-2 px-3 text-sm text-red-600"
                    disabled={busy}
                    onClick={() => send("DELETE", null, `?id=${row.id}`)}
                    title="Deactivate — history is kept"
                  >
                    <Trash2 size={15} />
                  </button>
                ) : (
                  <button
                    className="btn-ghost py-2 px-3 text-sm"
                    disabled={busy}
                    onClick={() => send("PATCH", { id: row.id, is_active: true })}
                    title="Restore"
                  >
                    <Undo2 size={15} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <p className="text-xs text-muted mt-3 px-1">
        Edits save when you tap away from the box. Deleting deactivates the {label} and hides it
        from staff — past movements are never removed.
      </p>
    </div>
  );
}
