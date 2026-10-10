"use client";

import { useState } from "react";
import Header from "@/components/Header";
import AuthGate from "@/components/AuthGate";
import OverviewTab from "@/components/manager/OverviewTab";
import HistoryTab from "@/components/manager/HistoryTab";
import CrudTab from "@/components/manager/CrudTab";
import DeliveryOrdersTab from "@/components/manager/DeliveryOrdersTab";
import UsersTab from "@/components/manager/UsersTab";
import { CK_MANAGER_ROLES } from "@/lib/roles";

const TABS = ["Overview", "Delivery Orders", "Items", "Branches", "History", "Users"];

function ManagerScreen() {
  const [tab, setTab] = useState("Overview");

  return (
    <>
      <Header title="Manager" back="/menu" />

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
        {tab === "Delivery Orders" ? <DeliveryOrdersTab /> : null}
        {tab === "Items" ? (
          <CrudTab
            endpoint="items"
            label="item"
            fields={[
              { key: "category", label: "Category", default: "Protein / Ready Item" },
              { key: "uom", label: "Unit", placeholder: "Unit e.g. Pkt", default: "Pkt" },
              { key: "min_order", label: "Min order (bundle)", placeholder: "blank = no rule", numeric: true },
              { key: "pack_qty", label: "Contents qty", placeholder: "e.g. 12", numeric: true },
              { key: "pack_unit", label: "Contents unit", placeholder: "e.g. Pkt" },
            ]}
            footnote="Min order: branches must order in multiples of it (25 → 25, 50, 75…). 1 = whole units only. Blank = no rule. Changes apply to new POs only. Contents is for reference — e.g. 12 + Pkt on a Ctn item shows “12 Pkt / Ctn”."
          />
        ) : null}
        {tab === "Branches" ? (
          <CrudTab
            endpoint="branches"
            label="branch"
            fields={[{ key: "code", placeholder: "Code e.g. TRX", default: "" }]}
          />
        ) : null}
        {tab === "History" ? <HistoryTab /> : null}
        {tab === "Users" ? <UsersTab /> : null}
      </main>
    </>
  );
}

export default function ManagerPage() {
  return (
    <AuthGate allow={CK_MANAGER_ROLES}>
      <ManagerScreen />
    </AuthGate>
  );
}
