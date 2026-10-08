"use client";

import { supabase } from "@/lib/supabaseClient";
import { clearStaff } from "@/lib/session";

// fetch() that carries the logged-in session, so /api/* routes know who is
// asking. The server checks the role on every request — this header is the
// only thing it trusts.
export async function authFetch(url, options = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers = new Headers(options.headers || {});
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  return fetch(url, { ...options, headers });
}

export async function signOut() {
  clearStaff();
  await supabase.auth.signOut();
}
