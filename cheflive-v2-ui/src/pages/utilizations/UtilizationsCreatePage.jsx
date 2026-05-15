import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFormik } from 'formik'
import { Plus, RotateCcw, Save } from 'lucide-react'
import { Breadcrumb } from '../../components/Breadcrumb.jsx'
import { Button } from '../../components/Button.jsx'
import { AddOriginButton } from '../../components/AddOriginButton.jsx'
import { CreatePreparationButton } from '../../components/CreatePreparationButton.jsx'
import {
  getIngredientsBulkByIds,
  listIngredients,
  listIngredientUnitConversions,
} from '../../apis/ingredient.js'
import { listPreparations } from '../../apis/preparation.js'
import {
  createUtilization,
  getUtilizationById,
  updateUtilizationById,
} from '../../apis/utilization.js'
import { useToast } from '../../components/Toaster.jsx'
import { OriginsProvider, useOrigins } from '../../context/OriginsContext.jsx'
import { UtilizationRecordEditor } from './UtilizationRecordEditor.jsx'
import {
  buildIngredientLabel,
  loadPreparationForRecord,
  newRow,
  newUtilizationRecord,
  recordToCreatePayload,
  todayLocalDate,
  UtilizationRecordSchema,
  zodToFormikErrors,
} from './utilizationFormUtils.js'

async function loadEditBootstrap(editId) {
  const raw = await getUtilizationById(editId)
  const u = raw?.utilization ?? raw
  if (!u?.id) throw new Error('Utilization not found.')

  const items = Array.isArray(u.items) ? u.items : []
  const ingIds = [
    ...new Set(items.map((it) => Number(it.ingredient_id)).filter((n) => Number.isFinite(n) && n > 0)),
  ]

  const bulkRaw = ingIds.length ? await getIngredientsBulkByIds(ingIds) : {}
  const bulkItems = Array.isArray(bulkRaw?.items) ? bulkRaw.items : []

  const ingredientsById = {}
  const ingredientsByItemCode = {}
  for (const it of bulkItems) {
    const id = Number(it?.id)
    if (!Number.isFinite(id) || id <= 0) continue
    const ing = {
      id,
      item_code: it?.item_code ?? null,
      name: it?.name ?? '',
      unit: it?.unit ?? '',
    }
    ingredientsById[String(id)] = ing
    const code = ing.item_code === null || ing.item_code === undefined ? '' : String(ing.item_code)
    if (code) ingredientsByItemCode[code] = ing
  }

  const perIngMeta = new Map()
  await Promise.all(
    ingIds.map(async (ingredientId) => {
      const ingKey = String(ingredientId)
      let convItems = []
      try {
        const convData = await listIngredientUnitConversions(ingKey)
        convItems = Array.isArray(convData?.items) ? convData.items : []
      } catch {
        // ignore
      }
      const ing = ingredientsById[ingKey]
      const baseUnit = ing?.unit ? String(ing.unit) : ''
      const units = []
      if (baseUnit) units.push(baseUnit)
      for (const c of convItems) {
        const from = c?.from_unit ? String(c.from_unit) : ''
        const to = c?.to_unit ? String(c.to_unit) : ''
        if (from) units.push(from)
        if (to) units.push(to)
      }
      const uniq = [...new Set(units)]
      perIngMeta.set(ingredientId, {
        convItems,
        unitOptions: uniq.length ? uniq.map((u) => ({ value: u, label: u })) : null,
        baseUnit,
      })
    }),
  )

  const rows =
    items.length === 0
      ? [newRow()]
      : items.map((it) => {
          const ingredientId = Number(it.ingredient_id)
          const ingKey = String(ingredientId)
          const ing = ingredientsById[ingKey]
          const meta = perIngMeta.get(ingredientId) || { unitOptions: null, baseUnit: '' }
          const storedUnit =
            it.unit != null && String(it.unit).trim() !== '' ? String(it.unit).trim() : meta.baseUnit
          return {
            ...newRow(),
            ingredient_id: Number.isFinite(ingredientId) && ingredientId > 0 ? ingKey : '',
            item_code: ing?.item_code != null ? String(ing.item_code) : '',
            ingredient_label:
              buildIngredientLabel(ing) || (it.ingredient_name ? String(it.ingredient_name) : ingKey),
            qty: Number.isFinite(Number(it.qty)) ? String(it.qty) : '',
            unit: storedUnit,
            unitOptions: meta.unitOptions,
            baseUnit: meta.baseUnit,
          }
        })

  const d = u.date != null ? String(u.date).trim() : ''
  const utilizationDate = d.length >= 10 ? d.slice(0, 10) : d || todayLocalDate()

  const prepId = Number(u.preparation_id)
  const hasPrep = Number.isFinite(prepId) && prepId > 0
  const headerQtyNum = u.qty != null ? Number(u.qty) : NaN
  const hasHeaderQty = Number.isFinite(headerQtyNum) && headerQtyNum > 0
  const headerUnit = u.unit != null ? String(u.unit).trim() : ''
  const manualMode = hasPrep && items.length === 0

  const preparationLabel =
    u.preparation_name != null && String(u.preparation_name).trim() !== ''
      ? String(u.preparation_name).trim()
      : ''

  const initialValues = {
    preparationId: hasPrep ? String(prepId) : '',
    preparationLabel,
    manualMode,
    headerQty: hasHeaderQty ? String(u.qty) : '',
    headerUnit,
    originId: String(Number(u.origin_id) || ''),
    utilizationDate,
    notes: u.note != null && u.note !== undefined ? String(u.note) : '',
    rows,
  }

  const preparationOption =
    hasPrep && preparationLabel
      ? { value: String(prepId), label: preparationLabel }
      : null

  return {
    initialValues,
    resetSnapshot: structuredClone(initialValues),
    ingredientsById,
    ingredientsByItemCode,
    preparationOption,
  }
}

