import { requireRoles } from "@/lib/apiAuth";
import { ALERT_ROLES } from "@/lib/pushServer";

export const dynamic = "force-dynamic";

// Save this phone for PO alerts (or move it to whoever is now logged in).
export async function POST(request) {
  const caller = await requireRoles(request, ALERT_ROLES);
  if (caller.error) return caller.error;

  const body = await request.json().catch(() => ({}));
  const sub = body.subscription || {};
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return Response.json({ error: "Invalid subscription" }, { status: 400 });
  }
  if (!/^https:\/\//.test(sub.endpoint)) {
    return Response.json({ error: "Invalid endpoint" }, { status: 400 });
  }

  const { error } = await caller.admin.from("push_subscriptions").upsert(
    {
      user_id: caller.profile.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: String(request.headers.get("user-agent") || "").slice(0, 300),
    },
    { onConflict: "endpoint" }
  );
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

// Turn alerts off for this phone.
export async function DELETE(request) {
  const caller = await requireRoles(request, ALERT_ROLES);
  if (caller.error) return caller.error;
  const body = await request.json().catch(() => ({}));
  if (!body.endpoint) return Response.json({ error: "endpoint required" }, { status: 400 });
  await caller.admin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", body.endpoint)
    .eq("user_id", caller.profile.id);
  return Response.json({ ok: true });
}
