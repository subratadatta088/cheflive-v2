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

/**
 * @param {{
 *  options: { value: string, label: string }[],
 *  value: string[],
 *  onChange: (next: string[]) => void,
 *  placeholder?: string,
 *  className?: string,
 *  isDisabled?: boolean,
 * }} props
 */
export function MultiSelect({ options, value, onChange, placeholder = 'Select…', className = '', isDisabled = false }) {
  const safeOptions = Array.isArray(options) ? options : []
  const safeValue = Array.isArray(value) ? value : []

  const valueOptions = useMemo(() => {
    const set = new Set(safeValue.map(String))
    return safeOptions.filter((o) => set.has(String(o.value)))
  }, [safeOptions, safeValue])

  return (
    <div className={className}>
      <Select
        isMulti
        closeMenuOnSelect={false}
        hideSelectedOptions={false}
        isDisabled={isDisabled}
        options={safeOptions}
        value={valueOptions}
        onChange={(selected) => {
          const arr = Array.isArray(selected) ? selected : []
          onChange(arr.map((o) => String(o.value)))
        }}
        placeholder={placeholder}
        components={animatedComponents}
        styles={baseStyles}
      />
    </div>
  )
}

