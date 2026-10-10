"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { groupByCategory } from "@/lib/constants";
import { bundleHint, packEquivalent, packLabel } from "@/lib/bundles";

export default function OverviewTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data, error }, { data: itemRows, error: itemError }] = await Promise.all([
        supabase
          .from("item_balances")
          .select("item_id, item_name, category, uom, balance, total_in, total_out, is_active")
          .eq("is_active", true),
        supabase.from("items").select("id, min_order, pack_qty, pack_unit"),
      ]);
      if (error || itemError) setError((error || itemError).message);
      else {
        const extra = Object.fromEntries((itemRows || []).map((i) => [i.id, i]));
        setRows((data || []).map((r) => ({ ...r, ...(extra[r.item_id] || {}) })));
      }
      setLoading(false);
    })();
  }, []);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? rows.filter((r) => r.item_name.toLowerCase().includes(q)) : rows;
    return groupByCategory(
      filtered.map((r) => ({ ...r, name: r.item_name })).sort((a, b) => a.name.localeCompare(b.name))
    );
  }, [rows, search]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted py-10 justify-center">
        <Loader2 className="animate-spin" size={18} /> Loading balances&hellip;
      </div>
    );
  }
  if (error) {
    return <p className="card p-4 text-sm text-red-700 bg-red-50 border-red-200">{error}</p>;
  }

  return (
    <div>
      <div className="relative mb-4">
        <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          className="input pl-9"
          placeholder="Search item"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {grouped.map(({ category, items }) => (
        <section key={category} className="mb-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-accent mb-2 px-1">
            {category}
          </h3>
          <div className="card divide-y divide-line">
            {items.map((row) => (
              <div key={row.item_id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{row.item_name}</p>
                  <p className="text-xs text-muted">
                    in {row.total_in} &middot; out {row.total_out}
                    {bundleHint(row) ? ` · ${bundleHint(row)}` : ""}
                    {packLabel(row) ? ` · ${packLabel(row)}` : ""}
                  </p>
                </div>
                <span className="text-right shrink-0">
                  <span className={`block font-bold ${Number(row.balance) < 0 ? "text-red-600" : "text-ink"}`}>
                    {row.balance} <span className="font-normal text-muted text-sm">{row.uom}</span>
                  </span>
                  {packEquivalent(row, row.balance) ? (
                    <span className="block text-xs text-muted">{packEquivalent(row, row.balance)}</span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
