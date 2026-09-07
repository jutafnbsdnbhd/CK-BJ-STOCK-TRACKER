"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import Header from "@/components/Header";
import ManagerLogin from "@/components/ManagerLogin";
import OverviewTab from "@/components/manager/OverviewTab";
import HistoryTab from "@/components/manager/HistoryTab";
import CrudTab from "@/components/manager/CrudTab";

const TABS = ["Overview", "Items", "Staff", "Branches", "History"];

export default function ManagerPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(null);
  const [tab, setTab] = useState("Overview");

  useEffect(() => {
    fetch("/api/manager/session")
      .then((r) => r.json())
      .then((j) => setAuthed(!!j.authed))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) {
    return (
      <div className="flex items-center gap-2 text-muted py-20 justify-center">
        <Loader2 className="animate-spin" size={18} />
      </div>
    );
  }

  if (!authed) return <ManagerLogin onSuccess={() => setAuthed(true)} />;

  return (
    <>
      <Header
        title="Manager"
        back="/"
        right={
          <button
            className="btn-ghost text-sm px-3 py-2"
            onClick={async () => {
              await fetch("/api/manager/logout", { method: "POST" });
              router.push("/");
            }}
          >
            <LogOut size={15} />
            Exit
          </button>
        }
      />

      <div className="sticky top-[61px] z-10 bg-base/95 backdrop-blur border-b border-line">
        <div className="mx-auto max-w-4xl px-4 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition ${
                tab === t
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-5 pb-20">
        {tab === "Overview" ? <OverviewTab /> : null}
        {tab === "Items" ? (
          <CrudTab
            endpoint="items"
            label="item"
            fields={[
              { key: "category", default: "Proteins/Mains" },
              { key: "uom", placeholder: "UOM e.g. kg", default: "pcs" },
            ]}
          />
        ) : null}
        {tab === "Staff" ? <CrudTab endpoint="staff" label="staff member" /> : null}
        {tab === "Branches" ? <CrudTab endpoint="branches" label="branch" /> : null}
        {tab === "History" ? <HistoryTab /> : null}
      </main>
    </>
  );
}
