"use client";

import { useState } from "react";
import { Lock, Loader2 } from "lucide-react";

export default function ManagerLogin({ onSuccess }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/manager/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) onSuccess();
    else setError((await res.json().catch(() => ({}))).error || "Wrong code");
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <div className="grid place-items-center w-14 h-14 rounded-2xl bg-white border border-line text-accent mx-auto mb-5">
        <Lock size={24} />
      </div>
      <h1 className="text-xl font-bold text-center">Manager</h1>
      <p className="text-sm text-muted text-center mt-1">Enter the manager code</p>

      <form onSubmit={submit} className="mt-6 grid gap-3">
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          className="input text-center text-lg tracking-widest"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••"
        />
        {error ? <p className="text-sm text-red-600 text-center">{error}</p> : null}
        <button className="btn-primary" disabled={busy || !password}>
          {busy ? <Loader2 className="animate-spin" size={18} /> : null}
          Enter
        </button>
      </form>
    </main>
  );
}
