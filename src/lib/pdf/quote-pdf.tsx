import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  companyName: { fontSize: 18, fontFamily: 'Helvetica-Bold' },
  muted: { color: '#666' },
  bold: { fontFamily: 'Helvetica-Bold' },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e5e5e5', marginVertical: 8 },
  sectionTitle: { fontFamily: 'Helvetica-Bold', fontSize: 11, marginTop: 16, marginBottom: 4, backgroundColor: '#f5f5f5', padding: 6 },
  tableHeader: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#ccc' },
  row: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  col1: { flex: 4 },
  col2: { flex: 1, textAlign: 'center' },
  col3: { flex: 1, textAlign: 'right' },
})

type LineItem = {
  description: string
  quantity: number
  unit: string
  unit_cost: number
  markup_percent: number
  total: number
  cost_code: string | null
  category: string
}

type Section = {
  name: string
  items: LineItem[]
}

type QuoteData = {
  version: number
  subtotal: number
  markup_percent: number
  tax_rate: number
  total: number
  notes: string | null
}

export function QuotePDF({
  quote,
  sections,
  projectName,
  projectAddress,
  companyName,
}: {
  quote: QuoteData
  sections: Section[]
  projectName: string
  projectAddress: string | null
  companyName: string
}) {
  const afterMarkup = Number(quote.subtotal) * (1 + Number(quote.markup_percent) / 100)
  const taxAmt = afterMarkup * Number(quote.tax_rate)

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{companyName}</Text>
            <Text style={[styles.muted, { marginTop: 6 }]}>Proposal / Quote</Text>
            <Text style={[styles.muted]}>v{quote.version}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.bold}>{projectName}</Text>
            {projectAddress && <Text style={styles.muted}>{projectAddress}</Text>}
          </View>
        </View>

        <View style={styles.divider} />

        {sections.map((section, si) => (
          <View key={si}>
            <Text style={styles.sectionTitle}>{section.name}</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.col1, styles.bold]}>Description</Text>
              <Text style={[styles.col2, styles.bold]}>Qty / Unit</Text>
              <Text style={[styles.col3, styles.bold]}>Total</Text>
            </View>
            {section.items.map((item, ii) => (
              <View key={ii} style={styles.row}>
                <View style={styles.col1}>
                  <Text>{item.description}</Text>
                  {item.cost_code && <Text style={[styles.muted, { fontSize: 8 }]}>{item.cost_code} · {item.category}</Text>}
                </View>
                <Text style={styles.col2}>{item.quantity} {item.unit}</Text>
                <Text style={styles.col3}>${Number(item.total).toFixed(2)}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* Totals */}
        <View style={{ marginTop: 20, alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', marginBottom: 3 }}>
            <Text style={[styles.muted, { width: 100, textAlign: 'right', marginRight: 20 }]}>Subtotal</Text>
            <Text style={{ width: 90, textAlign: 'right' }}>${Number(quote.subtotal).toFixed(2)}</Text>
          </View>
          {Number(quote.markup_percent) > 0 && (
            <View style={{ flexDirection: 'row', marginBottom: 3 }}>
              <Text style={[styles.muted, { width: 100, textAlign: 'right', marginRight: 20 }]}>Markup ({quote.markup_percent}%)</Text>
              <Text style={{ width: 90, textAlign: 'right' }}>${(afterMarkup - Number(quote.subtotal)).toFixed(2)}</Text>
            </View>
          )}
          {Number(quote.tax_rate) > 0 && (
            <View style={{ flexDirection: 'row', marginBottom: 3 }}>
              <Text style={[styles.muted, { width: 100, textAlign: 'right', marginRight: 20 }]}>Tax ({(Number(quote.tax_rate) * 100).toFixed(1)}%)</Text>
              <Text style={{ width: 90, textAlign: 'right' }}>${taxAmt.toFixed(2)}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#ccc', paddingTop: 5, marginTop: 3 }}>
            <Text style={[styles.bold, { fontSize: 12, width: 100, textAlign: 'right', marginRight: 20 }]}>Total</Text>
            <Text style={[styles.bold, { fontSize: 12, width: 90, textAlign: 'right' }]}>${Number(quote.total).toFixed(2)}</Text>
          </View>
        </View>

        {/* Notes */}
        {quote.notes && (
          <View style={{ marginTop: 24, borderTopWidth: 1, borderTopColor: '#e5e5e5', paddingTop: 12 }}>
            <Text style={[styles.bold, { marginBottom: 6 }]}>Notes & Terms</Text>
            <Text style={{ lineHeight: 1.5, color: '#444' }}>{quote.notes}</Text>
          </View>
        )}

        {/* Signature */}
        <View style={{ marginTop: 40, flexDirection: 'row', gap: 40 }}>
          <View style={{ flex: 1 }}>
            <View style={{ borderBottomWidth: 1, borderBottomColor: '#999', marginBottom: 4, height: 24 }} />
            <Text style={styles.muted}>Client Signature</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ borderBottomWidth: 1, borderBottomColor: '#999', marginBottom: 4, height: 24 }} />
            <Text style={styles.muted}>Date</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
