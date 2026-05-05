import { useMemo, useState } from 'react'
import { Breadcrumb } from '../../components/Breadcrumb.jsx'
import { Button } from '../../components/Button.jsx'
import { LineItemsGrid } from '../../components/LineItemsGrid.jsx'

const UNIT_OPTIONS = [
  { value: 'kg', label: 'kg' },
  { value: 'g', label: 'g' },
  { value: 'L', label: 'L' },
  { value: 'ml', label: 'ml' },
  { value: 'pcs', label: 'pcs' },
]

function newRow() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    item: '',
    qty: '',
    unit: 'kg',
    unitPrice: '',
  }
}

/** @param {ReturnType<typeof newRow>} row */
function formatLineTotal(row) {
  const q = parseFloat(String(row.qty).replace(',', '.')) || 0
  const p = parseFloat(String(row.unitPrice).replace(',', '.')) || 0
  const t = q * p
  return t ? t.toFixed(2) : ''
}

export function PurchasesCreatePage() {
  const [transferTo, setTransferTo] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [notes, setNotes] = useState('')
  const [vendor, setVendor] = useState('')
  const [rows, setRows] = useState(() => [newRow()])

  const purchaseColumns = useMemo(
    () => [
      {
        key: 'item',
        header: 'Item',
        kind: 'text',
        placeholder: 'Description',
        thClassName: 'min-w-[180px]',
        align: 'left',
      },
      { key: 'qty', header: 'Qty', kind: 'decimal', thClassName: 'w-24' },
      { key: 'unit', header: 'Unit', kind: 'select', options: UNIT_OPTIONS, thClassName: 'w-28' },
      { key: 'unitPrice', header: 'Unit price', kind: 'decimal', thClassName: 'w-28' },
      {
        key: '__lineTotal',
        header: 'Line total',
        kind: 'computed',
        thClassName: 'w-32',
        compute: (row) => formatLineTotal(row),
      },
    ],
    [],
  )

  const grandTotal = useMemo(() => {
    return rows.reduce((sum, r) => {
      const q = parseFloat(String(r.qty).replace(',', '.')) || 0
      const p = parseFloat(String(r.unitPrice).replace(',', '.')) || 0
      return sum + q * p
    }, 0)
  }, [rows])

  return (
    <section className="space-y-4">
      <Breadcrumb items={[{ label: 'Purchases' }, { label: 'Create' }]} />

      <div>
        <h2 className="text-base font-semibold text-slate-900">Create purchase</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Transfer To</span>
          <select
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value="">Select destination…</option>
            <option value="main-kitchen">Main kitchen</option>
            <option value="prep-kitchen">Prep kitchen</option>
            <option value="cold-storage">Cold storage</option>
            <option value="dry-storage">Dry storage</option>
            <option value="bar">Bar</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Date of purchase</span>
          <input
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">
            Vendor <span className="font-normal text-slate-500">(optional)</span>
          </span>
          <input
            type="text"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="Vendor name"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </label>
        <label className="space-y-1 sm:col-span-3">
          <span className="text-sm font-medium text-slate-700">
            Notes <span className="font-normal text-slate-500">(optional)</span>
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Notes"
            className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </label>
      </div>

      <LineItemsGrid
        rows={rows}
        onRowsChange={setRows}
        createRow={newRow}
        columns={purchaseColumns}
        footer={{
          label: 'Total',
          value: grandTotal.toFixed(2),
          leadingColumnsSpan: 5,
        }}
      />

      <div className="flex justify-end pt-2">
        <Button
          variant="primary"
          type="button"
          onClick={() => {
            // TODO: POST purchase payload
            console.warn('[Purchase save]', {
              transferTo,
              purchaseDate,
              vendor,
              notes,
              rows,
              grandTotal,
            })
            alert('Purchase saved (mock).')
          }}
        >
          Save
        </Button>
      </div>
    </section>
  )
}
