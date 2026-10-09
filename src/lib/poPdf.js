"use client";

/**
 * Build the PO PDF on the phone and return it as a File ready to share.
 *
 * The PDF library is large, so it is only downloaded when a PO page opens —
 * the rest of the app stays fast.
 */
export async function buildPoPdfFile(po, lines) {
  const [{ pdf }, { default: PoPdfDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/PoPdfDocument"),
  ]);
  const blob = await pdf(<PoPdfDocument po={po} lines={lines} />).toBlob();
  return new File([blob], `${po.po_number}.pdf`, { type: "application/pdf" });
}

/** Can this phone/browser hand a file straight to WhatsApp? */
export function canShareFiles() {
  try {
    if (typeof navigator === "undefined" || !navigator.canShare) return false;
    const probe = new File(["x"], "probe.pdf", { type: "application/pdf" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** Fallback: save the file to the phone/computer. */
export function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
