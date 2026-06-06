import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  companyName: { fontSize: 18, fontFamily: 'Helvetica-Bold' },
  coNumber: { fontSize: 11, color: '#555', marginTop: 4 },
  title: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  sectionLabel: { fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4, marginTop: 20 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e5e5e5', marginBottom: 8 },
  row: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  tableHeader: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#ccc', backgroundColor: '#f9f9f9' },
  col1: { flex: 3 },
  col2: { flex: 1, textAlign: 'center' },
  col3: { flex: 1, textAlign: 'right' },
  bold: { fontFamily: 'Helvetica-Bold' },
  muted: { color: '#666' },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  totalLabel: { fontFamily: 'Helvetica-Bold', fontSize: 11, marginRight: 16 },
  totalValue: { fontFamily: 'Helvetica-Bold', fontSize: 11 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, fontSize: 9 },
  statusBox: { marginTop: 32, padding: 16, borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 4 },
  statusRow: { flexDirection: 'row', marginBottom: 6 },
  statusKey: { width: 120, color: '#888' },
})

type LineItem = {
  description: string
  quantity: number
  unit: string
  unit_cost: number
  total: number
  category: string
}

type COData = {
  co_number: number
  title: string
  description: string | null
  reason: string
  status: string
  subtotal: number
  markup_percent: number
  total: number
  submitted_at: string | null
  client_responded_at: string | null
}

type ProjectData = {
  name: string
  address: string | null
}

const reasonLabel: Record<string, string> = {
  scope_change: 'Scope Change',
  unforeseen: 'Unforeseen Condition',
  owner_request: 'Owner Request',
  other: 'Other',
}

export function ChangeOrderPDF({
  co,
  lineItems,
  project,
  companyName,
}: {
  co: COData
  lineItems: LineItem[]
  project: ProjectData
  companyName: string
}) {
  const markupAmount = Number(co.total) - Number(co.subtotal)

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{companyName}</Text>
            <Text style={[styles.coNumber, { marginTop: 8 }]}>Change Order</Text>
            <Text style={styles.coNumber}>CO-{String(co.co_number).padStart(3, '0')}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.bold, { fontSize: 11 }]}>{project.name}</Text>
            {project.address && <Text style={styles.muted}>{project.address}</Text>}
            <Text style={[styles.muted, { marginTop: 6 }]}>
              {co.submitted_at ? new Date(co.submitted_at).toLocaleDateString() : ''}
            </Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.divider} />
        <Text style={styles.title}>{co.title}</Text>
        <Text style={[styles.muted, { marginTop: 2 }]}>{reasonLabel[co.reason] ?? co.reason}</Text>

        {/* Description */}
        {co.description && (
          <>
            <Text style={styles.sectionLabel}>Description</Text>
            <Text style={{ lineHeight: 1.5 }}>{co.description}</Text>
          </>
        )}

        {/* Line Items */}
        <Text style={styles.sectionLabel}>Scope of Work</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.col1, styles.bold]}>Description</Text>
          <Text style={[styles.col2, styles.bold]}>Qty / Unit</Text>
          <Text style={[styles.col3, styles.bold]}>Total</Text>
        </View>
        {lineItems.map((item, i) => (
          <View key={i} style={styles.row}>
            <View style={styles.col1}>
              <Text>{item.description}</Text>
              <Text style={[styles.muted, { fontSize: 8 }]}>{item.category}</Text>
            </View>
            <Text style={styles.col2}>{item.quantity} {item.unit}</Text>
            <Text style={styles.col3}>${Number(item.total).toFixed(2)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={{ marginTop: 12, alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', marginBottom: 4 }}>
            <Text style={[styles.muted, { marginRight: 24, width: 80, textAlign: 'right' }]}>Subtotal</Text>
            <Text style={{ width: 80, textAlign: 'right' }}>${Number(co.subtotal).toFixed(2)}</Text>
          </View>
          {co.markup_percent > 0 && (
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              <Text style={[styles.muted, { marginRight: 24, width: 80, textAlign: 'right' }]}>
                Markup ({co.markup_percent}%)
              </Text>
              <Text style={{ width: 80, textAlign: 'right' }}>${markupAmount.toFixed(2)}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#ccc', paddingTop: 6, marginTop: 2 }}>
            <Text style={[styles.bold, { marginRight: 24, width: 80, textAlign: 'right', fontSize: 11 }]}>Total</Text>
            <Text style={[styles.bold, { width: 80, textAlign: 'right', fontSize: 11 }]}>${Number(co.total).toFixed(2)}</Text>
          </View>
        </View>

        {/* Approval status */}
        <View style={styles.statusBox}>
          <Text style={[styles.bold, { marginBottom: 8 }]}>Approval Status</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusKey}>Status</Text>
            <Text style={styles.bold}>{co.status.replace(/_/g, ' ').toUpperCase()}</Text>
          </View>
          {co.client_responded_at && (
            <View style={styles.statusRow}>
              <Text style={styles.statusKey}>Client responded</Text>
              <Text>{new Date(co.client_responded_at).toLocaleString()}</Text>
            </View>
          )}
          <View style={[styles.statusRow, { marginTop: 24 }]}>
            <Text style={styles.statusKey}>Client signature</Text>
            <Text style={{ borderBottomWidth: 1, borderBottomColor: '#999', width: 200 }}> </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusKey}>Date</Text>
            <Text style={{ borderBottomWidth: 1, borderBottomColor: '#999', width: 120 }}> </Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
