"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, User, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { saveStaff } from "@/lib/session";
import { KITCHEN_NAME } from "@/lib/constants";

export default function HomePage() {
  const router = useRouter();
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
    <main className="mx-auto max-w-2xl px-4 pb-16">
      <div className="flex items-start justify-between pt-8 pb-6">
        <div>
          <p className="text-sm text-muted">A&rsquo;rest {KITCHEN_NAME}</p>
          <h1 className="text-2xl font-bold mt-0.5">Central Kitchen Stock</h1>
        </div>
        <Link href="/manager" className="btn-ghost text-sm px-3 py-2">
          <Lock size={15} />
          Manager
        </Link>
      </div>

      <h2 className="text-sm font-semibold text-muted mb-3">Who are you?</h2>

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
          No staff have been added yet. Go to <span className="font-semibold text-ink">Manager &rsaquo; Staff</span> and
          add the people who will be logging stock.
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
  );
}
