"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { playChime, unlockAudio } from "@/lib/chime";

/**
 * How many POs are waiting for CK ("submitted").
 * Checks every 20 seconds, and straight away when the app comes back to
 * the front. When the number goes UP, it chimes (and buzzes on Android).
 *
 * Only works while the app is open — phone notifications for a closed
 * app are Phase 3b. WhatsApp stays the guaranteed alert.
 */
export function usePendingPoCount(intervalMs = 20000) {
  const [count, setCount] = useState(null);
  const previous = useRef(null);

  useEffect(() => {
    let stopped = false;

    async function check() {
      const { count: c, error } = await supabase
        .from("purchase_orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "submitted");
      if (stopped || error || c === null) return;

      if (previous.current !== null && c > previous.current) {
        playChime();
        try {
          navigator.vibrate?.([200, 100, 200]);
        } catch {}
      }
      previous.current = c;
      setCount(c);
      document.title = c > 0 ? `(${c}) CK Store` : "CK Store — Bukit Jalil";
    }

    check();
    const timer = setInterval(check, intervalMs);
    const onVisible = () => document.visibilityState === "visible" && check();
    const onFirstTap = () => unlockAudio();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pointerdown", onFirstTap, { once: true });

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pointerdown", onFirstTap);
    };
  }, [intervalMs]);

  return count;
}
