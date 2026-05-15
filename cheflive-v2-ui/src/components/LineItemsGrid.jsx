import { useCallback } from 'react'
import { Minus, Plus } from 'lucide-react'

/** @param {{ value: string, onChange: (v: string) => void, readOnly?: boolean, className?: string } & React.InputHTMLAttributes<HTMLInputElement>} props */
function CellInput({ value, onChange, readOnly = false, className = '', ...rest }) {
  return (
    <input
      readOnly={readOnly}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={
        'box-border min-h-9 w-full min-w-[72px] border-0 bg-transparent px-2 py-1 text-sm tabular-nums text-slate-900 outline-none placeholder:text-slate-400 ' +
        'focus:bg-slate-50 focus:ring-2 focus:ring-inset focus:ring-slate-300 ' +
        (readOnly ? 'cursor-default bg-slate-50/80 text-slate-600 ' : '') +
        className
      }
      {...rest}
    />
  )
}

/**
 * @template {{ id: string } & Record<string, unknown>} T
 * @typedef {{
 *   key: keyof T & string,
 *   header: React.ReactNode,
 *   thClassName?: string,
 *   tdClassName?: string,
 *   kind: 'text' | 'decimal' | 'select' | 'readonly' | 'computed' | 'custom',
 *   placeholder?: string,
 *   align?: 'left' | 'center' | 'right',
 *   options?: { value: string; label: string }[],
 *   compute?: (row: T) => string,
 *   render?: (ctx: {
 *     row: T,
 *     rowIndex: number,
 *     rows: T[],
 *     updateCell: (key: string, value: string) => void,
 *   }) => React.ReactNode,
 * }} LineItemsColumn
 */

/**
 * @template {{ id: string } & Record<string, unknown>} T
 * @param {{
 *   rows: T[],
 *   onRowsChange: import('react').Dispatch<import('react').SetStateAction<T[]>>,
 *   createRow: () => T,
 *   columns: LineItemsColumn<T>[],
 *   showIndexColumn?: boolean,
 *   showRowActions?: boolean,
 *   minRows?: number,
 *   rowActionsHeader?: React.ReactNode,
 *   getRowClassName?: (row: T, index: number) => string,
 *   className?: string,
 *   tableClassName?: string,
 *   footer?: { label: string; value: string; leadingColumnsSpan: number; blankCellsBeforeActions?: number } | null,
 * }} props
 */
