import { Switch } from '../../../components/Switch.jsx'
import { PREPARATION_TYPES } from './preparationFormUtils.js'

/**
 * @param {{
 *   values: { name: string, type: string, unit: string, tags: string, is_active: boolean },
 *   errors?: Record<string, string>,
 *   disabled?: boolean,
 *   onChange: (field: string, value: string | boolean) => void,
 * }} props
 */
export function PreparationFormFields({ values, errors = {}, disabled = false, onChange }) {
  const fieldClass = (hasError) =>
    'h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 ' +
    (hasError ? 'border-red-400 focus:ring-red-300' : 'border-slate-200 focus:ring-slate-300')

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="space-y-1 sm:col-span-2 lg:col-span-1">
        <span className="text-sm font-medium text-slate-900">Name</span>
        <input
          value={values.name}
          disabled={disabled}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="e.g. Tomato sauce base"
          className={fieldClass(Boolean(errors.name))}
        />
        {errors.name ? (
          <p className="text-xs text-red-600" role="alert">
            {errors.name}
          </p>
        ) : null}
      </label>

      <label className="space-y-1">
        <span className="text-sm font-medium text-slate-900">Type</span>
        <select
          value={values.type}
          disabled={disabled}
          onChange={(e) => onChange('type', e.target.value)}
          className={fieldClass(false)}
        >
          {PREPARATION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1">
        <span className="text-sm font-medium text-slate-900">Unit</span>
        <input
          value={values.unit}
          disabled={disabled}
          onChange={(e) => onChange('unit', e.target.value)}
          placeholder="kg"
          className={fieldClass(false)}
        />
      </label>

      <label className="space-y-1 sm:col-span-2">
        <span className="text-sm font-medium text-slate-900">
          Tags <span className="font-normal text-slate-500">(optional, use | or ,)</span>
        </span>
        <input
          value={values.tags}
          disabled={disabled}
          onChange={(e) => onChange('tags', e.target.value)}
          placeholder="e.g. sauce|base"
          className={fieldClass(false)}
        />
      </label>

      <div className="flex items-end pb-1">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
          <Switch
            checked={values.is_active}
            disabled={disabled}
            onChange={(v) => onChange('is_active', v)}
            aria-label="Active"
          />
          Active
        </label>
      </div>
    </div>
  )
}
