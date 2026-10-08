"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, Settings, Users } from "lucide-react";
import Header from "@/components/Header";
import AuthGate from "@/components/AuthGate";
import { loadStaff, clearStaff } from "@/lib/session";
import { CK_ROLES } from "@/lib/roles";

function MenuScreen() {
  const router = useRouter();
  const [staff, setStaff] = useState(null);

  useEffect(() => {
    const person = loadStaff();
    if (!person) router.replace("/pick");
    else setStaff(person);
  }, [router]);

  if (!staff) return null;

  return (
    <>
      <Header
        title={staff.name}
        right={
          <div className="flex gap-2">
            <Link href="/manager" className="btn-ghost text-sm px-3 py-2" aria-label="Manager">
              <Settings size={15} />
              <span className="hidden sm:inline">Manager</span>
            </Link>
            <button
              onClick={() => {
                clearStaff();
                router.replace("/pick");
              }}
              className="btn-ghost text-sm px-3 py-2"
            >
              <Users size={15} />
              Switch
            </button>
          </div>
        }
      />
      <main className="mx-auto max-w-2xl px-4 py-6 grid gap-4">
        <Link
          href="/stock-in"
          className="card p-6 flex items-center gap-4 hover:border-accent transition active:scale-[.99]"
        >
          <span className="grid place-items-center w-14 h-14 rounded-2xl bg-base text-accent shrink-0">
            <ArrowDownToLine size={26} />
          </span>
          <span>
            <span className="block text-xl font-bold">Stock In</span>
            <span className="block text-sm text-muted mt-0.5">Goods received into the store</span>
          </span>
        </Link>

        <Link
          href="/stock-out"
          className="card p-6 flex items-center gap-4 hover:border-accent transition active:scale-[.99]"
        >
          <span className="grid place-items-center w-14 h-14 rounded-2xl bg-base text-accent shrink-0">
            <ArrowUpFromLine size={26} />
          </span>
          <span>
            <span className="block text-xl font-bold">Stock Out</span>
            <span className="block text-sm text-muted mt-0.5">Send stock to a branch</span>
          </span>
        </Link>
      </main>
    </>
  );
}

export default function MenuPage() {
  return (
    <AuthGate allow={CK_ROLES}>
      <MenuScreen />
    </AuthGate>
  );
}
