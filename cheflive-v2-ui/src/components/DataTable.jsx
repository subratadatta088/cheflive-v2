import React, { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

/**
 * @template T
 * @typedef {{
 *   key: string,
 *   header: React.ReactNode,
 *   className?: string,
 *   cellClassName?: string,
 *   render?: (row: T) => React.ReactNode,
 * }} DataTableColumn
 */

/**
 * @template T
 * @param {{
 *   columns: DataTableColumn<T>[],
 *   rows: T[],
 *   getRowKey?: (row: T, index: number) => string | number,
 *   pageSizeOptions?: number[],
 *   initialPageSize?: number,
 *   initialPage?: number,
 *   searchPlaceholder?: string,
 *   initialSearch?: string,
 *   onSearchChange?: (value: string) => void,
 *   initialDateFrom?: string,
 *   initialDateTo?: string,
 *   onDateRangeChange?: (range: { from: string, to: string }) => void,
 *   emptyText?: string,
 *   className?: string,
 }} props
 */
export function DataTable({
  columns,
  rows,
  getRowKey,
  pageSizeOptions = [10, 25, 50, 100],
  initialPageSize = 25,
  initialPage = 1,
  searchPlaceholder = 'Search…',
  initialSearch = '',
  onSearchChange,
  initialDateFrom = '',
  initialDateTo = '',
  onDateRangeChange,
  emptyText = 'No results',
  className = '',
}) {
  const [search, setSearch] = useState(initialSearch)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [page, setPage] = useState(initialPage)
  const [dateFrom, setDateFrom] = useState(initialDateFrom)
  const [dateTo, setDateTo] = useState(initialDateTo)

  const safeColumns = Array.isArray(columns) ? columns : []
  const safeRows = Array.isArray(rows) ? rows : []

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return safeRows
    return safeRows.filter((r) => JSON.stringify(r).toLowerCase().includes(q))
  }, [safeRows, search])

  const total = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const startIdx = (safePage - 1) * pageSize
  const endIdx = Math.min(total, startIdx + pageSize)
  const pagedRows = filteredRows.slice(startIdx, endIdx)

  return (
    <section className={`w-full ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="text-sm text-slate-600">Show</div>
          <select
            value={pageSize}
            onChange={(e) => {
              const next = Number(e.target.value)
              setPageSize(next)
              setPage(1)
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <div className="text-sm text-slate-600">items</div>
        </div>

        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              const v = e.target.value
              setDateFrom(v)
              onDateRangeChange?.({ from: v, to: dateTo })
              setPage(1)
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
            aria-label="From date"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              const v = e.target.value
              setDateTo(v)
              onDateRangeChange?.({ from: dateFrom, to: v })
              setPage(1)
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
            aria-label="To date"
          />

          <div className="relative w-full sm:w-[320px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              onSearchChange?.(e.target.value)
              setPage(1)
            }}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto border-y border-slate-200 bg-white">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {safeColumns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`whitespace-nowrap border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 ${
                    c.className ?? ''
                  }`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedRows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(1, safeColumns.length)} className="px-4 py-10 text-center text-slate-500">
                  {emptyText}
                </td>
              </tr>
            ) : (
              pagedRows.map((row, idx) => (
                <tr key={String(getRowKey?.(row, startIdx + idx) ?? startIdx + idx)} className="hover:bg-slate-50/50">
                  {safeColumns.map((c) => (
                    <td
                      key={c.key}
                      className={`whitespace-nowrap border-b border-slate-100 px-4 py-3 text-slate-700 ${
                        c.cellClassName ?? ''
                      }`}
                    >
                      {c.render ? c.render(row) : /** @type {any} */ (row)?.[c.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3">
          <div className="text-sm text-slate-600">
            {total === 0 ? '0 items' : `${startIdx + 1}-${endIdx} of ${total}`}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Prev
            </button>
            <div className="text-sm text-slate-600">
              Page <span className="font-medium text-slate-900">{safePage}</span> / {totalPages}
            </div>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

