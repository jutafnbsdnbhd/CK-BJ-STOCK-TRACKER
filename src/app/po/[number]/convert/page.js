"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CalendarDays, Check, Loader2, Store, Truck, User } from "lucide-react";
import Header from "@/components/Header";
import AuthGate from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";
import { groupByCategory } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { CK_ROLES } from "@/lib/roles";
import { bundleError, bundleHint, packEquivalent, packLabel } from "@/lib/bundles";

function fmt(n) {
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3)));
}

/**
 * CK: turn a PO into a Delivery Order.
 *   Each line starts at the quantity ordered. Lower it to what CK can
 *   actually send; 0 = not available (still printed on the DO, marked).
 *   Confirm → one DO dated on the PO's delivery date, stock deducted,
 *   PO marked converted — all at once.
 */
function ConvertScreen({ number }) {
  const router = useRouter();

  const [po, setPo] = useState(null);
  const [lines, setLines] = useState([]);
  const [balances, setBalances] = useState({});
  const [send, setSend] = useState({}); // { [item_id]: "3" }
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [step, setStep] = useState("entry");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: header, error: e1 } = await supabase
        .from("purchase_orders")
        .select("id, po_number, status, po_date, delivery_date, ordered_by, note, branches(name), delivery_orders(do_number)")
        .eq("po_number", number)
        .maybeSingle();
      if (e1 || !header) {
        setError(e1?.message || "Purchase order not found");
        setLoading(false);
        return;
      }
      const [{ data: rows, error: e2 }, { data: bal, error: e3 }] = await Promise.all([
        supabase
          .from("purchase_order_items")
          .select("id, item_id, qty_requested, items(name, category, uom, min_order, pack_qty, pack_unit)")
          .eq("po_id", header.id),
        supabase.from("item_balances").select("item_id, balance"),
      ]);
      if (e2 || e3) {
        setError((e2 || e3).message);
        setLoading(false);
        return;
      }
      setPo(header);
      setLines(rows || []);
      setBalances(Object.fromEntries((bal || []).map((r) => [r.item_id, Number(r.balance)])));
      setSend(Object.fromEntries((rows || []).map((r) => [r.item_id, fmt(r.qty_requested)])));
      setLoading(false);
    })();
  }, [number]);

  const rows = useMemo(
    () =>
      lines.map((l) => {
        const raw = send[l.item_id];
        const value = raw === "" || raw === undefined ? NaN : Number(raw);
        const balance = balances[l.item_id] ?? 0;
        return {
          ...l,
          name: l.items?.name || "—",
          category: l.items?.category || "Off Season",
          uom: l.items?.uom || "",
          min_order: l.items?.min_order ?? null,
          pack_qty: l.items?.pack_qty ?? null,
          pack_unit: l.items?.pack_unit ?? null,
          requested: Number(l.qty_requested),
          value,
          valid: Number.isFinite(value) && value >= 0,
          balance,
          short: Number.isFinite(value) && value > balance,
        };
      })
      .map((r) => ({
        ...r,
        // Warning only — CK may have a reason. Branches are held to whole
        // bundles; CK is trusted to judge.
        partBundle: r.valid && r.value > 0 ? bundleError(r, r.value) : null,
      })),
    [lines, send, balances]
  );

  const grouped = useMemo(() => groupByCategory(rows), [rows]);
  const allValid = rows.length > 0 && rows.every((r) => r.valid);
  const sending = rows.filter((r) => r.valid && r.value > 0);
  const notAvailable = rows.filter((r) => r.valid && r.value === 0);
  const reduced = rows.filter((r) => r.valid && r.value > 0 && r.value < r.requested);
  const overBalance = sending.filter((r) => r.short);
  const partBundles = sending.filter((r) => r.partBundle);

  async function confirm() {
    setSubmitting(true);
    setSubmitError(null);
    const { data, error } = await supabase.rpc("convert_po_to_do", {
      p_po_id: po.id,
      p_lines: rows.map((r) => ({ item_id: r.item_id, quantity: r.value })),
      p_note: note.trim() || null,
    });
    if (error) {
      setSubmitting(false);
      setSubmitError(error.message);
      return;
    }
    const d = Array.isArray(data) ? data[0] : data;
    router.replace(`/do/${d.do_number}`);
  }

  const back = `/po/${encodeURIComponent(number)}`;

  if (loading) {
    return (
      <>
        <Header title="Convert to DO" back={back} />
        <div className="flex items-center gap-2 text-muted py-20 justify-center">
          <Loader2 className="animate-spin" size={18} />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header title="Convert to DO" back={back} />
        <p className="mx-auto max-w-2xl m-4 card p-4 text-sm text-red-700 bg-red-50 border-red-200">{error}</p>
      </>
    );
  }

  if (po.status !== "submitted") {
    return (
      <>
        <Header title="Convert to DO" back={back} />
        <main className="mx-auto max-w-2xl px-4 py-10 text-center">
          <p className="font-semibold">This PO is already {po.status}.</p>
          {po.delivery_orders?.do_number ? (
            <Link href={`/do/${po.delivery_orders.do_number}`} className="btn-primary mt-5">
              Open {po.delivery_orders.do_number}
            </Link>
          ) : (
            <Link href="/pending-pos" className="btn-ghost mt-5">
              Back to Pending POs
            </Link>
          )}
        </main>
      </>
    );
  }

  const summary = (
    <div className="card p-4 grid gap-1.5 text-sm">
      <p className="flex items-center gap-2">
        <Store size={16} className="text-accent" /> <span className="font-bold">{po.branches?.name}</span>
        <span className="text-muted">· {po.po_number}</span>
      </p>
      <p className="flex items-center gap-2">
        <User size={16} className="text-accent" /> Ordered by {po.ordered_by}
      </p>
      <p className="flex items-center gap-2">
        <CalendarDays size={16} className="text-accent" /> DO date (delivery):{" "}
        <span className="font-bold">{formatDate(po.delivery_date)}</span>
      </p>
      {po.note ? <p className="text-muted">Branch note: {po.note}</p> : null}
    </div>
  );

  // ---------------------------------------------------------------- review
  if (step === "review") {
    return (
      <>
        <Header title="Convert to DO — review" />
        <main className="mx-auto max-w-2xl px-4 py-5 pb-16">
          {summary}

          <h2 className="text-xs font-bold uppercase tracking-wide text-accent mt-5 mb-2 px-1">
            Sending ({sending.length})
          </h2>
          <div className="card divide-y divide-line">
            {sending.map((r) => (
              <div key={r.item_id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{r.name}</p>
                  {r.value < r.requested ? (
                    <p className="text-xs text-amber-700">Ordered {fmt(r.requested)} — sending less</p>
                  ) : r.value > r.requested ? (
                    <p className="text-xs text-muted">Ordered {fmt(r.requested)} — sending more</p>
                  ) : null}
                </div>
                <span className="text-right shrink-0">
                  <span className="block font-bold">
                    {fmt(r.value)} {r.uom}
                  </span>
                  {packEquivalent(r, r.value) ? (
                    <span className="block text-xs text-muted">{packEquivalent(r, r.value)}</span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>

          {notAvailable.length > 0 ? (
            <>
              <h2 className="text-xs font-bold uppercase tracking-wide text-red-600 mt-5 mb-2 px-1">
                Not available ({notAvailable.length}) — printed on the DO as not sent
              </h2>
              <div className="card divide-y divide-line">
                {notAvailable.map((r) => (
                  <div key={r.item_id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <p className="font-medium truncate">{r.name}</p>
                    <span className="text-sm text-muted shrink-0">
                      ordered {fmt(r.requested)} {r.uom}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {partBundles.length > 0 ? (
            <div className="card p-4 mt-5 border-amber-200 bg-amber-50 flex items-start gap-3">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-amber-900">
                <p className="font-bold">Not a whole bundle</p>
                <p className="mt-0.5">
                  {partBundles.map((r) => `${r.name} (${fmt(r.value)} ${r.uom})`).join(", ")}. Bundles are never
                  split — check this is really what you are sending.
                </p>
              </div>
            </div>
          ) : null}

          {overBalance.length > 0 ? (
            <div className="card p-4 mt-5 border-amber-200 bg-amber-50 flex items-start gap-3">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-amber-900">
                <p className="font-bold">Goes below zero in the system</p>
                <p className="mt-0.5">
                  {overBalance.map((r) => r.name).join(", ")}. Check the shelf — if the stock is really there, confirm
                  anyway and log the missing Stock In afterwards.
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-5">
            <label className="label" htmlFor="note">
              Remarks on the DO (optional)
            </label>
            <input
              id="note"
              className="input"
              placeholder="e.g. strawberry out of season"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {submitError ? (
            <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{submitError}</p>
          ) : null}

          <div className="grid gap-2.5 mt-6">
            <button className="btn-primary" onClick={confirm} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" size={18} /> : <Truck size={18} />}
              {overBalance.length > 0 ? "Create DO anyway" : "Create Delivery Order"}
            </button>
            <button className="btn-ghost" onClick={() => setStep("entry")} disabled={submitting}>
              Edit quantities
            </button>
          </div>
        </main>
      </>
    );
  }

  // ----------------------------------------------------------------- entry
  return (
    <>
      <Header title="Convert to DO" back={back} />
      <main className="mx-auto max-w-2xl px-4 py-5 pb-32">
        {summary}
        <p className="text-xs text-muted mt-3 px-1">
          Each line starts at what the branch ordered. Change it to what you can actually send — 0 if not available.
        </p>

        {grouped.map(({ category, items }) => (
          <section key={category} className="mt-5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-accent mb-2 px-1">{category}</h2>
            <div className="card divide-y divide-line">
              {items.map((r) => (
                <div key={r.item_id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{r.name}</p>
                      {bundleHint(r) || packLabel(r) ? (
                        <p className="text-[11px] font-semibold text-accent">
                          {[bundleHint(r), packLabel(r)].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted">
                        Ordered <span className="font-semibold text-ink">{fmt(r.requested)} {r.uom}</span> · CK has{" "}
                        <span className={`font-semibold ${r.balance < r.requested ? "text-red-600" : "text-ink"}`}>
                          {fmt(r.balance)}
                        </span>
                      </p>
                    </div>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={send[r.item_id] ?? ""}
                      onChange={(e) => setSend((prev) => ({ ...prev, [r.item_id]: e.target.value }))}
                      className={`input w-24 text-right font-semibold py-2 ${
                        !r.valid ? "border-red-400" : r.value === 0 ? "text-red-600" : ""
                      }`}
                    />
                  </div>
                  {r.partBundle ? (
                    <p className="text-xs text-amber-700 font-semibold text-right mt-1">
                      Part bundle — {r.partBundle.toLowerCase()}
                    </p>
                  ) : null}
                  <div className="flex gap-2 mt-2 justify-end">
                    <button
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-line"
                      onClick={() => setSend((p) => ({ ...p, [r.item_id]: fmt(r.requested) }))}
                    >
                      Full
                    </button>
                    <button
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-line text-red-600"
                      onClick={() => setSend((p) => ({ ...p, [r.item_id]: "0" }))}
                    >
                      Not available
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>

      <div className="fixed bottom-0 inset-x-0 bg-base/95 backdrop-blur border-t border-line">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
          <p className="text-sm text-muted flex-1">
            {!allValid
              ? "Fill every line (0 if not available)"
              : sending.length === 0
              ? "Nothing to send — reject instead"
              : `${sending.length}/${rows.length} sending${reduced.length ? ` · ${reduced.length} reduced` : ""}`}
          </p>
          <button
            className="btn-primary flex-1"
            disabled={!allValid || sending.length === 0}
            onClick={() => setStep("review")}
          >
            Review
          </button>
        </div>
      </div>
    </>
  );
}

export default function ConvertPage({ params }) {
  const number = decodeURIComponent(params.number);
  return (
    <AuthGate allow={CK_ROLES}>
      <ConvertScreen number={number} />
    </AuthGate>
  );
}
