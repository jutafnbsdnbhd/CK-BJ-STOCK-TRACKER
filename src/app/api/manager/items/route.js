import { crudRoute } from "@/lib/crudRoute";

export const dynamic = "force-dynamic";

// Blank boxes become "no value". Min order must be a whole number ≥ 1.
function cleanItem(payload) {
  if ("min_order" in payload) {
    const raw = String(payload.min_order ?? "").trim();
    if (raw === "") payload.min_order = null;
    else if (!/^\d+$/.test(raw) || Number(raw) < 1) {
      return "Min order must be a whole number (1 or more), or blank for no rule";
    } else payload.min_order = Number(raw);
  }
  if ("pack_qty" in payload) {
    const raw = String(payload.pack_qty ?? "").trim();
    if (raw === "") payload.pack_qty = null;
    else if (!(Number(raw) > 0)) return "Contents must be a number above 0, or blank";
    else payload.pack_qty = Number(raw);
  }
  if ("pack_unit" in payload) {
    const raw = String(payload.pack_unit ?? "").trim();
    payload.pack_unit = raw === "" ? null : raw;
  }
  return null;
}

const handlers = crudRoute(
  "items",
  ["name", "category", "uom", "min_order", "pack_qty", "pack_unit", "is_active"],
  cleanItem
);

export const GET = handlers.GET;
export const POST = handlers.POST;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
