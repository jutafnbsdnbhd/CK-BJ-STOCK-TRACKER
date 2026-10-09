"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ClipboardList, Loader2, LogOut, Plus, Store } from "lucide-react";
import Header from "@/components/Header";
import AuthGate, { useProfile } from "@/components/AuthGate";
import PoStatusBadge from "@/components/PoStatusBadge";
import { supabase } from "@/lib/supabaseClient";
import { signOut } from "@/lib/authClient";
import { formatDate } from "@/lib/dates";
import { BRANCH, SUPER_ADMIN } from "@/lib/roles";

/**
 * Branch home: place a new PO, and see this branch's recent POs.
 * (Super Admin sees every branch's POs here, for checking.)
 */
function BranchHome() {
  const router = useRouter();
  const profile = useProfile();
  const isAdmin = profile.role === SUPER_ADMIN;
  const branchName = profile.branches?.name || "All branches (Super Admin)";

  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      // The database only returns this branch's POs to a branch account.
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("id, po_number, status, po_date, delivery_date, ordered_by, branches(name), purchase_order_items(count)")
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) setError(error.message);
      else setPos(data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <>
      <Header
        title={profile.display_name}
        right={
          <div className="flex gap-2">
            {isAdmin ? (
              <Link href="/menu" className="btn-ghost text-sm px-3 py-2">
                CK
              </Link>
            ) : null}
            <button
              className="btn-ghost text-sm px-3 py-2"
              onClick={async () => {
                await signOut();
                router.replace("/");
              }}
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        }
      />
      <main className="mx-auto max-w-2xl px-4 py-6 pb-16">
        <div className="card p-4 flex items-center gap-3 mb-4">
          <span className="grid place-items-center w-10 h-10 rounded-xl bg-base text-accent shrink-0">
            <Store size={19} />
          </span>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted font-semibold">Branch</p>
            <p className="font-bold truncate">{branchName}</p>
          </div>
        </div>

        <Link
          href="/branch/new-po"
          className="card p-6 flex items-center gap-4 hover:border-accent transition active:scale-[.99] mb-6"
        >
          <span className="grid place-items-center w-14 h-14 rounded-2xl bg-accent text-white shrink-0">
            <Plus size={28} />
          </span>
          <span>
            <span className="block text-xl font-bold">New Purchase Order</span>
            <span className="block text-sm text-muted mt-0.5">Order from CK Store for tomorrow</span>
          </span>
        </Link>

        <h2 className="text-xs font-bold uppercase tracking-wide text-accent mb-2 px-1 flex items-center gap-1.5">
          <ClipboardList size={14} /> Recent Purchase Orders
        </h2>

        {loading ? (
          <div className="flex items-center gap-2 text-muted py-10 justify-center">
            <Loader2 className="animate-spin" size={18} /> Loading&hellip;
          </div>
        ) : error ? (
          <div className="card p-4 text-sm text-red-700 bg-red-50 border-red-200">{error}</div>
        ) : pos.length === 0 ? (
          <p className="card px-4 py-6 text-sm text-muted text-center">No purchase orders yet.</p>
        ) : (
          <div className="card divide-y divide-line">
            {pos.map((po) => (
              <Link
                key={po.id}
                href={`/po/${po.po_number}`}
                className="px-4 py-3 flex items-center gap-3 hover:bg-base/60 transition"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold tracking-wide truncate">{po.po_number}</p>
                  <p className="text-xs text-muted truncate">
                    {isAdmin ? `${po.branches?.name} · ` : ""}
                    Delivery {formatDate(po.delivery_date)} · {po.purchase_order_items?.[0]?.count ?? 0} items
                  </p>
                  <div className="mt-1.5">
                    <PoStatusBadge status={po.status} />
                  </div>
                </div>
                <ChevronRight size={18} className="text-muted shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

export default function BranchPage() {
  return (
    <AuthGate allow={[BRANCH, SUPER_ADMIN]}>
      <BranchHome />
    </AuthGate>
  );
}
