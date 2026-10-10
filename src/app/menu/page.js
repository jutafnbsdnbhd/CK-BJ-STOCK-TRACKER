"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, ClipboardList, LogOut, Settings } from "lucide-react";
import Header from "@/components/Header";
import AuthGate, { useProfile } from "@/components/AuthGate";
import { signOut } from "@/lib/authClient";
import { usePendingPoCount } from "@/lib/usePendingPoCount";
import PushToggle from "@/components/PushToggle";
import { CK_MANAGER_ROLES, CK_ROLES, ROLE_LABELS } from "@/lib/roles";

function MenuScreen() {
  const router = useRouter();
  const profile = useProfile();
  const isManager = CK_MANAGER_ROLES.includes(profile.role);
  const pending = usePendingPoCount();

  return (
    <>
      <Header
        title={`${profile.display_name} · ${ROLE_LABELS[profile.role]}`}
        right={
          <div className="flex gap-2">
            {isManager ? (
              <Link href="/manager" className="btn-ghost text-sm px-3 py-2" aria-label="Manager">
                <Settings size={15} />
                <span className="hidden sm:inline">Manager</span>
              </Link>
            ) : null}
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
      <main className="mx-auto max-w-2xl px-4 py-6 grid gap-4">
        <Link
          href="/pending-pos"
          className={`card p-6 flex items-center gap-4 transition active:scale-[.99] ${
            pending > 0 ? "border-accent ring-2 ring-accent/30" : "hover:border-accent"
          }`}
        >
          <span className="relative grid place-items-center w-14 h-14 rounded-2xl bg-accent text-white shrink-0">
            <ClipboardList size={26} />
            {pending > 0 ? (
              <span className="absolute -top-2 -right-2 min-w-[26px] h-[26px] px-1.5 rounded-full bg-red-600 text-white text-sm font-bold grid place-items-center border-2 border-white">
                {pending}
              </span>
            ) : null}
          </span>
          <span>
            <span className="block text-xl font-bold">Pending POs</span>
            <span className="block text-sm text-muted mt-0.5">
              {pending === null
                ? "Checking…"
                : pending === 0
                ? "Nothing waiting"
                : `${pending} waiting to be processed`}
            </span>
          </span>
        </Link>

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

        <PushToggle />

        <p className="text-xs text-muted text-center mt-2">
          Everything you log is recorded under <span className="font-semibold text-ink">{profile.display_name}</span>.
          Shared device? Log out when your shift ends.
        </p>
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
