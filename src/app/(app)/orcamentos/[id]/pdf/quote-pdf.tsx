import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { formatCurrencyBRL, formatDateBR } from '@/lib/utils'
import { formatQuantity } from '@/lib/stock'
import { formatDocument, formatPhoneBR, type StoreProfile } from '@/lib/store-profile'
import type { LoadedQuote } from '../../load-quote'

// PDF do orçamento (rota /orcamentos/[id]/pdf). Fonte Helvetica embutida no
// react-pdf (acentos do português ok). O logo chega já convertido para PNG.

// Sem hifenização automática (ela quebra nomes de produtos: "Cimen-to").
Font.registerHyphenationCallback((word) => [word])

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9.5, fontFamily: 'Helvetica', color: '#111827' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 12, borderBottomWidth: 2 },
  logo: { height: 48, maxWidth: 160, objectFit: 'contain' },
  storeName: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  storeInfo: { marginTop: 2, color: '#4b5563', textAlign: 'right' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 16 },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold' },
  muted: { color: '#6b7280' },
  box: { marginTop: 12, padding: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4 },
  label: { fontSize: 8, color: '#6b7280', marginBottom: 2, textTransform: 'uppercase' },
  table: { marginTop: 14 },
  thead: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 4, color: '#ffffff', fontFamily: 'Helvetica-Bold', fontSize: 8.5 },
  row: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 0.5, borderColor: '#e5e7eb' },
  cCode: { width: '13%' },
  cName: { width: '41%' },
  cQty: { width: '14%', textAlign: 'right' },
  cPrice: { width: '15%', textAlign: 'right' },
  cTotal: { width: '17%', textAlign: 'right' },
  totals: { marginTop: 8, marginLeft: 'auto', width: '45%' },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  grand: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingTop: 6, borderTopWidth: 1, fontSize: 13, fontFamily: 'Helvetica-Bold' },
  footer: { position: 'absolute', bottom: 24, left: 36, right: 36, fontSize: 8, color: '#6b7280', textAlign: 'center' },
})

export function QuotePdf({
  quote,
  orgName,
  store,
  logo,
  color,
}: {
  quote: LoadedQuote
  orgName: string
  store: StoreProfile
  logo: string | null
  color: string
}) {
  const customerName = quote.customers?.name ?? quote.customer_name ?? null
  const storeLines = [
    store.document ? `CNPJ/CPF ${formatDocument(store.document)}` : null,
    [formatPhoneBR(store.phone), store.email].filter(Boolean).join(' · ') || null,
    store.address,
  ].filter(Boolean) as string[]

  return (
    <Document title={`Orçamento ${quote.number} - ${orgName}`} author={orgName}>
      <Page size="A4" style={styles.page}>
        <View style={[styles.header, { borderColor: color }]}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem alt */}
          {logo ? <Image src={logo} style={styles.logo} /> : <Text style={styles.storeName}>{orgName}</Text>}
          <View>
            {logo ? <Text style={[styles.storeName, { textAlign: 'right' }]}>{orgName}</Text> : null}
            {storeLines.map((l) => (
              <Text key={l} style={styles.storeInfo}>
                {l}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.titleRow}>
          <Text style={[styles.title, { color }]}>Orçamento nº {quote.number}</Text>
          <View>
            <Text style={{ textAlign: 'right' }}>Emitido em {formatDateBR(quote.created_at)}</Text>
            <Text style={{ textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>
              Válido até {formatDateBR(quote.valid_until)}
            </Text>
          </View>
        </View>

        <View style={styles.box}>
          <Text style={styles.label}>Cliente</Text>
          <Text style={{ fontFamily: 'Helvetica-Bold' }}>{customerName ?? 'Não informado'}</Text>
          {quote.customers?.document ? <Text style={styles.muted}>CPF/CNPJ {formatDocument(quote.customers.document)}</Text> : null}
          {quote.customers?.phone || quote.customers?.email ? (
            <Text style={styles.muted}>
              {[formatPhoneBR(quote.customers?.phone), quote.customers?.email].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {quote.customers?.address ? <Text style={styles.muted}>{quote.customers.address}</Text> : null}
        </View>

        <View style={styles.table}>
          <View style={[styles.thead, { backgroundColor: color }]} fixed>
            <Text style={styles.cCode}>Código</Text>
            <Text style={styles.cName}>Produto</Text>
            <Text style={styles.cQty}>Qtd.</Text>
            <Text style={styles.cPrice}>Preço un.</Text>
            <Text style={styles.cTotal}>Total</Text>
          </View>
          {quote.items.map((i) => (
            <View key={i.id} style={styles.row} wrap={false}>
              <Text style={styles.cCode}>{i.product_code}</Text>
              <Text style={styles.cName}>{i.product_name}</Text>
              <Text style={styles.cQty}>
                {formatQuantity(i.quantity)} {i.unit}
              </Text>
              <Text style={styles.cPrice}>{formatCurrencyBRL(i.unit_price)}</Text>
              <Text style={styles.cTotal}>{formatCurrencyBRL(i.total)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals} wrap={false}>
          {Number(quote.discount) > 0 ? (
            <>
              <View style={styles.totalLine}>
                <Text style={styles.muted}>Subtotal</Text>
                <Text>{formatCurrencyBRL(quote.subtotal)}</Text>
              </View>
              <View style={styles.totalLine}>
                <Text style={styles.muted}>Desconto</Text>
                <Text>- {formatCurrencyBRL(quote.discount)}</Text>
              </View>
            </>
          ) : null}
          <View style={[styles.grand, { borderColor: color }]}>
            <Text>Total</Text>
            <Text>{formatCurrencyBRL(quote.total)}</Text>
          </View>
        </View>

        {quote.notes ? (
          <View style={styles.box} wrap={false}>
            <Text style={styles.label}>Observações</Text>
            <Text>{quote.notes}</Text>
          </View>
        ) : null}

        <Text style={[styles.muted, { marginTop: 14 }]}>
          {quote.authorName ? `Atendido por ${quote.authorName}. ` : ''}Preços válidos até{' '}
          {formatDateBR(quote.valid_until)}, sujeitos à disponibilidade de estoque.
        </Text>

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `Orçamento sem valor fiscal · ${orgName} · página ${pageNumber} de ${totalPages}`
          }
        />
      </Page>
    </Document>
  )
}
