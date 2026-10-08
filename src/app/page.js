"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, LogIn, Package } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { signOut } from "@/lib/authClient";
import { homeFor, usernameToEmail, normalizeUsername } from "@/lib/roles";
import { KITCHEN_NAME, KITCHEN_LOCATION } from "@/lib/constants";

/**
 * Login. Username + password for every account.
 * Already logged in on this device → straight to that account's home page.
 */
function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();

  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    params.get("inactive") ? "This account has been deactivated. Ask your manager." : null
  );

  async function goHome(userId) {
    const { data: profile } = await supabase
      .from("app_users")
      .select("role, is_active")
      .eq("id", userId)
      .maybeSingle();

    if (!profile || !profile.is_active) {
      await signOut();
      setError(
        profile
          ? "This account has been deactivated. Ask your manager."
          : "This login is not set up yet. Ask your manager."
      );
      return false;
    }
    router.replace(homeFor(profile.role));
    return true;
  }

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session && (await goHome(session.user.id))) return;
      setChecking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });

    if (error || !data?.user) {
      setBusy(false);
      setError(
        /banned/i.test(error?.message || "")
          ? "This account has been deactivated. Ask your manager."
          : "Wrong username or password."
      );
      return;
    }

    const ok = await goHome(data.user.id);
    if (!ok) setBusy(false);
  }

  if (checking) {
    return (
      <div className="flex items-center gap-2 text-muted py-20 justify-center">
        <Loader2 className="animate-spin" size={18} />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <div className="grid place-items-center w-16 h-16 rounded-2xl bg-accent text-white mx-auto mb-5 shadow-sm">
        <Package size={30} />
      </div>
      <h1 className="text-2xl font-bold text-center">{KITCHEN_NAME}</h1>
      <p className="text-sm text-muted text-center mt-1">{KITCHEN_LOCATION} &middot; Stock &amp; Orders</p>

      <form onSubmit={submit} className="mt-8 grid gap-3">
        <div>
          <label className="label" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            className="input"
            value={username}
            onChange={(e) => setUsername(normalizeUsername(e.target.value))}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="e.g. uptown"
          />
        </div>

        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className="input pr-11"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>
        ) : null}

        <button className="btn-primary mt-2" disabled={busy || !username || !password}>
          {busy ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
          Log in
        </button>
      </form>

      <p className="text-xs text-muted text-center mt-8">
        Forgot your password? Ask your CK Incharge or the Super Admin to reset it.
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}
