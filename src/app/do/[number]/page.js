"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, Printer } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import DeliveryOrderDoc from "@/components/DeliveryOrderDoc";
import { COMPANY } from "@/lib/company";
import AuthGate, { useProfile } from "@/components/AuthGate";
import { ALL_ROLES, homeFor } from "@/lib/roles";

function DeliveryOrderScreen({ params }) {
  const number = decodeURIComponent(params.number);
  const profile = useProfile();
  const backHref = profile?.role === "branch" ? homeFor("branch") : "/menu";
  const [order, setOrder] = useState(null);
  const [po, setPo] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: doRow, error: doErr } = await supabase
        .from("delivery_orders")
        .select("id, do_number, do_date, staff_name, note, created_at, branches(name)")
        .eq("do_number", number)
        .maybeSingle();

      if (doErr || !doRow) {
        setError(doErr?.message || `No delivery order found with number ${number}.`);
        setLoading(false);
        return;
      }

      const [{ data: lineRows, error: lineErr }, { data: poRow, error: poErr }] = await Promise.all([
        supabase
          .from("stock_movements")
          .select("id, item_id, quantity, items(name, uom, category)")
          .eq("do_id", doRow.id)
          .order("created_at"),
        supabase
          .from("purchase_orders")
          .select("id, po_number, po_date, ordered_by")
          .eq("do_id", doRow.id)
          .maybeSingle(),
      ]);

      if (lineErr || poErr) {
        setError((lineErr || poErr).message);
        setLoading(false);
        return;
      }

      let finalLines = lineRows || [];

      // Made from a PO: show every ordered line — ordered vs sent — so a
      // shortage is visible on paper, not discovered at the branch.
      if (poRow) {
        const { data: poLines, error: poLinesErr } = await supabase
          .from("purchase_order_items")
          .select("id, item_id, qty_requested, items(name, uom, category)")
          .eq("po_id", poRow.id);
        if (poLinesErr) {
          setError(poLinesErr.message);
          setLoading(false);
          return;
        }
        const sentByItem = {};
        for (const m of finalLines) sentByItem[m.item_id] = (sentByItem[m.item_id] || 0) + Number(m.quantity);
        finalLines = (poLines || []).map((pl) => ({
          id: pl.id,
          item_id: pl.item_id,
          items: pl.items,
          requested: Number(pl.qty_requested),
          quantity: sentByItem[pl.item_id] || 0,
        }));
      }

      setOrder(doRow);
      setPo(poRow || null);
      setLines(finalLines);
      setLoading(false);
    })();
  }, [number]);

  // The browser prints document.title in the page header, so make it say
  // something useful instead of "about:blank".
  useEffect(() => {
    document.title = `${COMPANY.pageTitle} — ${number}`;
  }, [number]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted py-20 justify-center">
        <Loader2 className="animate-spin" size={18} /> Loading delivery order&hellip;
      </div>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="card p-5 text-sm text-red-700 bg-red-50 border-red-200">{error}</p>
        <Link href={backHref} className="btn-ghost mt-5">
          Back to menu
        </Link>
      </main>
    );
  }

  return (
    <>
      {/* Screen-only toolbar — hidden by @media print */}
      <div className="no-print sticky top-0 z-20 bg-base/95 backdrop-blur border-b border-line">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-3">
          <Link
            href={backHref}
            className="shrink-0 rounded-lg p-1.5 -ml-1.5 hover:bg-white active:scale-95 transition"
            aria-label="Back"
          >
            <ChevronLeft size={22} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold truncate">{order.do_number}</h1>
            <p className="text-xs text-muted truncate">
              {order.branches?.name} &middot; {order.do_date}
            </p>
          </div>
          <button className="btn-primary py-2 px-3 text-sm" onClick={() => window.print()}>
            <Printer size={16} />
            Print / PDF
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-5 print:p-0 print:max-w-none">
        <div className="do-shell card p-6 print:border-0 print:shadow-none print:p-0 print:rounded-none overflow-x-auto">
          <DeliveryOrderDoc order={order} lines={lines} po={po} />
        </div>

        <div className="no-print card p-4 mt-4 text-sm text-muted">
          <p className="font-semibold text-ink mb-1">Saving this as a PDF</p>
          <p>
            Tap <span className="font-semibold text-ink">Print / PDF</span>, then:
          </p>
          <ul className="list-disc pl-5 mt-1.5 space-y-0.5">
            <li>
              <span className="font-semibold text-ink">Android:</span> Destination &rarr; Save as
              PDF &rarr; Save. Share it from your Downloads.
            </li>
            <li>
              <span className="font-semibold text-ink">iPhone:</span> in the print preview, tap the
              share icon &rarr; Save to Files, or share straight to WhatsApp.
            </li>
            <li>
              <span className="font-semibold text-ink">Laptop:</span> choose Save as PDF as the
              printer.
            </li>
          </ul>
        </div>
      </main>
    </>
  );
}

export default function DeliveryOrderPage({ params }) {
  return (
    <AuthGate allow={ALL_ROLES}>
      <DeliveryOrderScreen params={params} />
    </AuthGate>
  );
}