function useIngredientLookup(editBoot) {
  const [ingredientOptions, setIngredientOptions] = useState([])
  const [ingredientsById, setIngredientsById] = useState(() =>
    editBoot?.ingredientsById ? { ...editBoot.ingredientsById } : {},
  )
  const [ingredientsByItemCode, setIngredientsByItemCode] = useState(() =>
    editBoot?.ingredientsByItemCode ? { ...editBoot.ingredientsByItemCode } : {},
  )
  const [ingredientSearch, setIngredientSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => {
      void (async () => {
        try {
          const q = ingredientSearch.trim() || undefined
          const { items } = await listIngredients({ q, limit: 20 })
          if (cancelled) return
          const fresh = []
          const byIdDelta = {}
          const byCodeDelta = {}
          for (const it of Array.isArray(items) ? items : []) {
            const id = Number(it?.id)
            if (!Number.isFinite(id) || id <= 0) continue
            const ing = {
              id,
              item_code: it?.item_code ?? null,
              name: it?.name ?? '',
              unit: it?.unit ?? '',
            }
            byIdDelta[String(id)] = ing
            const code = ing.item_code === null || ing.item_code === undefined ? '' : String(ing.item_code)
            if (code) byCodeDelta[code] = ing
            fresh.push(ing)
          }
          setIngredientsById((prev) => ({ ...prev, ...byIdDelta }))
          setIngredientsByItemCode((prev) => ({ ...prev, ...byCodeDelta }))
          setIngredientOptions(
            fresh.map((x) => ({ value: String(x.id), label: buildIngredientLabel(x) })),
          )
        } catch {
          if (!cancelled) setIngredientOptions([])
        }
      })()
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [ingredientSearch])

  return {
    ingredientOptions,
    ingredientsById,
    ingredientsByItemCode,
    setIngredientSearch,
    setIngredientsById,
    setIngredientsByItemCode,
  }
}

function usePreparationLookup(editBoot) {
  const [preparationOptions, setPreparationOptions] = useState(() => {
    const seed = editBoot?.preparationOption
    return seed ? [seed] : []
  })
  const [preparationSearch, setPreparationSearch] = useState('')
  const [preparationLoading, setPreparationLoading] = useState(false)

  useEffect(() => {
    const seed = editBoot?.preparationOption
    if (!seed) return
    setPreparationOptions((prev) => {
      if (prev.some((o) => String(o.value) === String(seed.value))) return prev
      return [seed, ...prev]
    })
  }, [editBoot?.preparationOption])

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => {
      void (async () => {
        setPreparationLoading(true)
        try {
          const q = preparationSearch.trim() || undefined
          const { items } = await listPreparations({ q, limit: 20 })
          if (cancelled) return
          const opts = (Array.isArray(items) ? items : [])
            .map((p) => {
              const id = Number(p?.id)
              if (!Number.isFinite(id) || id <= 0) return null
              const name = p?.name != null ? String(p.name).trim() : ''
              return { value: String(id), label: name || `Preparation #${id}` }
            })
            .filter(Boolean)
          setPreparationOptions((prev) => {
            const byVal = new Map(prev.map((o) => [String(o.value), o]))
            for (const o of opts) byVal.set(String(o.value), o)
            return [...byVal.values()]
          })
        } catch {
          if (!cancelled) setPreparationOptions((prev) => (prev.length ? prev : []))
        } finally {
          if (!cancelled) setPreparationLoading(false)
        }
      })()
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [preparationSearch])

  return {
    preparationOptions,
    preparationLoading,
    setPreparationSearch,
    setPreparationOptions,
  }
}

async function applyPreparationSelection(prepId, preparationOptions, applyPatch) {
  if (!prepId) {
    applyPatch({
      preparationId: '',
      preparationLabel: '',
      manualMode: false,
      headerQty: '',
      headerUnit: '',
      rows: [newRow()],
    })
    return
  }

  const opt = preparationOptions.find((o) => String(o.value) === String(prepId))
  applyPatch({
    preparationId: String(prepId),
    preparationLabel: opt?.label ?? '',
  })

  try {
    const loaded = await loadPreparationForRecord(prepId)
    applyPatch({
      preparationId: String(prepId),
      preparationLabel: loaded.preparationLabel || opt?.label || '',
      manualMode: loaded.manualMode,
      headerQty: loaded.headerQty ?? '',
      headerUnit: loaded.headerUnit ?? '',
      rows: loaded.rows,
    })
  } catch (e) {
    console.error('[Preparation load failed]', e)
  }
}

export function UtilizationsUtilizationForm({ editUtilizationId } = {}) {
  const isEdit = Number.isFinite(Number(editUtilizationId)) && Number(editUtilizationId) > 0
  const editId = isEdit ? Number(editUtilizationId) : 0
  const [editBoot, setEditBoot] = useState(null)
  const [editLoadError, setEditLoadError] = useState('')

  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    void (async () => {
      try {
        const boot = await loadEditBootstrap(editId)
        if (!cancelled) setEditBoot(boot)
      } catch (e) {
        if (!cancelled) {
          setEditLoadError(
            e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Failed to load utilization.',
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isEdit, editId])

  if (isEdit && editLoadError) {
    return (
      <section className="space-y-4">
        <Breadcrumb items={[{ label: 'Utilizations', href: '/utilizations/history' }, { label: 'Edit' }]} />
        <p className="text-sm text-red-700">{editLoadError}</p>
      </section>
    )
  }

  if (isEdit && !editBoot) {
    return (
      <section className="space-y-4">
        <Breadcrumb items={[{ label: 'Utilizations', href: '/utilizations/history' }, { label: 'Edit' }]} />
        <p className="mt-2 text-sm text-slate-600">Loading…</p>
      </section>
    )
  }

  return (
    <UtilizationsUtilizationFormInner key={`edit-${editId}`} editId={editId} editBoot={editBoot} />
  )
}

function UtilizationsUtilizationFormInner({ editId, editBoot }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { origins: originOptions, defaultOrigin, addOrigin } = useOrigins()
  const [prepApplying, setPrepApplying] = useState(false)

  const {
    ingredientOptions,
    ingredientsById,
    ingredientsByItemCode,
    setIngredientSearch,
  } = useIngredientLookup(editBoot)

  const {
    preparationOptions,
    preparationLoading,
    setPreparationSearch,
  } = usePreparationLookup(editBoot)

  const formik = useFormik({
    initialValues: editBoot?.initialValues ?? newUtilizationRecord(defaultOrigin?.id),
    validateOnChange: false,
    validateOnBlur: false,
    validate: (values) => {
      const res = UtilizationRecordSchema.safeParse(values)
      if (res.success) return {}
      return zodToFormikErrors(res.error)
    },
    onSubmit: async (values, helpers) => {
      if (!confirm('Are you sure you want to save this utilization?')) return
      helpers.setStatus(undefined)
      helpers.setSubmitting(true)
      try {
        const note = String(values.notes ?? '').trim()
        const payload = {
          origin_id: Number(values.originId),
          date: values.utilizationDate,
          note: note === '' ? null : note,
          preparation_id: Number(values.preparationId),
          type: 'preparation',
        }
        payload.qty = parseFloat(String(values.headerQty ?? '').replace(',', '.'))
        payload.unit = String(values.headerUnit ?? '').trim()
        await updateUtilizationById(editId, payload)
        showToast({ text: 'Utilization updated.', theme: 'success', duration: 4000 })
        navigate('/utilizations/history')
      } catch (e) {
        helpers.setStatus(e?.response?.data?.error || e?.message || 'Failed to save utilization.')
      } finally {
        helpers.setSubmitting(false)
      }
    },
  })

  const setRows = useCallback(
    (updater) => {
      const prev = Array.isArray(formik.values.rows) ? formik.values.rows : []
      const next = typeof updater === 'function' ? updater(prev) : updater
      formik.setFieldValue('rows', next)
    },
    [formik],
  )

  const handleFieldChange = useCallback(
    (field, value) => {
      formik.setFieldValue(field, value)
    },
    [formik],
  )

  const handlePreparationSelect = useCallback(
    async (prepId) => {
      setPrepApplying(true)
      try {
        await applyPreparationSelection(prepId, preparationOptions, (patch) => {
          formik.setValues({ ...formik.values, ...patch })
        })
      } finally {
        setPrepApplying(false)
      }
    },
    [formik, preparationOptions],
  )

  const handleOriginCreated = useCallback(
    (created) => {
      addOrigin(created)
      const idNum = created?.id != null ? Number(created.id) : NaN
      if (Number(created?.is_default ?? 0) === 1 && Number.isFinite(idNum) && idNum > 0) {
        formik.setFieldValue('originId', String(idNum))
      }
    },
    [addOrigin, formik],
  )

  return (
    <section className="space-y-4">
      <div className="mt-4" />
      <Breadcrumb items={[{ label: 'Utilizations', href: '/utilizations/history' }, { label: 'Edit' }]} />
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">Edit utilization #{editId}</h2>
        <AddOriginButton onCreated={handleOriginCreated} />
      </div>

      <form onSubmit={formik.handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-600">
          Line items are shown for reference. Saving updates preparation, date, origin, notes, and header
          qty/unit when applicable.
        </p>

        <UtilizationRecordEditor
          record={formik.values}
          errors={formik.errors}
          originOptions={originOptions}
          preparationOptions={preparationOptions}
          preparationLoading={preparationLoading || prepApplying}
          onPreparationSearchChange={setPreparationSearch}
          onPreparationSelect={(id) => void handlePreparationSelect(id)}
          defaultOrigin={defaultOrigin}
          ingredientOptions={ingredientOptions}
          ingredientsById={ingredientsById}
          ingredientsByItemCode={ingredientsByItemCode}
          setIngredientSearch={setIngredientSearch}
          lineReadOnly
          showRemove={false}
          onRemove={() => {}}
          onFieldChange={handleFieldChange}
          onRowsChange={setRows}
        />

        {formik.status ? (
          <p className="text-sm text-red-600" role="alert">
            {formik.status}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button type="submit" variant="dark" disabled={formik.isSubmitting}>
            <Save className="h-4 w-4" aria-hidden="true" />
            {formik.isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </section>
  )
}

function UtilizationsCreateInnerPage() {
  const { showToast } = useToast()
  const { origins: originOptions, defaultOrigin, addOrigin } = useOrigins()
  const defaultOriginId = defaultOrigin?.id ?? null

  const [records, setRecords] = useState(() => [newUtilizationRecord(defaultOriginId)])
  const [recordErrors, setRecordErrors] = useState(() => ({}))
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState('')

  const {
    ingredientOptions,
    ingredientsById,
    ingredientsByItemCode,
    setIngredientSearch,
  } = useIngredientLookup(null)

  const {
    preparationOptions,
    preparationLoading,
    setPreparationSearch,
    setPreparationOptions,
  } = usePreparationLookup(null)

  const recordsRef = useRef(records)
  recordsRef.current = records

  const updateRecord = useCallback((recordId, patch) => {
    setRecords((prev) =>
      prev.map((r) => (r.id === recordId ? { ...r, ...patch } : r)),
    )
  }, [])

  const updateRecordRows = useCallback((recordId, updater) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.id !== recordId) return r
        const nextRows = typeof updater === 'function' ? updater(r.rows) : updater
        return { ...r, rows: nextRows }
      }),
    )
  }, [])

  const handlePreparationSelect = useCallback(
    (recordId, prepId) => {
      void applyPreparationSelection(prepId, preparationOptions, (patch) => {
        updateRecord(recordId, patch)
      })
    },
    [preparationOptions, updateRecord],
  )

  const handleSaveAll = async () => {
    if (!confirm('Save all utilization records on this page?')) return
    setStatus('')
    const errors = {}
    let hasError = false
    for (const rec of recordsRef.current) {
      const res = UtilizationRecordSchema.safeParse(rec)
      if (!res.success) {
        errors[rec.id] = zodToFormikErrors(res.error)
        hasError = true
      }
    }
    setRecordErrors(errors)
    if (hasError) {
      setStatus('Fix validation errors before saving.')
      return
    }

    setSubmitting(true)
    let ok = 0
    let lastErr = ''
    for (const rec of recordsRef.current) {
      try {
        await createUtilization(recordToCreatePayload(rec))
        ok += 1
      } catch (e) {
        lastErr = e?.response?.data?.error || e?.message || 'Save failed'
      }
    }
    setSubmitting(false)
    if (ok === recordsRef.current.length) {
      showToast({
        text: ok === 1 ? 'Utilization saved.' : `${ok} utilizations saved.`,
        theme: 'success',
        duration: 5000,
      })
      setRecords([newUtilizationRecord(defaultOriginId)])
      setRecordErrors({})
      setStatus('')
    } else {
      setStatus(lastErr || `Saved ${ok} of ${recordsRef.current.length}.`)
      showToast({
        theme: 'failure',
        duration: 6000,
        text: lastErr || `Saved ${ok} of ${recordsRef.current.length}.`,
      })
    }
  }

  const handleReset = () => {
    setRecords([newUtilizationRecord(defaultOriginId)])
    setRecordErrors({})
    setStatus('')
  }

  const handleOriginCreated = (created) => {
    addOrigin(created)
  }

  const handlePreparationCreated = useCallback(
    (created) => {
      const id = created?.id != null ? Number(created.id) : NaN
      if (!Number.isFinite(id) || id <= 0) return
      const name = created?.name != null ? String(created.name).trim() : ''
      const option = { value: String(id), label: name || `Preparation #${id}` }
      setPreparationOptions((prev) => {
        const map = new Map(prev.map((o) => [String(o.value), o]))
        map.set(option.value, option)
        return [...map.values()]
      })
    },
    [setPreparationOptions],
  )

  return (
    <section className="space-y-4">
      <div className="mt-4" />
      <Breadcrumb items={[{ label: 'Utilizations' }, { label: 'Create' }]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">Create utilizations</h2>
        <div className="flex flex-wrap items-center gap-2">
          <CreatePreparationButton onCreated={handlePreparationCreated} />
          <AddOriginButton onCreated={handleOriginCreated} />
        </div>
      </div>
     
      <div>
        {records.map((rec) => (
          <UtilizationRecordEditor
            key={rec.id}
            record={rec}
            errors={recordErrors[rec.id] || {}}
            originOptions={originOptions}
            preparationOptions={preparationOptions}
            preparationLoading={preparationLoading}
            onPreparationSearchChange={setPreparationSearch}
            onPreparationSelect={(prepId) => handlePreparationSelect(rec.id, prepId)}
            defaultOrigin={defaultOrigin}
            ingredientOptions={ingredientOptions}
            ingredientsById={ingredientsById}
            ingredientsByItemCode={ingredientsByItemCode}
            setIngredientSearch={setIngredientSearch}
            showRemove={records.length > 1}
            onRemove={() => setRecords((prev) => prev.filter((r) => r.id !== rec.id))}
            onFieldChange={(field, value) => updateRecord(rec.id, { [field]: value })}
            onRowsChange={(updater) => updateRecordRows(rec.id, updater)}
          />
        ))}
      </div>

      <div className="flex flex-col items-end gap-2 border-t border-slate-200 pt-4">
        {status ? (
          <p className="text-sm text-red-600" role="alert">
            {status}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2 py-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setRecords((prev) => [...prev, newUtilizationRecord(defaultOriginId)])}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add utilization
          </Button>
          <Button type="button" variant="secondary" disabled={submitting} onClick={handleReset}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reset
          </Button>
          <Button type="button" variant="dark" disabled={submitting} onClick={() => void handleSaveAll()}>
            <Save className="h-4 w-4" aria-hidden="true" />
            {submitting ? 'Saving…' : 'Save all'}
          </Button>
        </div>
      </div>
    </section>
  )
}

export function UtilizationsCreatePage() {
  return (
    <OriginsProvider>
      <UtilizationsCreateInnerPage />
    </OriginsProvider>
  )
}
