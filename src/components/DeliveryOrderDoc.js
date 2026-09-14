import { Fragment } from "react";
import { COMPANY } from "@/lib/company";
import { groupByCategory } from "@/lib/constants";

/**
 * The printable Delivery Order — laid out to match the JUTA FNB DO template.
 *
 * Real HTML and CSS, not an image, so it prints as crisp vector text and the
 * browser's "Save as PDF" produces a proper selectable-text PDF.
 *
 * Only the items actually being sent appear. The paper template lists every
 * item as a blank checklist; a generated DO is a record of one delivery.
 */
export default function DeliveryOrderDoc({ order, lines }) {
  const grouped = groupByCategory(
    lines.map((l) => ({
      ...l,
      category: l.items?.category || "Off Season",
      name: l.items?.name || "—",
    }))
  );

  return (
    <article className="do-sheet">
      {/* Letterhead ------------------------------------------------- */}
      <header className="text-center">
        <h1 className="do-company">{COMPANY.name}</h1>
        <p className="do-meta">{COMPANY.regNo}</p>
        {COMPANY.address.map((line) => (
          <p key={line} className="do-meta">
            {line}
          </p>
        ))}
        <p className="do-meta do-contact">{COMPANY.contact}</p>
      </header>

      <hr className="do-rule" />

      <h2 className="do-title">{COMPANY.docTitle}</h2>
      {COMPANY.attention ? <p className="do-att">{COMPANY.attention}</p> : null}

      {/* Info bar --------------------------------------------------- */}
      <table className="do-infobar">
        <tbody>
          <tr>
            <td>
              <span className="do-label">DO NO.</span>
              <span className="do-value">{order.do_number}</span>
            </td>
            <td>
              <span className="do-label">Staff Name</span>
              <span className="do-value">{order.staff_name}</span>
            </td>
            <td>
              <span className="do-label">Date</span>
              <span className="do-value">{order.do_date}</span>
            </td>
            <td className="do-right">
              <span className="do-label">Delivery To</span>
              <span className="do-value">{order.branches?.name || "—"}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Lines ------------------------------------------------------ */}
      <table className="do-table">
        <thead>
          <tr>
            <th className="do-col-item">ITEM NAME</th>
            <th className="do-col-qty">QTY</th>
            <th className="do-col-unit">UNIT</th>
            <th className="do-col-check">PACKED &#10003;</th>
            <th className="do-col-check">RECEIVED &#10003;</th>
            <th className="do-col-notes">NOTES</th>
          </tr>
        </thead>
        <tbody>
          {grouped.map(({ category, items }) => (
            <Fragment key={category}>
              <tr className="do-group">
                <td colSpan={6}>{category}</td>
              </tr>
              {items.map((line) => (
                <tr key={line.id}>
                  <td>{line.items?.name || "—"}</td>
                  <td className="do-center">{Number(line.quantity)}</td>
                  <td className="do-center">{line.items?.uom || ""}</td>
                  <td />
                  <td />
                  <td />
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>

      {order.note ? (
        <p className="do-remarks">
          <strong>Remarks:</strong> {order.note}
        </p>
      ) : null}

      {/* Signatures -------------------------------------------------- */}
      <section className="do-signs">
        {["Prepared by", "Delivered by", "Received by (Branch)"].map((label) => (
          <div key={label} className="do-sign">
            <div className="do-sign-line" />
            <p className="do-sign-label">{label}</p>
            <p className="do-sign-sub">Name / Signature / Date</p>
          </div>
        ))}
      </section>
    </article>
  );
}
