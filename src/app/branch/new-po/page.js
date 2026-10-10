"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Loader2, Minus, Plus, Search, Store, User } from "lucide-react";
import Header from "@/components/Header";
import AuthGate, { useProfile } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";
import { groupByCategory } from "@/lib/constants";
import { addDays, formatDate, klToday } from "@/lib/dates";
import { BRANCH, SUPER_ADMIN } from "@/lib/roles";
import { bundleError, bundleHint, fmtQty, packLabel, stepFor } from "@/lib/bundles";

const ORDERED_BY_KEY = "ck-po-ordered-by";

/**
 * New Purchase Order (branch side).
 *   [Super Admin only: pick branch] → enter quantities → review → submit
 * After submitting, the PO page opens with the Share-to-WhatsApp button.
 * Branches never see CK stock balances — they order what they need.
 */
function NewPoScreen() {
  const router = useRouter();
  const profile = useProfile();
  const isAdmin = profile.role === SUPER_ADMIN;

  const [items, setItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [step, setStep] = useState(isAdmin ? "branch" : "entry");
  const [branchId, setBranchId] = useState(isAdmin ? "" : profile.branch_id);
  const [orderedBy, setOrderedBy] = useState("");
  const [qty, setQty] = useState({});
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const poDate = klToday();
  const deliveryDate = addDays(poDate, 1);

  useEffect(() => {
    try {
      setOrderedBy(localStorage.getItem(ORDERED_BY_KEY) || "");
    } catch {}
    (async () => {
      const [itemsRes, branchesRes] = await Promise.all([
        supabase
          .from("items")
          .select("id, name, category, uom, min_order, pack_qty, pack_unit")
          .eq("is_active", true)
          .order("name"),
        isAdmin
          ? supabase.from("branches").select("id, name, code").eq("is_active", true).order("name")
          : Promise.resolve({ data: [] }),
      ]);
      const err = itemsRes.error || branchesRes.error;
      if (err) setLoadError(err.message);
      else {
        setItems(itemsRes.data || []);
        setBranches(branchesRes.data || []);
      }
      setLoading(false);
    })();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  }, [items, search]);

  const grouped = useMemo(() => groupByCategory(filtered), [filtered]);

  const entered = useMemo(
    () =>
      items
        .map((item) => ({ item, value: Number(qty[item.id]) }))
        .filter((r) => Number.isFinite(r.value) && r.value > 0),
    [items, qty]
  );

  // Lines that break the bundle rule. The database refuses these too; this
  // just stops the branch before they reach Review.
  const invalid = useMemo(
    () => entered.filter(({ item, value }) => bundleError(item, value)),
    [entered]
  );

  function bump(item, direction) {
    const step = stepFor(item);
    setQty((prev) => {
      const current = Number(prev[item.id]) || 0;
      // Snap to the bundle grid first, then move one bundle.
      const snapped = direction > 0 ? Math.floor(current / step) * step : Math.ceil(current / step) * step;
      const next = Math.max(0, snapped + direction * step);
      return { ...prev, [item.id]: next === 0 ? "" : String(next) };
    });
  }

  const branchName = isAdmin
    ? branches.find((b) => b.id === branchId)?.name || ""
    : profile.branches?.name || "";

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      localStorage.setItem(ORDERED_BY_KEY, orderedBy.trim());
    } catch {}

    const { data, error } = await supabase.rpc("create_po", {
      p_branch_id: branchId || null,
      p_ordered_by: orderedBy.trim(),
      p_note: note.trim() || null,
      p_lines: entered.map(({ item, value }) => ({ item_id: item.id, quantity: value })),
    });

    if (error) {
      setSubmitting(false);
      setSubmitError(error.message);
      return;
    }
    const po = Array.isArray(data) ? data[0] : data;
    router.replace(`/po/${po.po_number}?new=1`);
  }

  // ---------------------------------------------------------- branch (admin)
  if (step === "branch") {
    return (
      <>
        <Header title="New PO" back="/branch" />
        <main className="mx-auto max-w-2xl px-4 py-6">
          <h2 className="text-sm font-semibold text-muted mb-3">Which branch is ordering?</h2>
          {loading ? (
            <div className="flex items-center gap-2 text-muted py-10 justify-center">
              <Loader2 className="animate-spin" size={18} /> Loading&hellip;
            </div>
          ) : (
            <div className="grid gap-2.5">
              {branches.map((b) => (
                <button
                  key={b.id}
                  disabled={!b.code}
                  onClick={() => {
                    setBranchId(b.id);
                    setStep("entry");
                  }}
                  className="card px-4 py-4 flex items-center gap-3 text-left hover:border-accent transition active:scale-[.99] disabled:opacity-50"
                >
                  <Store size={18} className="text-accent shrink-0" />
                  <span className="font-semibold flex-1">{b.name}</span>
                  <span className="text-xs text-muted">{b.code || "no code"}</span>
                </button>
              ))}
            </div>
          )}
        </main>
      </>
    );
  }

  // ------------------------------------------------------------------ review
  if (step === "review") {
    return (
      <>
        <Header title="New PO — review" />
        <main className="mx-auto max-w-2xl px-4 py-6">
          <div className="card p-4 mb-4 grid gap-2 text-sm">
            <p className="flex items-center gap-2">
              <Store size={16} className="text-accent" /> From: <span className="font-bold">{branchName}</span>
            </p>
            <p className="flex items-center gap-2">
              <User size={16} className="text-accent" /> Ordered by: <span className="font-bold">{orderedBy.trim()}</span>
            </p>
            <p className="flex items-center gap-2">
              <CalendarDays size={16} className="text-accent" /> Delivery:{" "}
              <span className="font-bold">{formatDate(deliveryDate)}</span>
            </p>
          </div>

          <div className="card divide-y divide-line">
            {entered.map(({ item, value }) => (
              <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{item.name}</p>
                  <p className="text-xs text-muted">{item.category}</p>
                </div>
                <span className="font-bold shrink-0">
                  {fmtQty(value)} {item.uom}
                </span>
              </div>
            ))}
          </div>

          {note.trim() ? (
            <p className="text-sm text-muted mt-3">
              Note: <span className="text-ink">{note.trim()}</span>
            </p>
          ) : null}

          <p className="text-xs text-muted mt-3">
            Once submitted, a PO cannot be edited — only cancelled (before CK processes it) and placed again.
          </p>

          {submitError ? (
            <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{submitError}</p>
          ) : null}

          <div className="grid gap-2.5 mt-6">
            <button className="btn-primary" onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
              Submit PO
            </button>
            <button className="btn-ghost" onClick={() => setStep("entry")} disabled={submitting}>
              Edit
            </button>
          </div>
        </main>
      </>
    );
  }

  // ------------------------------------------------------------------- entry
  return (
    <>
      <Header title="New Purchase Order" back="/branch" />
      <main className="mx-auto max-w-2xl px-4 py-4 pb-32">
        <div className="card p-4 mb-4 grid gap-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              <Store size={16} className="text-accent" />
              <span className="font-bold">{branchName}</span>
            </span>
            {isAdmin ? (
              <button className="text-xs text-accent font-semibold" onClick={() => setStep("branch")}>
                Change
              </button>
            ) : null}
          </div>
          <p className="flex items-center gap-2 text-sm">
            <CalendarDays size={16} className="text-accent" />
            Delivery: <span className="font-bold">{formatDate(deliveryDate)}</span>
          </p>
          <div>
            <label className="label" htmlFor="orderedBy">
              Ordered by (your name)
            </label>
            <input
              id="orderedBy"
              className="input"
              placeholder="e.g. Moses"
              value={orderedBy}
              onChange={(e) => setOrderedBy(e.target.value)}
            />
          </div>
        </div>

        <div className="relative mb-4">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input pl-9"
            placeholder="Search item"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted py-10 justify-center">
            <Loader2 className="animate-spin" size={18} /> Loading items&hellip;
          </div>
        ) : loadError ? (
          <div className="card p-4 text-sm text-red-700 bg-red-50 border-red-200">{loadError}</div>
        ) : grouped.length === 0 ? (
          <p className="text-center text-muted py-10 text-sm">No items match &ldquo;{search}&rdquo;.</p>
        ) : (
          grouped.map(({ category, items: rows }) => (
            <section key={category} className="mb-5">
              <h2 className="text-xs font-bold uppercase tracking-wide text-accent mb-2 px-1">{category}</h2>
              <div className="card divide-y divide-line">
                {rows.map((item) => {
                  const err = bundleError(item, qty[item.id]);
                  const hint = bundleHint(item);
                  const pack = packLabel(item);
                  return (
                    <div key={item.id} className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted">
                            {hint ? <span className="font-semibold text-accent">{hint}</span> : item.uom}
                            {pack ? ` · ${pack}` : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => bump(item, -1)}
                          className="grid place-items-center w-9 h-9 rounded-xl border border-line bg-white active:scale-95 shrink-0"
                          aria-label={`Less ${item.name}`}
                        >
                          <Minus size={16} />
                        </button>
                        <input
                          type="number"
                          inputMode={item.min_order ? "numeric" : "decimal"}
                          min="0"
                          step={item.min_order ? stepFor(item) : "any"}
                          placeholder="0"
                          value={qty[item.id] ?? ""}
                          onChange={(e) => setQty((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          className={`input w-20 text-right font-semibold py-2 ${
                            err ? "border-red-400 text-red-600 bg-red-50" : ""
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => bump(item, 1)}
                          className="grid place-items-center w-9 h-9 rounded-xl border border-line bg-white active:scale-95 shrink-0"
                          aria-label={`More ${item.name}`}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      {err ? <p className="text-xs text-red-600 font-semibold text-right mt-1">{err}</p> : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}

        <div className="mt-6">
          <label className="label" htmlFor="note">
            Note to CK (optional)
          </label>
          <input
            id="note"
            className="input"
            placeholder="e.g. urgent, event on Saturday"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </main>

      <div className="fixed bottom-0 inset-x-0 bg-base/95 backdrop-blur border-t border-line">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
          <p className="text-sm text-muted flex-1">
            {!orderedBy.trim()
              ? "Fill in your name"
              : invalid.length > 0
              ? `Fix ${invalid.length} quantit${invalid.length === 1 ? "y" : "ies"} (bundles)`
              : entered.length === 0
              ? "Key in a quantity"
              : `${entered.length} item${entered.length === 1 ? "" : "s"} ready`}
          </p>
          <button
            className="btn-primary flex-1"
            disabled={entered.length === 0 || invalid.length > 0 || !orderedBy.trim() || !branchId}
            onClick={() => setStep("review")}
          >
            Review
          </button>
        </div>
      </div>
    </>
  );
}

export default function NewPoPage() {
  return (
    <AuthGate allow={[BRANCH, SUPER_ADMIN]}>
      <NewPoScreen />
    </AuthGate>
  );
}
