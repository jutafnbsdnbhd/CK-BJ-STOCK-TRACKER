import { requireRoles } from "@/lib/apiAuth";
import { ALERT_ROLES, sendToSubscriptions } from "@/lib/pushServer";

export const dynamic = "force-dynamic";

// "Send test alert" — only to the caller's own phones.
export async function POST(request) {
  const caller = await requireRoles(request, ALERT_ROLES);
  if (caller.error) return caller.error;

  const { data: subs, error } = await caller.admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", caller.profile.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!subs?.length) return Response.json({ error: "Alerts are not turned on for your account yet" }, { status: 400 });

  const result = await sendToSubscriptions(caller.admin, subs, {
    title: "CK Store — test alert",
    body: `Alerts are working for ${caller.profile.display_name}.`,
    url: "/pending-pos",
    tag: "test",
  });
  if (result.error) return Response.json({ error: "Server is missing the alert keys (VAPID)" }, { status: 500 });
  return Response.json({ ok: true, ...result });
}
