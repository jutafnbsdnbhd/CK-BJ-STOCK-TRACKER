"use client";

import { useRouter } from "next/navigation";
import { ClipboardList, LogOut, Store } from "lucide-react";
import Header from "@/components/Header";
import AuthGate, { useProfile } from "@/components/AuthGate";
import { signOut } from "@/lib/authClient";
import { BRANCH, SUPER_ADMIN } from "@/lib/roles";

/**
 * Branch home. Phase 1: confirms the login works and shows which branch the
 * account belongs to. Purchase Orders arrive in Phase 2.
 */
function BranchHome() {
  const router = useRouter();
  const profile = useProfile();
  const branchName = profile.branches?.name || "No branch (Super Admin preview)";

  return (
    <>
      <Header
        title={profile.display_name}
        right={
          <button
            className="btn-ghost text-sm px-3 py-2"
            onClick={async () => {
              await signOut();
              router.replace("/");
            }}
          >
            <LogOut size={15} />
            Log out
          </button>
        }
      />
      <main className="mx-auto max-w-2xl px-4 py-6 grid gap-4">
        <div className="card p-5 flex items-center gap-4">
          <span className="grid place-items-center w-12 h-12 rounded-2xl bg-base text-accent shrink-0">
            <Store size={22} />
          </span>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted font-semibold">Branch</p>
            <p className="text-lg font-bold">{branchName}</p>
          </div>
        </div>

        <div className="card p-5 flex items-center gap-4 opacity-60">
          <span className="grid place-items-center w-12 h-12 rounded-2xl bg-base text-accent shrink-0">
            <ClipboardList size={22} />
          </span>
          <div>
            <p className="font-bold">Purchase Orders</p>
            <p className="text-sm text-muted">Coming soon</p>
          </div>
        </div>
      </main>
    </>
  );
}

export default function BranchPage() {
  return (
    <AuthGate allow={[BRANCH, SUPER_ADMIN]}>
      <BranchHome />
    </AuthGate>
  );
}
