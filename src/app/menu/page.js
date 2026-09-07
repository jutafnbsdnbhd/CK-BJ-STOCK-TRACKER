"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, LogOut } from "lucide-react";
import Header from "@/components/Header";
import { loadStaff, clearStaff } from "@/lib/session";

export default function MenuPage() {
  const router = useRouter();
  const [staff, setStaff] = useState(null);

  useEffect(() => {
    const person = loadStaff();
    if (!person) router.replace("/");
    else setStaff(person);
  }, [router]);

  if (!staff) return null;

  return (
    <>
      <Header
        title={staff.name}
        right={
          <button
            onClick={() => {
              clearStaff();
              router.replace("/");
            }}
            className="btn-ghost text-sm px-3 py-2"
          >
            <LogOut size={15} />
            Switch
          </button>
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
