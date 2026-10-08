"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, LogOut, Settings, User } from "lucide-react";
import Header from "@/components/Header";
import AuthGate, { useProfile } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";
import { saveStaff } from "@/lib/session";
import { signOut } from "@/lib/authClient";
import { CK_ROLES } from "@/lib/roles";

/**
 * CK device: after the CK account is logged in, the person at the screen
 * picks their name. That name goes on every Stock In / Stock Out row and
 * on the DO as "Staff Name".
 */
function PickScreen() {
  const router = useRouter();
  const profile = useProfile();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) setError(error.message);
      else setStaff(data || []);
      setLoading(false);
    })();
  }, []);

  function pick(person) {
    saveStaff(person);
    router.push("/menu");
  }

  return (
    <>
      <Header
        title={`Logged in: ${profile.display_name}`}
        right={
          <div className="flex gap-2">
            <Link href="/manager" className="btn-ghost text-sm px-3 py-2" aria-label="Manager">
              <Settings size={15} />
              <span className="hidden sm:inline">Manager</span>
            </Link>
            <button
              className="btn-ghost text-sm px-3 py-2"
              onClick={async () => {
                await signOut();
                router.replace("/");
              }}
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        }
      />

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
        <h2 className="text-sm font-semibold text-muted mb-3">Who is using the app?</h2>

        {loading ? (
          <div className="flex items-center gap-2 text-muted py-10 justify-center">
            <Loader2 className="animate-spin" size={18} />
            Loading&hellip;
          </div>
        ) : error ? (
          <div className="card p-4 text-sm text-red-700 bg-red-50 border-red-200">
            Could not load staff list: {error}
          </div>
        ) : staff.length === 0 ? (
          <div className="card p-5 text-sm text-muted">
            No staff names yet. Go to <span className="font-semibold text-ink">Manager &rsaquo; Staff</span> and add
            the people who will be logging stock.
          </div>
        ) : (
          <div className="grid gap-2.5">
            {staff.map((person) => (
              <button
                key={person.id}
                onClick={() => pick(person)}
                className="card px-4 py-4 flex items-center gap-3 text-left hover:border-accent transition active:scale-[.99]"
              >
                <span className="grid place-items-center w-10 h-10 rounded-full bg-base text-accent shrink-0">
                  <User size={18} />
                </span>
                <span className="font-semibold">{person.name}</span>
              </button>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

export default function PickPage() {
  return (
    <AuthGate allow={CK_ROLES}>
      <PickScreen />
    </AuthGate>
  );
}
