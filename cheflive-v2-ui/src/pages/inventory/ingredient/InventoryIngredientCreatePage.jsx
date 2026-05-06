import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Breadcrumb } from '../../../components/Breadcrumb.jsx'
import { BulkUploadButton } from '../../../components/BulkUploadButton.jsx'
import { Button } from '../../../components/Button.jsx'
import { useNavigate } from 'react-router-dom'
import { LineItemsGrid } from '../../../components/LineItemsGrid.jsx'
import { AddCategoryModal } from '../../../components/AddCategoryModal.jsx'
import { PlusCircle } from 'lucide-react'
import { createCategory } from '../../../apis/category.js'
import { bulkCreateIngredients } from '../../../apis/ingredient.js'
import { useToast } from '../../../components/Toaster.jsx'
import { CategoriesProvider, useCategories } from '../../../context/CategoriesContext.jsx'
import { Switch } from '../../../components/Switch.jsx'
import { BackButton } from '../../../components/BackButton.jsx'

function normalizeUnitInput(v) {
  return String(v ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function looksLikeBulkDelimitedText(text) {
  const t = String(text ?? '')
  if (!t.trim()) return false
  const hasNewline = /[\r\n]/.test(t)
  const hasDelimiter = t.includes('\t') || t.includes(',') || t.includes(';')
  // If it's multi-line and delimited, treat as bulk.
  if (hasNewline && hasDelimiter) return true
  // Also treat tabbed single-line as likely copy from grid.
  if (!hasNewline && t.includes('\t')) return true
  return false
}

function detectDelimiter(sampleLine) {
  const s = String(sampleLine ?? '')
  if (s.includes('\t')) return '\t'
  const comma = (s.match(/,/g) || []).length
  const semi = (s.match(/;/g) || []).length
  if (semi > comma) return ';'
  return ','
}

function parseDelimitedLine(line, delimiter) {
  // Basic CSV/TSV line parser with support for double quotes.
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
        continue
      }
      inQuotes = !inQuotes
      continue
    }
    if (!inQuotes && ch === delimiter) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out.map((s) => String(s ?? '').trim())
}

function normalizeCategoryLabel(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function newIngredientRow() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: '',
    category_id: '',
    unit: 'kg',
    base_price: '',
    tags: '',
    is_active: '1',
    _status: '',
    _error: '',
  }
}

function InventoryIngredientCreateInnerPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { options: categoryOptions, addCategory } = useCategories()
  const [rows, setRows] = useState(() => [newIngredientRow()])
  const [undoStack, setUndoStack] = useState(() => /** @type {any[][]} */ ([]))
  const [addCategoryOpen, setAddCategoryOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const rowsRef = useRef(rows)
  useEffect(() => {
    rowsRef.current = rows
  }, [rows])

  useEffect(() => {
    if (!categoryOptions?.length) return
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        category_id: r.category_id ? r.category_id : categoryOptions[0].value,
      })),
    )
  }, [categoryOptions])

  const addRowsFromDelimitedText = useCallback(
    (text, rowIndex) => {
      const raw = String(text ?? '')
      const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
      if (!normalized) return

      const lines = normalized
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)

      if (!lines.length) return

      const delimiter = detectDelimiter(lines[0])
      const rows2d = lines.map((l) => parseDelimitedLine(l, delimiter))

      // Header support: name, category/category_id, unit, base_price, tags, is_active
      const header = rows2d[0].map((h) => String(h).trim().toLowerCase())
      const hasHeader = header.includes('name') || header.includes('ingredient') || header.includes('category') || header.includes('category_id')
      const dataRows = hasHeader ? rows2d.slice(1) : rows2d

      const idxByKey = (key) => (hasHeader ? header.indexOf(key) : -1)
      const idxName = idxByKey('name') >= 0 ? idxByKey('name') : 0
      const idxCategoryId = idxByKey('category_id')
      const idxCategory = idxByKey('category')
      const idxCategoryName = idxByKey('category_name')
      const idxUnit = idxByKey('unit')
      const idxBase = idxByKey('base_price')
      const idxTags = idxByKey('tags')
      const idxActive = idxByKey('is_active')

      const categoryByName = new Map(
        categoryOptions.map((o) => [normalizeCategoryLabel(o.label), String(o.value)]),
      )

      const fallbackCategoryId =
        String(rowsRef.current?.[rowIndex]?.category_id ?? '').trim() ||
        String(categoryOptions?.[0]?.value ?? '').trim()

      const mapped = dataRows
        .map((cols) => {
          const name = String(cols[idxName] ?? '').trim()
          if (!name) return null

          let category_id = ''
          if (idxCategoryId >= 0) {
            category_id = String(cols[idxCategoryId] ?? '').trim()
          } else if (idxCategory >= 0 || idxCategoryName >= 0) {
            const pos = idxCategory >= 0 ? idxCategory : idxCategoryName
            const catRaw = String(cols[pos] ?? '').trim()
            category_id = /^\d+$/.test(catRaw)
              ? catRaw
              : (categoryByName.get(normalizeCategoryLabel(catRaw)) ?? '')
          } else {
            // default position if no header: [name, category, unit, base_price, tags, is_active]
            const catRaw = String(cols[1] ?? '').trim()
            category_id = /^\d+$/.test(catRaw)
              ? catRaw
              : (categoryByName.get(normalizeCategoryLabel(catRaw)) ?? '')
          }

          const unit = (idxUnit >= 0 ? cols[idxUnit] : cols[2]) ?? ''
          const base_price = (idxBase >= 0 ? cols[idxBase] : cols[3]) ?? ''
          const tags = (idxTags >= 0 ? cols[idxTags] : cols[4]) ?? ''
          const is_active = (idxActive >= 0 ? cols[idxActive] : cols[5]) ?? '1'

          const activeStr = String(is_active ?? '').trim().toLowerCase()
          const activeVal = activeStr === '0' || activeStr === 'false' || activeStr === 'no' ? '0' : '1'

          return {
            ...newIngredientRow(),
            name,
            category_id: String(category_id || fallbackCategoryId),
            unit: normalizeUnitInput(String(unit || 'kg').trim() || 'kg') || 'kg',
            base_price: String(base_price ?? '').trim(),
            tags: String(tags ?? '').trim(),
            is_active: activeVal,
          }
        })
        .filter(Boolean)

      if (!mapped.length) return

      setRows((prev) => {
        const fb =
          String(prev?.[rowIndex]?.category_id ?? '').trim() || String(categoryOptions?.[0]?.value ?? '').trim()
        const mappedWithFb = mapped.map((row) => ({
          ...row,
          category_id: String(row.category_id || fb),
        }))

        const next = [...prev]
        const targetIndex = Math.min(Math.max(0, Number(rowIndex) || 0), Math.max(0, next.length - 1))

        const first = mappedWithFb[0]
        next[targetIndex] = { ...next[targetIndex], ...first, id: next[targetIndex].id }

        const rest = mappedWithFb.slice(1)
        if (rest.length) next.splice(targetIndex + 1, 0, ...rest)

        setUndoStack((h) => [...h, prev])
        return next
      })

      const n = mapped.length
      const label = n === 1 ? 'ingredient' : 'ingredients'
      showToast({
        text: `${n} ${label} in the list to add — review and save when ready.`,
        theme: 'success',
        duration: 10000,
      })
    },
    [categoryOptions, showToast],
  )

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        kind: 'custom',
        placeholder: 'e.g. Basmati rice',
        thClassName: 'min-w-[220px]',
        align: 'left',
        render: ({ row, rowIndex, updateCell }) => (
          <input
            value={String(row?.name ?? '')}
            onChange={(e) => updateCell('name', e.target.value)}
            onKeyDown={(e) => {
              const k = String(e.key ?? '').toLowerCase()
              const isUndo = (e.ctrlKey || e.metaKey) && k === 'z'
              if (!isUndo) return
              e.preventDefault()
              e.stopPropagation()
              setUndoStack((h) => {
                if (!h.length) return h
                const last = h[h.length - 1]
                setRows(last)
                return h.slice(0, -1)
              })
            }}
            onPaste={(e) => {
              const text = e.clipboardData?.getData('text/plain') ?? ''
              if (!looksLikeBulkDelimitedText(text)) return
              e.preventDefault()
              addRowsFromDelimitedText(text, rowIndex)
            }}
            placeholder="e.g. Basmati rice"
            className="box-border h-9 w-full min-w-[72px] border-0 bg-transparent px-2 py-1 text-sm tabular-nums text-slate-900 outline-none placeholder:text-slate-400 focus:bg-slate-50 focus:ring-2 focus:ring-inset focus:ring-slate-300"
          />
        ),
      },
      { key: 'category_id', header: 'Category', kind: 'select', options: categoryOptions, thClassName: 'w-40' },
      {
        key: 'unit',
        header: 'Unit',
        kind: 'custom',
        placeholder: 'e.g. kg',
        thClassName: 'w-28',
        align: 'left',
        render: ({ row, updateCell }) => (
          <input
            value={String(row?.unit ?? '')}
            onChange={(e) => updateCell('unit', normalizeUnitInput(e.target.value))}
            onBlur={(e) => updateCell('unit', normalizeUnitInput(e.target.value))}
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. kg"
            className="box-border h-9 w-full min-w-[72px] border-0 bg-transparent px-2 py-1 text-sm tabular-nums text-slate-900 outline-none placeholder:text-slate-400 focus:bg-slate-50 focus:ring-2 focus:ring-inset focus:ring-slate-300"
          />
        ),
      },
      {
        key: 'base_price',
        header: 'Base price',
        kind: 'decimal',
        placeholder: '0',
        thClassName: 'w-36',
        align: 'right',
      },
      {
        key: 'tags',
        header: 'Tags',
        kind: 'text',
        placeholder: 'e.g. rice,grain',
        thClassName: 'min-w-[220px]',
        align: 'left',
      },
      {
        key: 'is_active',
        header: 'Active',
        kind: 'custom',
        thClassName: 'w-24',
        align: 'center',
        render: ({ row, updateCell }) => {
          const checked = String(row?.is_active ?? '1') === '1'
          return (
            <div className="flex items-center justify-center px-2">
              <Switch checked={checked} onChange={(v) => updateCell('is_active', v ? '1' : '0')} aria-label="Set active" />
            </div>
          )
        },
      },
    ],
    [addRowsFromDelimitedText, categoryOptions],
  )

  const canSave = useMemo(() => {
    return rows.some(
      (r) =>
        String(r.name ?? '').trim().length > 0 &&
        String(r.category_id ?? '').trim().length > 0 &&
        String(r.unit ?? '').trim().length > 0,
    )
  }, [rows])

  return (
    <section className="flex  flex-col gap-4 ">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb items={[{ label: 'Inventory' }, { label: 'Ingredients', href: '/inventory/ingredients' }, { label: 'Create' }]} />
        <div className="flex flex-wrap items-center gap-2">
          <BackButton to="/inventory/ingredients" />
          <Button variant="secondary" type="button" onClick={() => setAddCategoryOpen(true)}>
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Add category
          </Button>
          <BulkUploadButton
            variant="secondary"
            onUpload={(file) => {
              // TODO: POST multipart or parse CSV then batch API
              console.warn('[BulkUpload] ingredients CSV:', file?.name)
            }}
          />
        </div>
      </div>

      <div className="flex-1 py-4">
        <h2 className="text-base font-semibold text-slate-900">Create ingredient</h2>

        <div className="mt-4">
          <LineItemsGrid
            rows={rows}
            onRowsChange={setRows}
            createRow={newIngredientRow}
            columns={columns}
            getRowClassName={(row) => {
              if (row?._status === 'success') return 'bg-green-50'
              if (row?._status === 'failed') return 'bg-red-50'
              return ''
            }}
          />
        </div>
      </div>

      <div>
        <div className="mx-auto flex items-center justify-end  gap-2">
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              setError('')
              setUndoStack([])
              setRows(() => {
                const r = newIngredientRow()
                if (categoryOptions?.length) r.category_id = categoryOptions[0].value
                return [r]
              })
            }}
          >
            Reset
          </Button>
          <Button
            variant="primary"
            type="button"
            onClick={async () => {
              if (!canSave || isSaving) return
              setError('')
              setIsSaving(true)
              try {
                // reset per-row statuses before sending
                setRows((prev) => prev.map((r) => ({ ...r, _status: '', _error: '' })))

                const normalized = rows
                  .map((r, idx) => {
                    const name = String(r.name ?? '').trim()
                    const category_id = Number(r.category_id)
                    const unit = normalizeUnitInput(String(r.unit ?? '').trim() || 'kg') || 'kg'
                    const base_price_raw = String(r.base_price ?? '').trim()
                    const tags_raw = String(r.tags ?? '').trim()
                    const is_active = String(r.is_active ?? '1') === '1'

                    const base_price =
                      base_price_raw === ''
                        ? undefined
                        : Number.isFinite(Number(base_price_raw))
                          ? Number(base_price_raw)
                          : undefined

                    const tags =
                      tags_raw === ''
                        ? undefined
                        : tags_raw
                            .split(/[,\|]/g)
                            .map((s) => s.trim())
                            .filter(Boolean)

                    return {
                      __row: idx + 1,
                      name,
                      category_id,
                      unit,
                      base_price,
                      tags,
                      is_active,
                    }
                  })
                  .filter((p) => p.name)

                const resp = await bulkCreateIngredients({ items: normalized })
                const failures = Array.isArray(resp?.failures) ? resp.failures : []
                const failedRows = new Map(
                  failures
                    .filter((f) => Number.isFinite(Number(f?.row)))
                    .map((f) => [Number(f.row), String(f?.error ?? 'Failed')]),
                )

                setRows((prev) =>
                  prev.map((r, idx) => {
                    const rowNum = idx + 1
                    const errMsg = failedRows.get(rowNum)
                    if (errMsg) return { ...r, _status: 'failed', _error: errMsg }
                    // If row has no name, leave neutral.
                    if (!String(r?.name ?? '').trim()) return { ...r, _status: '', _error: '' }
                    return { ...r, _status: 'success', _error: '' }
                  }),
                )

                // If everything succeeded, navigate back.
                const anyFailed = failedRows.size > 0
                if (!anyFailed) navigate('/inventory/ingredients')
              } catch (e) {
                setError(e?.response?.data?.message || e?.message || 'Failed to save ingredients')
              } finally {
                setIsSaving(false)
              }
            }}
            disabled={!canSave || isSaving}
          >
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      <AddCategoryModal
        open={addCategoryOpen}
        onClose={() => setAddCategoryOpen(false)}
        onCreate={async (name) => {
          const data = await createCategory({ name, is_active: true })
          const c = data?.category
          if (!c?.id) return
          addCategory(c)
          setRows((prev) =>
            prev.map((r) => ({
              ...r,
              category_id: r.category_id ? r.category_id : String(c.id),
            })),
          )
        }}
      />

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}
    </section>
  )
}

export function InventoryIngredientCreatePage() {
  return (
    <CategoriesProvider>
      <InventoryIngredientCreateInnerPage />
    </CategoriesProvider>
  )
}

