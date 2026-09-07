"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const PAGE = 50;

export default function HistoryTab() {
  const [rows, setRows] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [type, setType] = useState("");
  const [itemId, setItemId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    supabase
      .from("items")
      .select("id, name")
      .order("name")
      .then(({ data }) => setItems(data || []));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("stock_movements")
      .select(
        "id, movement_type, quantity, note, staff_name, movement_date, created_at, items(name, uom), branches(name)"
      )
      .order("created_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE);

    if (type) q = q.eq("movement_type", type);
    if (itemId) q = q.eq("item_id", itemId);
    if (from) q = q.gte("movement_date", from);
    if (to) q = q.lte("movement_date", to);

    const { data, error } = await q;
    if (error) setError(error.message);
    else {
      setError(null);
      setHasMore((data || []).length > PAGE);
      setRows((data || []).slice(0, PAGE));
    }
    setLoading(false);
  }, [type, itemId, from, to, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(0);
  }, [type, itemId, from, to]);

  return (
    <div>
      <div className="card p-3 mb-4 grid gap-2 sm:grid-cols-4">
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All movements</option>
          <option value="in">Stock In</option>
          <option value="out">Stock Out</option>
        </select>
        <select className="input" value={itemId} onChange={(e) => setItemId(e.target.value)}>
          <option value="">All items</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="input"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {error ? (
        <p className="card p-4 text-sm text-red-700 bg-red-50 border-red-200">{error}</p>
      ) : loading ? (
        <div className="flex items-center gap-2 text-muted py-10 justify-center">
          <Loader2 className="animate-spin" size={18} /> Loading&hellip;
        </div>
      ) : rows.length === 0 ? (
        <p className="card px-4 py-6 text-sm text-muted text-center">No movements match.</p>
      ) : (
        <div className="card divide-y divide-line">
          {rows.map((row) => {
            const out = row.movement_type === "out";
            return (
              <div key={row.id} className="px-4 py-3 flex items-start gap-3">
                <span
                  className={`grid place-items-center w-8 h-8 rounded-lg shrink-0 ${
                    out ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"
                  }`}
                >
                  {out ? <ArrowUpFromLine size={15} /> : <ArrowDownToLine size={15} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{row.items?.name || "—"}</p>
                  <p className="text-xs text-muted">
                    {row.movement_date} &middot; {row.staff_name}
                    {out && row.branches?.name ? ` → ${row.branches.name}` : ""}
                  </p>
                  {row.note ? <p className="text-xs text-muted mt-0.5 italic">{row.note}</p> : null}
                </div>
                <span className={`font-bold shrink-0 ${out ? "text-amber-700" : "text-green-700"}`}>
                  {out ? "−" : "+"}
                  {row.quantity}{" "}
                  <span className="font-normal text-muted text-sm">{row.items?.uom}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {(page > 0 || hasMore) && !loading ? (
        <div className="flex gap-2 mt-4">
          <button
            className="btn-ghost flex-1"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <button
            className="btn-ghost flex-1"
            disabled={!hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
