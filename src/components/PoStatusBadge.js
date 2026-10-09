const STYLES = {
  submitted: { label: "Submitted", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  converted: { label: "Delivery Order issued", cls: "bg-green-50 text-green-800 border-green-200" },
  rejected: { label: "Rejected", cls: "bg-red-50 text-red-700 border-red-200" },
  cancelled: { label: "Cancelled", cls: "bg-gray-100 text-gray-600 border-gray-200" },
};

export default function PoStatusBadge({ status }) {
  const s = STYLES[status] || { label: status, cls: "bg-gray-100 text-gray-600 border-gray-200" };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}
