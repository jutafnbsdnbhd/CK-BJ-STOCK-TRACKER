"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Ban,
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Loader2,
  Share2,
  Store,
  Truck,
  User,
  XCircle,
} from "lucide-react";
import Header from "@/components/Header";
import AuthGate, { useProfile } from "@/components/AuthGate";
import PoStatusBadge from "@/components/PoStatusBadge";
import { supabase } from "@/lib/supabaseClient";
import { groupByCategory } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/dates";
import { buildPoPdfFile, canShareFiles, downloadFile } from "@/lib/poPdf";
import { ALL_ROLES, BRANCH, CK_ROLES, SUPER_ADMIN } from "@/lib/roles";

function fmtQty(n) {
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3)));
}

/**
 * One Purchase Order.
 *  Branch: share the PDF to the CK WhatsApp group, cancel while "Submitted".
 *  CK: Convert to DO, or Reject with a reason.
 *
 * The PDF is built as soon as the page loads, so the Share button can hand
 * it over INSTANTLY when tapped — iPhones refuse to share if there is any
 * delay between the tap and the share.
 */
function PoScreen({ number }) {
  const profile = useProfile();
  const params = useSearchParams();
  const justSubmitted = params.get("new") === "1";

  const [po, setPo] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [pdfFile, setPdfFile] = useState(null);
  const [pdfError, setPdfError] = useState(null);
  const [shareSupported, setShareSupported] = useState(false);
  const [shareMessage, setShareMessage] = useState(null);

  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState(null);

  const load = useCallback(async () => {
    const { data: header, error: headerError } = await supabase
      .from("purchase_orders")
      .select(
        "id, po_number, status, po_date, delivery_date, ordered_by, note, created_at, cancelled_at, converted_at, rejected_at, reject_reason, branch_id, branches(name, code), delivery_orders(do_number)"
      )
      .eq("po_number", number)
      .maybeSingle();

    if (headerError) {
      setError(headerError.message);
      setLoading(false);
      return;
    }
    if (!header) {
      setError("not_found");
      setLoading(false);
      return;
    }

    const { data: rows, error: linesError } = await supabase
      .from("purchase_order_items")
      .select("id, item_id, qty_requested, items(name, category, uom)")
      .eq("po_id", header.id);

    if (linesError) setError(linesError.message);
    else {
      setPo(header);
      setLines(rows || []);
    }
    setLoading(false);
  }, [number]);

  useEffect(() => {
    setShareSupported(canShareFiles());
    load();
  }, [load]);

  // Build the PDF as soon as the PO is loaded (and again if it changes).
  useEffect(() => {
    if (!po) return;
    let cancelled = false;
    setPdfFile(null);
    setPdfError(null);
    buildPoPdfFile(po, lines)
      .then((file) => !cancelled && setPdfFile(file))
      .catch((e) => !cancelled && setPdfError(e?.message || "Could not build the PDF"));
    return () => {
      cancelled = true;
    };
  }, [po, lines]);

  const grouped = useMemo(
    () =>
      groupByCategory(
        lines.map((l) => ({
          ...l,
          category: l.items?.category || "Off Season",
          name: l.items?.name || "—",
          uom: l.items?.uom || "",
        }))
      ),
    [lines]
  );

  // Must stay synchronous up to navigator.share() — no awaits before it.
  function share() {
    if (!pdfFile) return;
    setShareMessage(null);
    if (shareSupported) {
      navigator
        .share({
          files: [pdfFile],
          title: po.po_number,
          text: `${po.po_number} — ${po.branches?.name} — delivery ${formatDate(po.delivery_date)}`,
        })
        .catch((e) => {
          if (e?.name !== "AbortError") {
            setShareMessage("Sharing didn't work on this phone. Use Download PDF and attach it in WhatsApp.");
          }
        });
    } else {
      downloadFile(pdfFile);
      setShareMessage("PDF saved. Open WhatsApp → CK group → attach (📎) → Document → choose this file.");
    }
  }

  function viewPdf() {
    if (!pdfFile) return;
    const url = URL.createObjectURL(pdfFile);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function rejectPo() {
    const reason = window.prompt(
      `Reject ${po.po_number} from ${po.branches?.name}?\nThe branch will see this reason:`
    );
    if (reason === null) return;
    if (!reason.trim()) {
      setActionError("A reason is required to reject.");
      return;
    }
    setCancelling(true);
    setActionError(null);
    const { error } = await supabase.rpc("reject_po", { p_po_id: po.id, p_reason: reason.trim() });
    setCancelling(false);
    if (error) setActionError(error.message);
    else await load();
  }

  async function cancelPo() {
    if (!window.confirm(`Cancel ${po.po_number}?\nIf already shared in WhatsApp, tell the CK group it is cancelled.`)) return;
    setCancelling(true);
    setActionError(null);
    const { error } = await supabase.rpc("cancel_po", { p_po_id: po.id });
    setCancelling(false);
    if (error) setActionError(error.message);
    else await load();
  }

  const isCK = CK_ROLES.includes(profile.role);
  const backHref = profile.role === BRANCH ? "/branch" : "/pending-pos";
  const canCancel =
    po?.status === "submitted" &&
    (profile.role === SUPER_ADMIN || (profile.role === BRANCH && po.branch_id === profile.branch_id));
  const isBranchSide = profile.role === BRANCH || profile.role === SUPER_ADMIN;

  if (loading) {
    return (
      <>
        <Header title={number} back={backHref} />
        <div className="flex items-center gap-2 text-muted py-20 justify-center">
          <Loader2 className="animate-spin" size={18} />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header title={number} back={backHref} />
        <main className="mx-auto max-w-2xl px-4 py-10 text-center">
          <p className="font-semibold">
            {error === "not_found" ? "Purchase order not found" : "Could not load this purchase order"}
          </p>
          <p className="text-sm text-muted mt-1">{error === "not_found" ? number : error}</p>
          <Link href={backHref} className="btn-ghost mt-5">
            Back
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title={po.po_number} back={backHref} />
      <main className="mx-auto max-w-2xl px-4 py-5 pb-16">
        {justSubmitted && po.status === "submitted" ? (
          <div className="card p-4 mb-4 border-green-200 bg-green-50 flex items-start gap-3">
            <CheckCircle2 className="text-green-600 shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-green-900">
              <p className="font-bold">PO submitted</p>
              <p className="mt-0.5">Now share it to the CK WhatsApp group with the button below.</p>
            </div>
          </div>
        ) : null}

        {/* Header card */}
        <div className="card p-4 grid gap-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-lg font-bold tracking-wide text-accent">{po.po_number}</p>
            <PoStatusBadge status={po.status} />
          </div>
          <p className="flex items-center gap-2">
            <Store size={16} className="text-accent" /> {po.branches?.name}
          </p>
          <p className="flex items-center gap-2">
            <User size={16} className="text-accent" /> Ordered by <span className="font-semibold">{po.ordered_by}</span>
          </p>
          <p className="flex items-center gap-2">
            <CalendarDays size={16} className="text-accent" />
            PO {formatDate(po.po_date)} &middot; Delivery <span className="font-semibold">{formatDate(po.delivery_date)}</span>
          </p>
          <p className="text-xs text-muted">Submitted {formatDateTime(po.created_at)}</p>
          {po.status === "cancelled" ? (
            <p className="text-xs text-muted">Cancelled {formatDateTime(po.cancelled_at)}</p>
          ) : null}
        </div>

        {/* Outcome */}
        {po.status === "converted" && po.delivery_orders?.do_number ? (
          <Link
            href={`/do/${po.delivery_orders.do_number}`}
            className="card p-4 mt-4 flex items-center gap-3 border-green-200 bg-green-50"
          >
            <FileText className="text-green-700 shrink-0" size={20} />
            <div className="text-sm text-green-900 flex-1">
              <p className="font-bold">Delivery Order {po.delivery_orders.do_number}</p>
              <p>Issued {formatDateTime(po.converted_at)} · tap to view</p>
            </div>
          </Link>
        ) : null}
        {po.status === "rejected" ? (
          <div className="card p-4 mt-4 flex items-start gap-3 border-red-200 bg-red-50">
            <Ban className="text-red-600 shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-red-900">
              <p className="font-bold">Rejected by CK Store</p>
              <p className="mt-0.5">Reason: {po.reject_reason}</p>
              <p className="text-xs mt-1">{formatDateTime(po.rejected_at)}</p>
            </div>
          </div>
        ) : null}

        {/* CK actions */}
        {isCK && po.status === "submitted" ? (
          <div className="grid gap-2.5 mt-4">
            <Link href={`/po/${encodeURIComponent(po.po_number)}/convert`} className="btn-primary">
              <Truck size={18} /> Convert to Delivery Order
            </Link>
            <button className="btn-ghost text-red-600" onClick={rejectPo} disabled={cancelling}>
              <Ban size={17} /> Reject PO
            </button>
          </div>
        ) : null}

        {/* Share */}
        {isBranchSide && po.status === "submitted" ? (
          <div className="grid gap-2.5 mt-4">
            <button className="btn-primary" onClick={share} disabled={!pdfFile}>
              {!pdfFile && !pdfError ? (
                <>
                  <Loader2 className="animate-spin" size={18} /> Preparing PDF&hellip;
                </>
              ) : shareSupported ? (
                <>
                  <Share2 size={18} /> Share to WhatsApp
                </>
              ) : (
                <>
                  <Download size={18} /> Download PDF
                </>
              )}
            </button>
            {shareMessage ? (
              <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3">
                {shareMessage}
              </p>
            ) : null}
            {pdfError ? (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                PDF problem: {pdfError}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Lines */}
        <div className="mt-5">
          {grouped.map(({ category, items }) => (
            <section key={category} className="mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wide text-accent mb-2 px-1">{category}</h2>
              <div className="card divide-y divide-line">
                {items.map((l) => (
                  <div key={l.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <p className="font-medium min-w-0 truncate">{l.name}</p>
                    <span className="font-bold shrink-0">
                      {fmtQty(l.qty_requested)} {l.uom}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {po.note ? (
          <p className="card p-4 text-sm">
            <span className="text-muted">Note: </span>
            {po.note}
          </p>
        ) : null}

        {/* Secondary actions */}
        <div className="grid gap-2.5 mt-6">
          <button className="btn-ghost" onClick={viewPdf} disabled={!pdfFile}>
            <Eye size={17} /> View PDF
          </button>
          {shareSupported && pdfFile && isBranchSide ? (
            <button className="btn-ghost" onClick={() => downloadFile(pdfFile)}>
              <Download size={17} /> Download PDF
            </button>
          ) : null}
          {canCancel ? (
            <button className="btn-ghost text-red-600" onClick={cancelPo} disabled={cancelling}>
              {cancelling ? <Loader2 className="animate-spin" size={17} /> : <XCircle size={17} />}
              Cancel this PO
            </button>
          ) : null}
          {actionError ? (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{actionError}</p>
          ) : null}
        </div>
      </main>
    </>
  );
}

export default function PoPage({ params }) {
  const number = decodeURIComponent(params.number);
  return (
    <AuthGate allow={ALL_ROLES}>
      <Suspense fallback={null}>
        <PoScreen number={number} />
      </Suspense>
    </AuthGate>
  );
}
