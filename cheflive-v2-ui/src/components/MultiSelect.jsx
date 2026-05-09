import React, { useMemo } from 'react'
import Select from 'react-select'
import makeAnimated from 'react-select/animated'

const animatedComponents = makeAnimated()

const baseStyles = {
  control: (provided, state) => ({
    ...provided,
    minHeight: 36,
    height: 36,
    borderRadius: 10,
    borderColor: state.isFocused ? '#cbd5e1' : '#e2e8f0', // slate-300 / slate-200
    boxShadow: state.isFocused ? '0 0 0 2px rgba(148,163,184,0.45)' : 'none', // slate ring
    backgroundColor: 'white',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    color: '#0f172a', // slate-900
    '&:hover': { borderColor: '#cbd5e1' },
  }),
  valueContainer: (provided) => ({ ...provided, padding: '0 8px', height: 36 }),
  input: (provided) => ({ ...provided, margin: 0, padding: 0, color: '#0f172a', fontSize: '0.875rem' }),
  placeholder: (provided) => ({ ...provided, color: '#94a3b8', fontSize: '0.875rem' }), // slate-400
  indicatorsContainer: (provided) => ({ ...provided, height: 36 }),
  dropdownIndicator: (provided) => ({ ...provided, padding: 6 }),
  clearIndicator: (provided) => ({ ...provided, padding: 6 }),
  multiValue: (provided) => ({ ...provided, backgroundColor: '#f1f5f9', borderRadius: 9999 }), // slate-100
  multiValueLabel: (provided) => ({ ...provided, color: '#0f172a', fontSize: 12, fontWeight: 600 }), // slate-900
  multiValueRemove: (provided) => ({
    ...provided,
    borderRadius: 9999,
    ':hover': { backgroundColor: '#e2e8f0', color: '#0f172a' },
  }),
  menu: (provided) => ({ ...provided, borderRadius: 12, overflow: 'hidden', zIndex: 30 }),
  option: (provided, state) => ({
    ...provided,
    fontSize: 13,
    backgroundColor: state.isSelected ? '#0f172a' : state.isFocused ? '#f8fafc' : 'white',
    color: state.isSelected ? 'white' : '#0f172a',
    ':active': { backgroundColor: state.isSelected ? '#0f172a' : '#e2e8f0' },
  }),
}

// Borderless variant for use inside grid cells (LineItemsGrid). Matches the
// look of the plain `CellInput` cells: no border, no background fill, no
// rounding, transparent until focus — then an inset slate ring like the
// other cell inputs.
const bareStyles = {
  ...baseStyles,
  control: (provided, state) => ({
    ...provided,
    minHeight: 36,
    height: 36,
    border: 0,
    borderRadius: 0,
    backgroundColor: state.isFocused ? '#f8fafc' : 'transparent', // slate-50 on focus
    boxShadow: state.isFocused
      ? 'inset 0 0 0 2px #cbd5e1' // slate-300 inset ring, matches CellInput focus
      : 'none',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    color: '#0f172a',
    '&:hover': { borderColor: 'transparent' },
  }),
  valueContainer: (provided) => ({ ...provided, padding: '0 8px', height: 36 }),
  indicatorsContainer: (provided) => ({ ...provided, height: 36 }),
  // Hide the vertical separator between value and indicators for a cleaner cell look.
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (provided) => ({ ...provided, padding: 4, color: '#94a3b8' }),
  clearIndicator: (provided) => ({ ...provided, padding: 4, color: '#94a3b8' }),
}

/**
 * @param {{
 *  options: { value: string, label: string }[],
 *  isMulti?: boolean,
 *  value: string[] | string,
 *  onChange: (next: string[] | string) => void,
 *  onSearchChange?: (q: string) => void,
 *  placeholder?: string,
 *  className?: string,
 *  isDisabled?: boolean,
 *  bare?: boolean,
 * }} props
 */
export function MultiSelect({
  options,
  isMulti = true,
  value,
  onChange,
  onSearchChange,
  placeholder = 'Select…',
  className = '',
  isDisabled = false,
  bare = false,
}) {
  const safeOptions = Array.isArray(options) ? options : []
  const safeValue = isMulti ? (Array.isArray(value) ? value : []) : String(value ?? '')

  const valueOptions = useMemo(() => {
    if (isMulti) {
      const set = new Set((Array.isArray(safeValue) ? safeValue : []).map(String))
      return safeOptions.filter((o) => set.has(String(o.value)))
    }
    return safeOptions.find((o) => String(o.value) === String(safeValue)) ?? null
  }, [isMulti, safeOptions, safeValue])

  const portalTarget = typeof document !== 'undefined' ? document.body : null

  return (
    <div className={className}>
      <Select
        isMulti={Boolean(isMulti)}
        closeMenuOnSelect={!isMulti}
        hideSelectedOptions={false}
        isDisabled={isDisabled}
        menuPortalTarget={portalTarget}
        menuPosition={portalTarget ? 'fixed' : 'absolute'}
        options={safeOptions}
        value={valueOptions}
        onInputChange={(next, meta) => {
          if (typeof onSearchChange !== 'function') return next
          // react-select emits multiple actions; we only want real typing.
          if (meta?.action !== 'input-change') return next
          onSearchChange(String(next ?? ''))
          return next
        }}
        onChange={(selected) => {
          if (isMulti) {
            const arr = Array.isArray(selected) ? selected : []
            onChange(arr.map((o) => String(o.value)))
            return
          }
          const one = selected && typeof selected === 'object' ? String(selected.value ?? '') : ''
          onChange(one)
        }}
        placeholder={placeholder}
        components={animatedComponents}
        styles={{
          ...(bare ? bareStyles : baseStyles),
          menuPortal: (provided) => ({ ...provided, zIndex: 80 }),
        }}
      />
    </div>
  )
}

