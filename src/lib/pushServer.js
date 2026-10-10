import "server-only";
import webpush from "web-push";

// Who gets PO alerts: Super Admin, CK Incharge, CK Staff (active accounts).
export const ALERT_ROLES = ["super_admin", "ck_incharge", "ck_staff"];

let configured = false;
function configure() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:jutafnb@gmail.com";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

/**
 * Send one notification to a list of subscription rows.
 * Phones that no longer accept alerts (404 / 410) are deleted, so the list
 * cleans itself up. Returns { sent, removed, failed }.
 */
export async function sendToSubscriptions(admin, subs, payload) {
  if (!configure()) return { sent: 0, removed: 0, failed: subs.length, error: "VAPID keys missing" };

  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  const dead = [];
  const ok = [];

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 60 * 60 * 12, urgency: "high" }
        );
        sent += 1;
        ok.push(s.id);
      } catch (e) {
        if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(s.id);
        else failed += 1;
      }
    })
  );

  if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead);
  if (ok.length) {
    await admin.from("push_subscriptions").update({ last_ok_at: new Date().toISOString() }).in("id", ok);
  }
  return { sent, removed: dead.length, failed };
}

/** All subscriptions belonging to active alert-role accounts. */
export async function alertSubscriptions(admin) {
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, app_users!inner(role, is_active)")
    .eq("app_users.is_active", true)
    .in("app_users.role", ALERT_ROLES);
  if (error) throw error;
  return data || [];
}
