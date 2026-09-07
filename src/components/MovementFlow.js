"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Loader2,
  Search,
  Store,
} from "lucide-react";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabaseClient";
import { loadStaff } from "@/lib/session";
import { groupByCategory } from "@/lib/constants";

/**
 * Shared batch-entry flow for both Stock In and Stock Out.
 *
 * Steps:
 *   out:  branch -> entry -> review -> [warn] -> done
 *   in:            entry -> review           -> done
 *
 * Only non-zero rows are ever inserted. A stock-out that would take an item
 * negative shows a WARNING after Confirm, never a hard stop — the physical
 * count is the truth, and blocking staff just teaches them to stop logging.
 */
export default function MovementFlow({ type }) {
  const isOut = type === "out";
  const router = useRouter();

  const [staff, setStaff] = useState(null);
  const [items, setItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [balances, setBalances] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [step, setStep] = useState(isOut ? "branch" : "entry");
  const [branchId, setBranchId] = useState("");
  const [qty, setQty] = useState({}); // { [itemId]: "3" }
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    const person = loadStaff();
    if (!person) {
      router.replace("/");
      return;
    }
    setStaff(person);

    (async () => {
      const [itemsRes, branchesRes, balancesRes] = await Promise.all([
        supabase
          .from("items")
          .select("id, name, category, uom")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("branches")
          .select("id, name")
          .eq("is_active", true)
          .order("name"),
        supabase.from("item_balances").select("item_id, balance"),
      ]);

      const err = itemsRes.error || branchesRes.error || balancesRes.error;
      if (err) {
        setLoadError(err.message);
      } else {
        setItems(itemsRes.data || []);
        setBranches(branchesRes.data || []);
        setBalances(
          Object.fromEntries((balancesRes.data || []).map((r) => [r.item_id, Number(r.balance)]))
        );
      }
      setLoading(false);
    })();
  }, [router]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, search]);

  const grouped = useMemo(() => groupByCategory(filtered), [filtered]);

  const entered = useMemo(
    () =>
      items
        .map((item) => ({ item, value: Number(qty[item.id]) }))
        .filter((row) => Number.isFinite(row.value) && row.value > 0),
    [items, qty]
  );

  const negatives = useMemo(() => {
    if (!isOut) return [];
    return entered
      .map(({ item, value }) => {
        const before = balances[item.id] ?? 0;
        return { item, value, before, after: before - value };
      })
      .filter((r) => r.after < 0);
  }, [entered, balances, isOut]);

  const branchName = branches.find((b) => b.id === branchId)?.name || "";

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);

    const rows = entered.map(({ item, value }) => ({
      item_id: item.id,
      movement_type: type,
      quantity: value,
      branch_id: isOut ? branchId : null,
      note: note.trim() || null,
      staff_id: staff.id,
      staff_name: staff.name,
    }));

    const { error } = await supabase.from("stock_movements").insert(rows);
    setSubmitting(false);
    if (error) {
      setSubmitError(error.message);
      setStep("review");
      return;
    }
    setStep("done");
  }

  function onConfirm() {
    if (isOut && negatives.length > 0) setStep("warn");
    else submit();
  }

  const title = isOut ? "Stock Out" : "Stock In";

  // ------------------------------------------------------------------ done
  if (step === "done") {
    return (
      <>
        <Header title={title} />
        <main className="mx-auto max-w-2xl px-4 py-10 text-center">
          <div className="grid place-items-center w-16 h-16 rounded-full bg-green-50 text-green-600 mx-auto mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-xl font-bold">Recorded</h2>
          <p className="text-muted mt-1">
            {entered.length} item{entered.length === 1 ? "" : "s"} logged
            {isOut ? ` to ${branchName}` : ""}.
          </p>
          <div className="grid gap-2.5 mt-8">
            <button
              className="btn-primary"
              onClick={() => {
                setQty({});
                setNote("");
                setSearch("");
                setSubmitError(null);
                setStep(isOut ? "branch" : "entry");
                router.refresh();
              }}
            >
              Log another {title.toLowerCase()}
            </button>
            <button className="btn-ghost" onClick={() => router.push("/menu")}>
              Back to menu
            </button>
          </div>
        </main>
      </>
    );
  }

  // ------------------------------------------------------------------ warn
  if (step === "warn") {
    return (
      <>
        <Header title={title} />
        <main className="mx-auto max-w-2xl px-4 py-6">
          <div className="card p-5 border-amber-200 bg-amber-50">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={22} />
              <div>
                <h2 className="font-bold text-amber-900">This goes below zero</h2>
                <p className="text-sm text-amber-900/80 mt-1">
                  The system thinks you don&rsquo;t have this much. Usually that means an earlier
                  delivery was never keyed in. Check the shelf — if the stock is physically there,
                  submit anyway and tell the manager to log the missing stock in.
                </p>
              </div>
            </div>
          </div>

          <div className="card mt-4 divide-y divide-line">
            {negatives.map(({ item, value, before, after }) => (
              <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{item.name}</p>
                  <p className="text-xs text-muted">
                    In system: {before} {item.uom} &middot; taking {value} {item.uom}
                  </p>
                </div>
                <span className="font-bold text-red-600 shrink-0">
                  {after} {item.uom}
                </span>
              </div>
            ))}
          </div>

          {submitError ? (
            <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
              {submitError}
            </p>
          ) : null}

          <div className="grid gap-2.5 mt-6">
            <button className="btn-primary" onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" size={18} /> : null}
              Submit anyway
            </button>
            <button className="btn-ghost" onClick={() => setStep("entry")} disabled={submitting}>
              Go back and fix
            </button>
          </div>
        </main>
      </>
    );
  }

  // ---------------------------------------------------------------- review
  if (step === "review") {
    return (
      <>
        <Header title={`${title} — review`} />
        <main className="mx-auto max-w-2xl px-4 py-6">
          {isOut ? (
            <div className="card p-4 mb-4 flex items-center gap-3">
              <Store size={18} className="text-accent" />
              <span className="text-sm">
                To: <span className="font-bold">{branchName}</span>
              </span>
            </div>
          ) : null}

          <div className="card divide-y divide-line">
            {entered.map(({ item, value }) => (
              <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{item.name}</p>
                  <p className="text-xs text-muted">{item.category}</p>
                </div>
                <span className="font-bold shrink-0">
                  {value} {item.uom}
                </span>
              </div>
            ))}
          </div>

          {note.trim() ? (
            <p className="text-sm text-muted mt-3">
              Note: <span className="text-ink">{note.trim()}</span>
            </p>
          ) : null}

          <p className="text-sm text-muted mt-3">
            {entered.length} item{entered.length === 1 ? "" : "s"} &middot; logged by{" "}
            <span className="text-ink font-medium">{staff?.name}</span>
          </p>

          {submitError ? (
            <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
              {submitError}
            </p>
          ) : null}

          <div className="grid gap-2.5 mt-6">
            <button className="btn-primary" onClick={onConfirm} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
              Confirm
            </button>
            <button className="btn-ghost" onClick={() => setStep("entry")} disabled={submitting}>
              Edit
            </button>
          </div>
        </main>
      </>
    );
  }

  // ---------------------------------------------------------------- branch
  if (step === "branch") {
    return (
      <>
        <Header title={title} back="/menu" />
        <main className="mx-auto max-w-2xl px-4 py-6">
          <h2 className="text-sm font-semibold text-muted mb-3">Where is this stock going?</h2>
          {loading ? (
            <div className="flex items-center gap-2 text-muted py-10 justify-center">
              <Loader2 className="animate-spin" size={18} /> Loading&hellip;
            </div>
          ) : branches.length === 0 ? (
            <div className="card p-5 text-sm text-muted">
              No destinations yet. Add them in <span className="font-semibold text-ink">Manager &rsaquo; Branches</span>.
            </div>
          ) : (
            <div className="grid gap-2.5">
              {branches.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    setBranchId(b.id);
                    setStep("entry");
                  }}
                  className="card px-4 py-4 flex items-center gap-3 text-left hover:border-accent transition active:scale-[.99]"
                >
                  <Store size={18} className="text-accent shrink-0" />
                  <span className="font-semibold">{b.name}</span>
                </button>
              ))}
            </div>
          )}
        </main>
      </>
    );
  }

  // ----------------------------------------------------------------- entry
  return (
    <>
      <Header title={title} back={isOut ? undefined : "/menu"} />
      <main className="mx-auto max-w-2xl px-4 py-4 pb-32">
        {isOut ? (
          <button
            onClick={() => setStep("branch")}
            className="card w-full p-3 mb-4 flex items-center justify-between gap-3 text-left"
          >
            <span className="flex items-center gap-2.5 text-sm">
              <Store size={17} className="text-accent" />
              To: <span className="font-bold">{branchName}</span>
            </span>
            <span className="text-xs text-accent font-semibold">Change</span>
          </button>
        ) : null}

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
              <h2 className="text-xs font-bold uppercase tracking-wide text-accent mb-2 px-1">
                {category}
              </h2>
              <div className="card divide-y divide-line">
                {rows.map((item) => (
                  <div key={item.id} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted">
                        {item.uom}
                        {isOut ? ` · in system: ${balances[item.id] ?? 0}` : ""}
                      </p>
                    </div>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={qty[item.id] ?? ""}
                      onChange={(e) =>
                        setQty((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      className="input w-24 text-right font-semibold py-2"
                    />
                  </div>
                ))}
              </div>
            </section>
          ))
        )}

        <div className="mt-6">
          <label className="label" htmlFor="note">
            Note (optional)
          </label>
          <input
            id="note"
            className="input"
            placeholder="e.g. DO#1234, supplier delivery"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </main>

      <div className="fixed bottom-0 inset-x-0 bg-base/95 backdrop-blur border-t border-line">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
          <p className="text-sm text-muted flex-1">
            {entered.length === 0
              ? "Key in a quantity"
              : `${entered.length} item${entered.length === 1 ? "" : "s"} ready`}
          </p>
          <button
            className="btn-primary flex-1"
            disabled={entered.length === 0}
            onClick={() => setStep("review")}
          >
            Review
          </button>
        </div>
      </div>
    </>
  );
}
