import { Trash2 } from 'lucide-react'
import { LineItemsGrid } from '../../components/LineItemsGrid.jsx'
import { MultiSelect } from '../../components/MultiSelect.jsx'
import { newRow } from './utilizationFormUtils.js'

function fieldClass(hasError) {
  return (
    'h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 ' +
    (hasError ? 'border-red-400 focus:ring-red-300' : 'border-slate-200 focus:ring-slate-300')
  )
}

/**
 * @param {{
 *   record: {
 *     preparationId: string,
 *     preparationLabel?: string,
 *     manualMode: boolean,
 *     headerQty: string,
 *     headerUnit: string,
 *     originId: string,
 *     utilizationDate: string,
 *     notes: string,
 *     rows: unknown[],
 *   },
 *   errors?: Record<string, string>,
 *   originOptions: Array<{ id: number, name: string }>,
 *   preparationOptions: { value: string, label: string }[],
 *   preparationLoading?: boolean,
 *   onPreparationSearchChange: (q: string) => void,
 *   onPreparationSelect: (id: string) => void,
 *   lineColumns: unknown[],
 *   showRemove: boolean,
 *   onRemove: () => void,
 *   onFieldChange: (field: string, value: string) => void,
 *   onRowsChange: import('react').Dispatch<import('react').SetStateAction<unknown[]>>,
 * }} props
 */
export function UtilizationRecordCard({
  record,
  errors = {},
  originOptions,
  preparationOptions,
  preparationLoading = false,
  onPreparationSearchChange,
  onPreparationSelect,
  lineColumns,
  showRemove,
  onRemove,
  onFieldChange,
  onRowsChange,
}) {
  const selectedPrep = record.preparationId ? String(record.preparationId) : ''
  let prepOptions = preparationOptions
  if (
    selectedPrep &&
    !preparationOptions.some((o) => String(o.value) === selectedPrep) &&
    record.preparationLabel
  ) {
    prepOptions = [{ value: selectedPrep, label: record.preparationLabel }, ...preparationOptions]
  }

  return (
    <div className="space-y-4 border-b border-slate-200 pb-6 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-12">
          <label className="space-y-1 sm:col-span-6">
            <span className="ms-1 text-sm font-medium text-slate-900">Preparation</span>
            <MultiSelect
              options={prepOptions}
              value={selectedPrep}
              placeholder={preparationLoading ? 'Loading…' : 'Search preparation…'}
              isMulti={false}
              onSearchChange={onPreparationSearchChange}
              onChange={(next) => onPreparationSelect(next ? String(next) : '')}
            />
            {errors.preparationId ? (
              <p className="text-xs text-red-600" role="alert">
                {errors.preparationId}
              </p>
            ) : null}
          </label>
          <label className="space-y-1 sm:col-span-3">
            <span className="ms-1 text-sm font-medium text-slate-900">Qty</span>
            <input
              type="text"
              inputMode="decimal"
              value={record.headerQty}
              onChange={(e) => onFieldChange('headerQty', e.target.value)}
              placeholder="0"
              aria-invalid={Boolean(errors.headerQty)}
              className={fieldClass(Boolean(errors.headerQty))}
            />
            {errors.headerQty ? (
              <p className="text-xs text-red-600" role="alert">
                {errors.headerQty}
              </p>
            ) : null}
          </label>
          <label className="space-y-1 sm:col-span-3">
            <span className="ms-1 text-sm font-medium text-slate-900">Unit</span>
            <input
              type="text"
              value={record.headerUnit}
              onChange={(e) => onFieldChange('headerUnit', e.target.value)}
              placeholder="Unit"
              aria-invalid={Boolean(errors.headerUnit)}
              className={fieldClass(Boolean(errors.headerUnit))}
            />
            {errors.headerUnit ? (
              <p className="text-xs text-red-600" role="alert">
                {errors.headerUnit}
              </p>
            ) : null}
          </label>
        </div>
        {showRemove ? (
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Remove
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="ms-1 text-sm font-medium text-slate-900">Date</span>
          <input
            type="date"
            value={record.utilizationDate}
            onChange={(e) => onFieldChange('utilizationDate', e.target.value)}
            aria-invalid={Boolean(errors.utilizationDate)}
            className={fieldClass(Boolean(errors.utilizationDate))}
          />
          {errors.utilizationDate ? (
            <p className="text-xs text-red-600" role="alert">
              {errors.utilizationDate}
            </p>
          ) : null}
        </label>
        <label className="space-y-1">
          <span className="ms-1 text-sm font-medium text-slate-900">Origin</span>
          <select
            value={record.originId}
            onChange={(e) => onFieldChange('originId', e.target.value)}
            aria-invalid={Boolean(errors.originId)}
            className={fieldClass(Boolean(errors.originId))}
          >
            <option value="">Select origin…</option>
            {originOptions.map((o) => (
              <option key={o.id} value={String(o.id)}>
                {o.name}
              </option>
            ))}
          </select>
          {errors.originId ? (
            <p className="text-xs text-red-600" role="alert">
              {errors.originId}
            </p>
          ) : null}
        </label>
        <label className="space-y-1 sm:col-span-3">
          <span className="ms-1 text-sm font-medium text-slate-900">
            Notes <span className="font-normal text-slate-500">(optional)</span>
          </span>
          <textarea
            value={record.notes}
            onChange={(e) => onFieldChange('notes', e.target.value)}
            rows={2}
            placeholder="Notes"
            className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </label>
      </div>

      {record.manualMode ? (
        <p className="text-xs text-slate-600">
          This preparation has no ingredient breakdown. Line items below are optional.
        </p>
      ) : null}

      <div className="space-y-1">
        <LineItemsGrid
          rows={record.rows}
          onRowsChange={onRowsChange}
          createRow={newRow}
          columns={lineColumns}
        />
        {errors.items ? (
          <p className="text-xs text-red-600" role="alert">
            {errors.items}
          </p>
        ) : null}
      </div>
    </div>
  )
}
