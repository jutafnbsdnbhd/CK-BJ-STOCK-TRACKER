"use client";

import { authFetch } from "@/lib/authClient";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

/**
 * What can this phone do right now?
 *   "unsupported"  — browser cannot do web push at all (old iOS, etc.)
 *   "need-homescreen" — iPhone, but opened in Safari instead of the icon
 *   "no-keys"      — app is missing NEXT_PUBLIC_VAPID_PUBLIC_KEY
 *   "denied"       — person blocked notifications in phone settings
 *   "off" / "on"
 */
export async function pushState() {
  if (typeof window === "undefined") return "unsupported";
  if (isIos() && !isStandalone()) return "need-homescreen";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  if (!VAPID_PUBLIC) return "no-keys";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return sub && Notification.permission === "granted" ? "on" : "off";
}

/** Register the worker early (on page load), so the tap can go straight to the permission prompt. */
export function registerWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
}

/**
 * Must be called directly from a tap. iPhones only show the permission
 * prompt when it comes straight from the person's tap.
 */
export async function enablePush() {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked. Turn them on in phone Settings → Notifications → CK Store."
        : "Notifications were not allowed."
    );
  }
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
  }
  const res = await authFetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Could not save this phone for alerts");
  }
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return;
  await authFetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

/**
 * Re-save the subscription under whoever is logged in now. Phones are shared:
 * if Chamee logs in on a phone Kosan enabled, alerts follow the phone, and
 * the record now says Chamee's account owns it.
 */
export async function refreshPushOwner() {
  try {
    if ((await pushState()) !== "on") return;
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg.pushManager.getSubscription();
    await authFetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
  } catch {}
}

export async function sendTestPush() {
  const res = await authFetch("/api/push/test", { method: "POST" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Test failed");
  if (!json.sent) throw new Error("Nothing was delivered — try turning alerts off and on again.");
}

/** Branch side: tell the server a PO was just submitted. Never blocks the branch. */
export function announceNewPo(poId) {
  authFetch("/api/push/new-po", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ po_id: poId }),
    keepalive: true,
  }).catch(() => {});
}
