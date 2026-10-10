"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, Loader2, Send } from "lucide-react";
import {
  disablePush,
  enablePush,
  pushState,
  refreshPushOwner,
  registerWorker,
  sendTestPush,
} from "@/lib/pushClient";

/**
 * CK menu card: turn phone alerts for new POs on/off for THIS phone.
 */
export default function PushToggle() {
  const [state, setState] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    registerWorker();
    pushState().then((s) => {
      setState(s);
      if (s === "on") refreshPushOwner();
    });
  }, []);

  async function turnOn() {
    setBusy(true);
    setMessage(null);
    try {
      await enablePush();
      setState("on");
      setMessage({ ok: true, text: "Alerts on. Tap “Send test” to check." });
    } catch (e) {
      setMessage({ ok: false, text: e.message });
      setState(await pushState());
    }
    setBusy(false);
  }

  async function turnOff() {
    setBusy(true);
    setMessage(null);
    await disablePush();
    setState(await pushState());
    setBusy(false);
  }

  async function test() {
    setBusy(true);
    setMessage(null);
    try {
      await sendTestPush();
      setMessage({ ok: true, text: "Test sent — it should pop up within a few seconds." });
    } catch (e) {
      setMessage({ ok: false, text: e.message });
    }
    setBusy(false);
  }

  if (state === "loading") return null;

  const info = {
    "need-homescreen": "To get PO alerts on iPhone, open this app from its home-screen icon (not Safari).",
    unsupported: "This phone or browser can’t receive alerts. iPhone needs iOS 16.4 or newer.",
    "no-keys": "Alerts are not set up on the server yet (VAPID keys missing).",
    denied: "Alerts are blocked on this phone. Turn them on in Settings → Notifications → CK Store, then reopen the app.",
  }[state];

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <span
          className={`grid place-items-center w-11 h-11 rounded-xl shrink-0 ${
            state === "on" ? "bg-green-50 text-green-700" : "bg-base text-accent"
          }`}
        >
          {state === "on" ? <BellRing size={20} /> : <BellOff size={20} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">PO alerts on this phone</p>
          <p className="text-xs text-muted">
            {state === "on" ? "On ✓ — you’ll be notified of every new PO" : info || "Off — get a notification for every new PO"}
          </p>
        </div>
      </div>

      {state === "off" ? (
        <button className="btn-primary w-full mt-3" onClick={turnOn} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" size={17} /> : <BellRing size={17} />}
          Turn on PO alerts
        </button>
      ) : null}

      {state === "on" ? (
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button className="btn-ghost text-sm" onClick={test} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}
            Send test
          </button>
          <button className="btn-ghost text-sm" onClick={turnOff} disabled={busy}>
            <BellOff size={15} />
            Turn off
          </button>
        </div>
      ) : null}

      {message ? (
        <p
          className={`text-sm mt-3 rounded-xl p-3 border ${
            message.ok ? "text-green-800 bg-green-50 border-green-200" : "text-red-700 bg-red-50 border-red-200"
          }`}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
