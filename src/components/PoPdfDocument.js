import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { COMPANY } from "@/lib/company";
import { groupByCategory } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/dates";

/**
 * The Purchase Order as a real PDF file (A4, selectable vector text).
 * Built on the phone itself — no server, no screenshot — then handed to
 * WhatsApp through the phone's share sheet.
 *
 * This PDF IS the official PO. Everything that matters is inside it,
 * because WhatsApp sometimes drops the caption text that goes with a file.
 */

const INK = "#1c1a17";
const MUTED = "#5f5a52";
const LINE = "#1c1a17";
const SHADE = "#efeae1";

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 48, paddingHorizontal: 36, fontSize: 9.5, fontFamily: "Helvetica", color: INK },

  company: { fontSize: 15, fontFamily: "Helvetica-Bold", textAlign: "center", letterSpacing: 0.5 },
  meta: { fontSize: 7.5, textAlign: "center", color: MUTED, marginTop: 1.5 },
  rule: { borderBottomWidth: 1.5, borderBottomColor: LINE, marginTop: 9, marginBottom: 9 },

  title: { fontSize: 15, fontFamily: "Helvetica-Bold", textAlign: "center", letterSpacing: 3 },
  to: { fontSize: 8.5, textAlign: "center", color: MUTED, marginTop: 3, marginBottom: 10 },

  info: { borderWidth: 1, borderColor: LINE, marginBottom: 12 },
  infoRow: { flexDirection: "row" },
  infoRowTop: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE },
  infoCell: { flex: 1, paddingVertical: 5, paddingHorizontal: 7 },
  infoCellBorder: { flex: 1, paddingVertical: 5, paddingHorizontal: 7, borderRightWidth: 1, borderRightColor: LINE },
  label: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: MUTED, letterSpacing: 0.6, marginBottom: 2 },
  value: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  valueBig: { fontSize: 11, fontFamily: "Helvetica-Bold" },

  table: { borderWidth: 1, borderColor: LINE },
  th: { flexDirection: "row", backgroundColor: INK },
  thText: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 8, paddingVertical: 5, paddingHorizontal: 6 },
  group: { backgroundColor: SHADE, borderTopWidth: 1, borderTopColor: LINE },
  groupText: { fontFamily: "Helvetica-Bold", fontSize: 8, paddingVertical: 4, paddingHorizontal: 6, letterSpacing: 0.5 },
  tr: { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: "#b9b2a6" },
  td: { paddingVertical: 5, paddingHorizontal: 6, fontSize: 9.5 },

  colNo: { width: 30, textAlign: "center" },
  colItem: { flex: 1 },
  colUnit: { width: 60, textAlign: "center" },
  colQty: { width: 70, textAlign: "right" },

  totalRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: LINE },

  noteBox: { marginTop: 12, borderWidth: 1, borderColor: LINE, padding: 7 },
  noteText: { fontSize: 9.5, marginTop: 1 },

  footer: { position: "absolute", bottom: 22, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: MUTED },
  disclaimer: { marginTop: 14, fontSize: 8, color: MUTED, textAlign: "center" },
});

function fmtQty(n) {
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3)));
}

export default function PoPdfDocument({ po, lines }) {
  const grouped = groupByCategory(
    lines.map((l) => ({
      ...l,
      category: l.items?.category || "Off Season",
      name: l.items?.name || "—",
      uom: l.items?.uom || "",
    }))
  );

  let n = 0;

  return (
    <Document title={po.po_number} author={COMPANY.name} subject="Purchase Order">
      <Page size="A4" style={s.page}>
        {/* Letterhead */}
        <Text style={s.company}>{COMPANY.name}</Text>
        <Text style={s.meta}>{COMPANY.regNo}</Text>
        {COMPANY.address.map((line) => (
          <Text key={line} style={s.meta}>
            {line}
          </Text>
        ))}
        <Text style={s.meta}>{COMPANY.contact}</Text>
        <View style={s.rule} />

        <Text style={s.title}>{COMPANY.poTitle}</Text>
        <Text style={s.to}>{COMPANY.poTo}</Text>

        {/* Info */}
        <View style={s.info}>
          <View style={s.infoRowTop}>
            <View style={s.infoCellBorder}>
              <Text style={s.label}>PO NO.</Text>
              <Text style={s.valueBig}>{po.po_number}</Text>
            </View>
            <View style={s.infoCellBorder}>
              <Text style={s.label}>FROM BRANCH</Text>
              <Text style={s.value}>{po.branches?.name || "—"}</Text>
            </View>
            <View style={s.infoCell}>
              <Text style={s.label}>ORDERED BY</Text>
              <Text style={s.value}>{po.ordered_by}</Text>
            </View>
          </View>
          <View style={s.infoRow}>
            <View style={s.infoCellBorder}>
              <Text style={s.label}>PO DATE</Text>
              <Text style={s.value}>{formatDate(po.po_date)}</Text>
            </View>
            <View style={s.infoCellBorder}>
              <Text style={s.label}>DELIVERY DATE</Text>
              <Text style={s.value}>{formatDate(po.delivery_date)}</Text>
            </View>
            <View style={s.infoCell}>
              <Text style={s.label}>ITEMS</Text>
              <Text style={s.value}>{lines.length}</Text>
            </View>
          </View>
        </View>

        {/* Items */}
        <View style={s.table}>
          <View style={s.th} fixed>
            <Text style={[s.thText, s.colNo]}>NO</Text>
            <Text style={[s.thText, s.colItem]}>ITEM</Text>
            <Text style={[s.thText, s.colUnit]}>UNIT</Text>
            <Text style={[s.thText, s.colQty]}>QTY</Text>
          </View>
          {grouped.map(({ category, items }) => (
            <View key={category}>
              <View style={s.group} wrap={false}>
                <Text style={s.groupText}>{category.toUpperCase()}</Text>
              </View>
              {items.map((l) => {
                n += 1;
                return (
                  <View key={l.id || l.item_id} style={s.tr} wrap={false}>
                    <Text style={[s.td, s.colNo]}>{n}</Text>
                    <Text style={[s.td, s.colItem]}>{l.name}</Text>
                    <Text style={[s.td, s.colUnit]}>{l.uom}</Text>
                    <Text style={[s.td, s.colQty, { fontFamily: "Helvetica-Bold" }]}>
                      {fmtQty(l.qty_requested)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {po.note ? (
          <View style={s.noteBox} wrap={false}>
            <Text style={s.label}>NOTE FROM BRANCH</Text>
            <Text style={s.noteText}>{po.note}</Text>
          </View>
        ) : null}

        <Text style={s.disclaimer}>{COMPANY.poFooter}</Text>

        <View style={s.footer} fixed>
          <Text>
            {po.po_number} · submitted {formatDateTime(po.created_at)}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
