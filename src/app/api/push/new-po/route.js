import { requireRoles } from "@/lib/apiAuth";
import { alertSubscriptions, sendToSubscriptions } from "@/lib/pushServer";

export const dynamic = "force-dynamic";

function fmtDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * Called by the branch screen right after a PO is submitted.
 * It can only announce a REAL PO that is:
 *   - from the caller's own branch (Super Admin: any)
 *   - still "submitted", created in the last 10 minutes
 *   - not announced before (notified_at is set atomically here)
 * So it cannot be used to spam CK phones.
 */
export async function POST(request) {
  const caller = await requireRoles(request, ["branch", "super_admin"]);
  if (caller.error) return caller.error;
  const { admin, profile } = caller;

  const body = await request.json().catch(() => ({}));
  if (!body.po_id) return Response.json({ error: "po_id required" }, { status: 400 });

  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  let claim = admin
    .from("purchase_orders")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", body.po_id)
    .eq("status", "submitted")
    .is("notified_at", null)
    .gte("created_at", since);
  if (profile.role === "branch") claim = claim.eq("branch_id", profile.branch_id);

  const { data: po, error } = await claim
    .select("id, po_number, delivery_date, ordered_by, branches(name), purchase_order_items(count)")
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!po) return Response.json({ ok: true, skipped: true });

  const subs = await alertSubscriptions(admin);
  const items = po.purchase_order_items?.[0]?.count ?? 0;
  const result = await sendToSubscriptions(admin, subs, {
    title: `New PO — ${po.branches?.name || "Branch"}`,
    body: `${po.po_number} · ${items} item${items === 1 ? "" : "s"} · deliver ${fmtDate(po.delivery_date)} · by ${po.ordered_by}`,
    url: `/po/${encodeURIComponent(po.po_number)}`,
    tag: po.po_number,
  });

  return Response.json({ ok: true, ...result });
}