export function LineItemsGrid({
  rows,
  onRowsChange,
  createRow,
  columns,
  showIndexColumn = true,
  showRowActions = true,
  minRows = 1,
  rowActionsHeader = 'Rows',
  getRowClassName,
  className = '',
  tableClassName = '',
  footer = null,
}) {
  const addRowAfter = useCallback(
    (index) => {
      onRowsChange((prev) => {
        const next = [...prev]
        next.splice(index + 1, 0, createRow())
        return next
      })
    },
    [createRow, onRowsChange],
  )

  const removeRow = useCallback(
    (index) => {
      onRowsChange((prev) => {
        if (prev.length <= minRows) return prev
        return prev.filter((_, i) => i !== index)
      })
    },
    [minRows, onRowsChange],
  )

  const updateCell = useCallback(
    (index, key, value) => {
      onRowsChange((prev) => {
        const next = [...prev]
        next[index] = { ...next[index], [key]: value }
        return next
      })
    },
    [onRowsChange],
  )

  const renderCell = (col, row, index) => {
    const key = col.key
    const raw = row[key]
    const strVal = raw === undefined || raw === null ? '' : String(raw)

    if (col.kind === 'custom' && col.render) {
      return col.render({
        row,
        rowIndex: index,
        rows,
        updateCell: (k, v) => updateCell(index, k, v),
      })
    }

    if (col.kind === 'computed' && col.compute) {
      const out = col.compute(row)
      return (
        <CellInput readOnly value={out} onChange={() => {}} placeholder="—" className={col.align === 'left' ? 'text-left' : ''} />
      )
    }

    if (col.kind === 'readonly') {
      return <CellInput readOnly value={strVal} onChange={() => {}} className="text-center text-slate-500" />
    }

    if (col.kind === 'select' && col.options) {
      return (
        <select
          value={strVal}
          onChange={(e) => updateCell(index, key, e.target.value)}
          className="box-border min-h-9 w-full border-0 bg-transparent px-2 text-sm text-slate-900 outline-none focus:bg-slate-50 focus:ring-2 focus:ring-inset focus:ring-slate-300"
        >
          {col.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    }

    if (col.kind === 'decimal') {
      return (
        <CellInput
          type="text"
          inputMode="decimal"
          value={strVal}
          onChange={(v) => updateCell(index, key, v)}
          placeholder={col.placeholder ?? '0'}
          className={col.align === 'left' ? 'text-left' : ''}
        />
      )
    }

    if (col.kind === 'text') {
      return (
        <CellInput
          value={strVal}
          onChange={(v) => updateCell(index, key, v)}
          placeholder={col.placeholder}
          className={col.align === 'left' ? 'text-left' : ''}
        />
      )
    }

    return (
      <CellInput
        value={strVal}
        onChange={(v) => updateCell(index, key, v)}
        placeholder={col.placeholder}
        className={col.align === 'left' ? 'text-left' : 'tabular-nums'}
      />
    )
  }

  // Each row drops the left border on its first cell and the right border on
  // its last cell so the table appears edge-to-edge ("infinite") while
  // internal cell separators remain. Works regardless of whether the optional
  // index column or row-actions column are rendered.
  const edgelessRow = '[&>:first-child]:border-l-0 [&>:last-child]:border-r-0'

  return (
    <div className={`w-full overflow-visible bg-white ${className}`}>
      <table className={`w-full min-w-[760px] border-collapse border-0 text-left text-sm ${tableClassName}`}>
        <thead>
          <tr className={`bg-white [&>*]:border-x-0 [&>*]:border-t-0 ${edgelessRow}`}>
            {showIndexColumn ? (
              <th className="w-12 border border-slate-200 px-0 py-0 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">
                #
              </th>
            ) : null}
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={`border border-slate-200 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 ${col.thClassName ?? ''}`}
              >
                {col.header}
              </th>
            ))}
            {showRowActions ? (
              <th className="min-w-[5.5rem] border border-slate-200 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">
                {rowActionsHeader}
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.id}
              className={`hover:bg-slate-50/40 ${edgelessRow} ${typeof getRowClassName === 'function' ? getRowClassName(row, index) : ''}`}
            >
              {showIndexColumn ? (
                <td className="border border-slate-200 p-0 align-middle">
                  <CellInput readOnly value={String(index + 1)} onChange={() => {}} className="text-center text-slate-500" />
                </td>
              ) : null}
              {columns.map((col) => (
                <td key={String(col.key)} className={`overflow-visible border border-slate-200 p-0 align-middle ${col.tdClassName ?? ''}`}>
                  {renderCell(col, row, index)}
                </td>
              ))}
              {showRowActions ? (
                <td className="overflow-visible border border-slate-200 p-0 align-top">
                  <div className="flex min-h-9 flex-wrap items-center justify-center gap-1 px-1 py-1">
                    <button
                      type="button"
                      title="Remove row"
                      disabled={rows.length <= minRows}
                      onClick={() => removeRow(index)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Minus className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      title="Add row below"
                      onClick={() => addRowAfter(index)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
        {footer ? (
          <tfoot>
            <tr className={`bg-slate-50 ${edgelessRow}`}>
              <td
                colSpan={footer.leadingColumnsSpan}
                className="border border-slate-200 px-2 py-2 text-right text-sm font-medium text-slate-700"
              >
                {footer.label}
              </td>
              <td className="border border-slate-200 p-0 align-middle">
                <CellInput readOnly value={footer.value} onChange={() => {}} />
              </td>
              {Array.from({
                length:
                  footer.blankCellsBeforeActions !== undefined && footer.blankCellsBeforeActions > 0
                    ? footer.blankCellsBeforeActions
                    : 0,
              }).map((_, i) => (
                <td key={`footer-blank-${i}`} className="border border-slate-200 bg-slate-50" aria-hidden="true" />
              ))}
              {showRowActions ? <td className="border border-slate-200 bg-slate-50" /> : null}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  )
}
