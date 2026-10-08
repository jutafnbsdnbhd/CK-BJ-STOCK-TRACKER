"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldOff } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { signOut } from "@/lib/authClient";
import { homeFor } from "@/lib/roles";

const ProfileContext = createContext(null);

/** The logged-in account: { id, username, display_name, role, branch_id, branches } */
export function useProfile() {
  return useContext(ProfileContext);
}

/**
 * Wrap a page in this. It:
 *   - sends anyone not logged in back to the login screen
 *   - logs out a deactivated account
 *   - shows "not for your account" if the role is not in `allow`
 *
 * This decides what the SCREEN shows. What the account can actually read or
 * write is enforced separately by the database (migrations 004 / 005).
 */
export default function AuthGate({ allow, children }) {
  const router = useRouter();
  const [state, setState] = useState({ status: "loading", profile: null });
  const allowKey = (allow || []).join(",");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/");
        return;
      }

      const { data: profile } = await supabase
        .from("app_users")
        .select("id, username, display_name, role, branch_id, is_active, branches(name)")
        .eq("id", session.user.id)
        .maybeSingle();

      if (cancelled) return;

      if (!profile || !profile.is_active) {
        await signOut();
        router.replace("/?inactive=1");
        return;
      }

      const allowed = allowKey ? allowKey.split(",") : null;
      setState({
        status: allowed && !allowed.includes(profile.role) ? "denied" : "ok",
        profile,
      });
    })();

    // Logged out in another tab, or the session could not be refreshed.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/");
    });

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, [router, allowKey]);

  if (state.status === "loading") {
    return (
      <div className="flex items-center gap-2 text-muted py-20 justify-center">
        <Loader2 className="animate-spin" size={18} />
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <main className="mx-auto max-w-sm px-4 py-20 text-center">
        <div className="grid place-items-center w-14 h-14 rounded-2xl bg-white border border-line text-accent mx-auto mb-5">
          <ShieldOff size={24} />
        </div>
        <h1 className="text-lg font-bold">Not available for your account</h1>
        <p className="text-sm text-muted mt-1">
          You are logged in as <span className="font-semibold text-ink">{state.profile.display_name}</span>.
        </p>
        <button className="btn-primary w-full mt-6" onClick={() => router.replace(homeFor(state.profile.role))}>
          Go to my home page
        </button>
      </main>
    );
  }

  return <ProfileContext.Provider value={state.profile}>{children}</ProfileContext.Provider>;
}
