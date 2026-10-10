"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import Header from "@/components/Header";
import AuthGate from "@/components/AuthGate";
import PoStatusBadge from "@/components/PoStatusBadge";
import { supabase } from "@/lib/supabaseClient";
import { formatDate, formatDateTime, klToday } from "@/lib/dates";
import { usePendingPoCount } from "@/lib/usePendingPoCount";
import { CK_ROLES } from "@/lib/roles";

/**
 * CK: every PO waiting to be processed, earliest delivery first.
 * Below it, the most recently processed POs for reference.
 */
function PendingScreen() {
  const pendingCount = usePendingPoCount();
  const [pending, setPending] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const today = klToday();

  const load = useCallback(async () => {
    const select =
      "id, po_number, status, po_date, delivery_date, ordered_by, created_at, converted_at, rejected_at, branches(name), purchase_order_items(count), delivery_orders(do_number)";
    const [p, r] = await Promise.all([
      supabase
        .from("purchase_orders")
        .select(select)
        .eq("status", "submitted")
        .order("delivery_date", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("purchase_orders")
        .select(select)
        .in("status", ["converted", "rejected", "cancelled"])
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    const err = p.error || r.error;
    if (err) setError(err.message);
    else {
      setError(null);
      setPending(p.data || []);
      setRecent(r.data || []);
    }
    setLoading(false);
  }, []);

  // Reload the list whenever the waiting count changes.
  useEffect(() => {
    load();
  }, [load, pendingCount]);

  return (
    <>
      <Header
        title="Pending POs"
        back="/menu"
        right={
          <button className="btn-ghost text-sm px-3 py-2" onClick={load} aria-label="Refresh">
            <RefreshCw size={15} />
          </button>
        }
      />
      <main className="mx-auto max-w-2xl px-4 py-5 pb-16">
        {loading ? (
          <div className="flex items-center gap-2 text-muted py-10 justify-center">
            <Loader2 className="animate-spin" size={18} /> Loading&hellip;
          </div>
        ) : error ? (
          <div className="card p-4 text-sm text-red-700 bg-red-50 border-red-200">{error}</div>
        ) : (
          <>
            <h2 className="text-xs font-bold uppercase tracking-wide text-accent mb-2 px-1">
              Waiting ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <p className="card px-4 py-6 text-sm text-muted text-center mb-6">
                Nothing waiting. New POs appear here automatically.
              </p>
            ) : (
              <div className="card divide-y divide-line mb-6">
                {pending.map((po) => {
                  const late = po.delivery_date <= today;
                  return (
                    <Link
                      key={po.id}
                      href={`/po/${po.po_number}`}
                      className="px-4 py-3.5 flex items-center gap-3 hover:bg-base/60 transition"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold truncate">{po.branches?.name}</p>
                        <p className="text-sm tracking-wide truncate">{po.po_number}</p>
                        <p className="text-xs text-muted truncate">
                          {po.purchase_order_items?.[0]?.count ?? 0} items · by {po.ordered_by} ·{" "}
                          {formatDateTime(po.created_at)}
                        </p>
                        <p
                          className={`text-xs font-semibold mt-1 flex items-center gap-1 ${
                            late ? "text-red-600" : "text-ink"
                          }`}
                        >
                          {late ? <AlertTriangle size={13} /> : null}
                          Deliver {formatDate(po.delivery_date)}
                          {po.delivery_date < today ? " — overdue" : po.delivery_date === today ? " — today" : ""}
                        </p>
                      </div>
                      <ChevronRight size={18} className="text-muted shrink-0" />
                    </Link>
                  );
                })}
              </div>
            )}

            <h2 className="text-xs font-bold uppercase tracking-wide text-muted mb-2 px-1">Recently processed</h2>
            {recent.length === 0 ? (
              <p className="card px-4 py-6 text-sm text-muted text-center">None yet.</p>
            ) : (
              <div className="card divide-y divide-line">
                {recent.map((po) => (
                  <Link
                    key={po.id}
                    href={`/po/${po.po_number}`}
                    className="px-4 py-3 flex items-center gap-3 hover:bg-base/60 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">
                        {po.branches?.name} · <span className="font-normal">{po.po_number}</span>
                      </p>
                      <p className="text-xs text-muted truncate">
                        {po.delivery_orders?.do_number ? `${po.delivery_orders.do_number} · ` : ""}
                        Deliver {formatDate(po.delivery_date)}
                      </p>
                      <div className="mt-1">
                        <PoStatusBadge status={po.status} />
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-muted shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

export default function PendingPosPage() {
  return (
    <AuthGate allow={CK_ROLES}>
      <PendingScreen />
    </AuthGate>
  );
}
