"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { groupByCategory } from "@/lib/constants";

export default function OverviewTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("item_balances")
        .select("item_id, item_name, category, uom, balance, total_in, total_out, is_active")
        .eq("is_active", true);
      if (error) setError(error.message);
      else setRows(data || []);
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
                  </p>
                </div>
                <span
                  className={`font-bold shrink-0 ${
                    Number(row.balance) < 0 ? "text-red-600" : "text-ink"
                  }`}
                >
                  {row.balance} <span className="font-normal text-muted text-sm">{row.uom}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
