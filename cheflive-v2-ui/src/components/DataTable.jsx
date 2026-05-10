import React, { useCallback, useMemo, useState } from 'react'
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
 *   manualPagination?: boolean,
 *   page?: number,
 *   pageSize?: number,
 *   total?: number,
 *   search?: string,
 *   onPageChange?: (page: number) => void,
 *   onPageSizeChange?: (size: number) => void,
 *   initialDateFrom?: string,
 *   initialDateTo?: string,
 *   onDateRangeChange?: (range: { from: string, to: string }) => void,
 *   renderFilters?: (ctx: {
 *     manualPagination: boolean,
 *     search: string,
 *     setSearch: (value: string) => void,
 *     page: number,
 *     setPage: (page: number) => void,
 *     dateFrom: string,
 *     dateTo: string,
 *     setDateFrom: (value: string) => void,
 *     setDateTo: (value: string) => void,
 *   }) => React.ReactNode,
 *   emptyText?: string,
 *   className?: string,
 *   rowSelection?: { selectedIds: number[], onChange: (ids: number[]) => void, getRowId?: (row: T) => number },
 *   renderTableFooterCells?: () => React.ReactNode,
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
  manualPagination = false,
  page: controlledPage,
  pageSize: controlledPageSize,
  total: controlledTotal,
  search: controlledSearch,
  onPageChange,
  onPageSizeChange,
  initialDateFrom = '',
  initialDateTo = '',
  onDateRangeChange,
  renderFilters,
  emptyText = 'No results',
  className = '',
  rowSelection = null,
  renderTableFooterCells = null,
}) {
  const [searchState, setSearchState] = useState(initialSearch)
  const [pageSizeState, setPageSizeState] = useState(initialPageSize)
  const [pageState, setPageState] = useState(initialPage)
  const [dateFrom, setDateFrom] = useState(initialDateFrom)
  const [dateTo, setDateTo] = useState(initialDateTo)

  const safeColumns = Array.isArray(columns) ? columns : []
  const safeRows = Array.isArray(rows) ? rows : []

  const search = manualPagination ? (controlledSearch ?? '') : searchState
  const pageSize = manualPagination ? (controlledPageSize ?? initialPageSize) : pageSizeState
  const page = manualPagination ? (controlledPage ?? initialPage) : pageState

  const filteredRows = useMemo(() => {
    if (manualPagination) return safeRows
    const q = search.trim().toLowerCase()
    if (!q) return safeRows
    return safeRows.filter((r) => JSON.stringify(r).toLowerCase().includes(q))
  }, [manualPagination, safeRows, search])

  const total = manualPagination ? Number(controlledTotal ?? filteredRows.length) : filteredRows.length
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const startIdx = (safePage - 1) * pageSize
  const endIdx = Math.min(total, startIdx + pageSize)
  const pagedRows = manualPagination ? filteredRows : filteredRows.slice(startIdx, endIdx)

  const getRowIdFn = rowSelection?.getRowId
  const getSelectId = useCallback(
    (r) => (getRowIdFn ? getRowIdFn(r) : Number(r?.id)),
    [getRowIdFn],
  )
  const selectedSet = useMemo(() => new Set(rowSelection?.selectedIds ?? []), [rowSelection?.selectedIds])
  const pageIds = useMemo(() => pagedRows.map((r) => getSelectId(r)).filter((id) => Number.isFinite(id)), [pagedRows, getSelectId])
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedSet.has(id))
  const somePageSelected = pageIds.some((id) => selectedSet.has(id))

  const toggleSelectAllOnPage = () => {
    if (!rowSelection) return
    const next = new Set(rowSelection.selectedIds)
    if (allPageSelected) {
      for (const id of pageIds) next.delete(id)
    } else {
      for (const id of pageIds) next.add(id)
    }
    rowSelection.onChange([...next])
  }

  const toggleRowSelected = (row) => {
    if (!rowSelection) return
    const id = getSelectId(row)
    if (!Number.isFinite(id)) return
    const next = new Set(rowSelection.selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    rowSelection.onChange([...next])
  }

  const colCount = safeColumns.length + (rowSelection ? 1 : 0)

  const setPage = (nextPage) => {
    if (manualPagination) onPageChange?.(nextPage)
    else setPageState(nextPage)
  }

  const setSearch = (value) => {
    if (manualPagination) {
      onSearchChange?.(value)
      onPageChange?.(1)
    } else {
      setSearchState(value)
      onSearchChange?.(value)
      setPageState(1)
    }
  }

  const setDateFromValue = (value) => {
    setDateFrom(value)
    onDateRangeChange?.({ from: value, to: dateTo })
    setPage(1)
  }

  const setDateToValue = (value) => {
    setDateTo(value)
    onDateRangeChange?.({ from: dateFrom, to: value })
    setPage(1)
  }

  return (
    <section className={`w-full ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="text-sm text-slate-600">Show</div>
          <select
            value={pageSize}
            onChange={(e) => {
              const next = Number(e.target.value)
              if (manualPagination) {
                onPageSizeChange?.(next)
                onPageChange?.(1)
              } else {
                setPageSizeState(next)
                setPageState(1)
              }
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          {typeof renderFilters === 'function'
            ? renderFilters({
                manualPagination,
                search,
                setSearch,
                page: safePage,
                setPage,
                dateFrom,
                dateTo,
                setDateFrom: setDateFromValue,
                setDateTo: setDateToValue,
              })
            : null}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFromValue(e.target.value)
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
            aria-label="From date"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateToValue(e.target.value)
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
            }}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto border-y border-slate-200 bg-white">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm leading-snug">
          <thead className="bg-slate-50">
            <tr>
              {rowSelection ? (
                <th scope="col" className="w-10 border-b border-slate-200 px-2 py-1.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                    checked={allPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = somePageSelected && !allPageSelected
                    }}
                    onChange={toggleSelectAllOnPage}
                    aria-label="Select all rows on this page"
                    disabled={pageIds.length === 0}
                  />
                </th>
              ) : null}
              {safeColumns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`whitespace-nowrap border-b border-slate-200 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 ${
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
                <td colSpan={Math.max(1, colCount)} className="px-3 py-8 text-center text-slate-500">
                  {emptyText}
                </td>
              </tr>
            ) : (
              pagedRows.map((row, idx) => (
                <tr key={String(getRowKey?.(row, startIdx + idx) ?? startIdx + idx)} className="hover:bg-slate-50/50">
                  {rowSelection ? (
                    <td className="border-b border-slate-100 px-2 py-1.5">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                        checked={selectedSet.has(getSelectId(row))}
                        onChange={() => toggleRowSelected(row)}
                        aria-label={`Select row ${getSelectId(row)}`}
                      />
                    </td>
                  ) : null}
                  {safeColumns.map((c) => (
                    <td
                      key={c.key}
                      className={`whitespace-nowrap border-b border-slate-100 px-2 py-1.5 text-slate-700 ${
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
          {typeof renderTableFooterCells === 'function' ? (
            <tfoot className="bg-slate-50">
              <tr>
                {rowSelection ? (
                  <td className="border-t border-slate-200 px-2 py-2" aria-hidden="true" />
                ) : null}
                {renderTableFooterCells()}
              </tr>
            </tfoot>
          ) : null}
        </table>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2">
          <div className="text-sm text-slate-600">
            {total === 0 ? '0 items' : `${startIdx + 1}-${endIdx} of ${total}`}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => (manualPagination ? onPageChange?.(Math.max(1, safePage - 1)) : setPageState((p) => Math.max(1, p - 1)))}
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
              onClick={() =>
                manualPagination ? onPageChange?.(Math.min(totalPages, safePage + 1)) : setPageState((p) => Math.min(totalPages, p + 1))
              }
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

