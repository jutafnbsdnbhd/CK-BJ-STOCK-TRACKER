"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const PAGE = 50;

export default function DeliveryOrdersTab() {
  const [rows, setRows] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [branchId, setBranchId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    supabase
      .from("branches")
      .select("id, name")
      .order("name")
      .then(({ data }) => setBranches(data || []));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("delivery_orders")
      .select("id, do_number, do_date, staff_name, note, created_at, branches(name)")
      .order("created_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE);

    if (branchId) q = q.eq("branch_id", branchId);
    if (from) q = q.gte("do_date", from);
    if (to) q = q.lte("do_date", to);

    const { data, error } = await q;
    if (error) setError(error.message);
    else {
      setError(null);
      setHasMore((data || []).length > PAGE);
      setRows((data || []).slice(0, PAGE));
    }
    setLoading(false);
  }, [branchId, from, to, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(0);
  }, [branchId, from, to]);

  return (
    <div>
      <div className="card p-3 mb-4 grid gap-2 sm:grid-cols-3">
        <select className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {error ? (
        <p className="card p-4 text-sm text-red-700 bg-red-50 border-red-200">{error}</p>
      ) : loading ? (
        <div className="flex items-center gap-2 text-muted py-10 justify-center">
          <Loader2 className="animate-spin" size={18} /> Loading&hellip;
        </div>
      ) : rows.length === 0 ? (
        <p className="card px-4 py-6 text-sm text-muted text-center">
          No delivery orders yet. One is issued automatically on every Stock Out.
        </p>
      ) : (
        <div className="card divide-y divide-line">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/do/${row.do_number}`}
              className="px-4 py-3 flex items-center gap-3 hover:bg-base transition"
            >
              <span className="grid place-items-center w-8 h-8 rounded-lg bg-base text-accent shrink-0">
                <FileText size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{row.do_number}</p>
                <p className="text-xs text-muted truncate">
                  {row.do_date} &middot; {row.branches?.name} &middot; {row.staff_name}
                  {row.note ? ` · ${row.note}` : ""}
                </p>
              </div>
              <span className="text-xs text-accent font-semibold shrink-0">Open</span>
            </Link>
          ))}
        </div>
      )}

      {(page > 0 || hasMore) && !loading ? (
        <div className="flex gap-2 mt-4">
          <button className="btn-ghost flex-1" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <button className="btn-ghost flex-1" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
