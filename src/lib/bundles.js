// Bundle (minimum order) rules — shared by the branch PO screen, the CK
// convert screen and Manager. The database enforces the same rule on every
// PO (migration 010); this file only makes the screens explain it nicely.
//
//   min_order null → no rule
//   min_order 1    → whole units only (1, 2, 3 — no 2.5)
//   min_order 25   → 25, 50, 75 …

export function fmtQty(n) {
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3)));
}

/** How much the − / + buttons move. */
export function stepFor(item) {
  return item?.min_order ? Number(item.min_order) : 1;
}

/** Is `value` a whole number of bundles? */
export function isWholeBundles(item, value) {
  const min = item?.min_order ? Number(item.min_order) : null;
  if (!min) return true;
  const n = Number(value);
  if (!Number.isFinite(n)) return false;
  const bundles = n / min;
  return Math.abs(bundles - Math.round(bundles)) < 1e-9;
}

/** null when fine, otherwise a short message for under the input box. */
export function bundleError(item, value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (isWholeBundles(item, n)) return null;
  const min = Number(item.min_order);
  if (min === 1) return "Whole numbers only";
  return `Order in ${min}, ${min * 2}, ${min * 3}…`;
}

/** "Bundle of 25 Pkt", "Whole Pkt only", or "" when no rule. */
export function bundleHint(item) {
  if (!item?.min_order) return "";
  const min = Number(item.min_order);
  return min === 1 ? `Whole ${item.uom} only` : `Bundle of ${min} ${item.uom}`;
}

/** "12 Pkt / Ctn", or "" when not set. */
export function packLabel(item) {
  if (!item?.pack_qty || !item?.pack_unit) return "";
  return `${fmtQty(item.pack_qty)} ${item.pack_unit} / ${item.uom}`;
}

/** For balances: 3 Ctn of 12 Pkt → "= 36 Pkt", or "" when not set. */
export function packEquivalent(item, qty) {
  if (!item?.pack_qty || !item?.pack_unit) return "";
  const n = Number(qty);
  if (!Number.isFinite(n)) return "";
  return `= ${fmtQty(n * Number(item.pack_qty))} ${item.pack_unit}`;
}
