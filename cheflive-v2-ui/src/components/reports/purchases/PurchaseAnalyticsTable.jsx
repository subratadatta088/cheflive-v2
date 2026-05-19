import { useCallback, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Info } from 'lucide-react'
import { DataTable } from '../../DataTable.jsx'
import {
  computeAvgQtyPerPurchase,
  computePurchasePaceDaysInPeriod,
  formatReportDateShort,
  formatReportMoney,
  formatReportPercent,
  formatReportRangeDaysPhrase,
  formatQtyWithUnit,
  getReportDateRangeDayCount,
  splitQtyUnit,
} from '../../../pages/report/purchaseReportUtils.js'
import { ReportNum, ReportSectionTitle } from './reportUi.jsx'

function purchaseFrequencyHint(rangeDaysPhrase) {
  const period = rangeDaysPhrase
    ? `Selected report period: ${rangeDaysPhrase} (inclusive). `
    : ''
  return (
    period +
    'Times purchased: how many times you bought this ingredient in that period. ' +
    'Restock pace: selected period length ÷ times purchased (e.g. 2 times in 30 days ≈ every 15 days). ' +
    'Avg qty: total quantity in the period ÷ times purchased.'
  )
}

/** @typedef {'purchase_frequency' | 'total_spend' | 'last_purchase_date'} PurchaseTableSortKey */
/** @typedef {'asc' | 'desc'} SortDirection */

function parseSortableDate(value) {
  const s = String(value ?? '').trim()
  if (!s) return null
  const iso = /^\d{4}-\d{2}-\d{2}/.test(s) ? `${s.slice(0, 10)}T00:00:00.000Z` : s
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : t
}

/**
 * @param {Record<string, unknown>} a
 * @param {Record<string, unknown>} b
 * @param {PurchaseTableSortKey} key
 * @param {SortDirection} dir
 */
function comparePurchaseRows(a, b, key, dir, rangeDays) {
  const mul = dir === 'asc' ? 1 : -1

  if (key === 'purchase_frequency') {
    const diff = (Number(a.purchase_frequency) || 0) - (Number(b.purchase_frequency) || 0)
    if (diff !== 0) return mul * diff
    const paceA = computePurchasePaceDaysInPeriod(rangeDays, a.purchase_frequency) ?? 0
    const paceB = computePurchasePaceDaysInPeriod(rangeDays, b.purchase_frequency) ?? 0
    if (paceA !== paceB) return mul * (paceA - paceB)
    return String(a.ingredient_name ?? '').localeCompare(String(b.ingredient_name ?? ''))
  }

  if (key === 'total_spend') {
    const diff = (Number(a.total_spend) || 0) - (Number(b.total_spend) || 0)
    if (diff !== 0) return mul * diff
    return String(a.ingredient_name ?? '').localeCompare(String(b.ingredient_name ?? ''))
  }

  const da = parseSortableDate(a.last_purchase_date)
  const db = parseSortableDate(b.last_purchase_date)
  if (da == null && db == null) {
    return String(a.ingredient_name ?? '').localeCompare(String(b.ingredient_name ?? ''))
  }
  if (da == null) return 1
  if (db == null) return -1
  if (da !== db) return mul * (da - db)
  return String(a.ingredient_name ?? '').localeCompare(String(b.ingredient_name ?? ''))
}

/**
 * @param {{
 *   label: React.ReactNode,
 *   columnKey: PurchaseTableSortKey,
 *   activeKey: PurchaseTableSortKey,
 *   direction: SortDirection,
 *   onSort: (key: PurchaseTableSortKey) => void,
 * }} props
 */
function SortableColumnHeader({ label, columnKey, activeKey, direction, onSort }) {
  const active = activeKey === columnKey
  const SortIcon = active ? (direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown

  return (
    <button
      type="button"
      onClick={() => onSort(columnKey)}
      className={`inline-flex items-center gap-1 rounded-md px-0.5 py-0.5 text-left transition-colors ${
        active ? 'text-[#922b21]' : 'text-slate-600 hover:text-slate-900'
      }`}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span>{label}</span>
      <SortIcon
        className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-[#922b21]' : 'text-slate-400'}`}
        strokeWidth={2.25}
        aria-hidden
      />
    </button>
  )
}

/**
 * @param {{ row: Record<string, unknown>, rangeDays: number | null }} props
 */
function PurchaseFrequencyCell({ row, rangeDays }) {
  const count = Number(row.purchase_frequency) || 0
  const paceDays = computePurchasePaceDaysInPeriod(rangeDays, count)
  const avgQty = computeAvgQtyPerPurchase(row.total_quantity, count)
  const unit = row.unit != null ? String(row.unit).trim() : ''

  if (count === 0) {
    return (
      <div className="max-w-[12rem] text-sm leading-snug text-slate-500">Not purchased in this period</div>
    )
  }

  const avgQtyLabel =
    avgQty != null && Number.isFinite(avgQty) ? formatQtyWithUnit(avgQty, unit) : null

  return (
    <div className="max-w-[12rem] leading-snug">
      <p className="text-md font-semibold text-red-800">
        {count === 1 ? (
          'Once'
        ) : (
          <>
            <ReportNum className="font-semibold">{count}</ReportNum> times
          </>
        )}
      </p>
      {paceDays != null ? (
        <p className="mt-1 text-md text-slate-500">
          Every <ReportNum className="font-medium text-slate-700">~{paceDays.toFixed(1)}</ReportNum> days (in
          period)
        </p>
      ) : null}
      {avgQtyLabel ? (
        <p className="mt-1 text-md text-slate-500">
          Avg <ReportNum className="font-medium text-slate-700">{avgQtyLabel}</ReportNum> / purchase
        </p>
      ) : null}
    </div>
  )
}

/**
 * @param {{
 *   rows: Array<Record<string, unknown>>,
 *   fromDate?: string,
 *   toDate?: string,
 * }} props
 */
export function PurchaseAnalyticsTable({ rows, fromDate = '', toDate = '' }) {
  const data = Array.isArray(rows) ? rows : []
  const rangeDays = getReportDateRangeDayCount(fromDate, toDate)
  const rangeDaysPhrase = formatReportRangeDaysPhrase(rangeDays)
  const frequencyHint = purchaseFrequencyHint(rangeDaysPhrase)
  const [sortKey, setSortKey] = useState(/** @type {PurchaseTableSortKey} */ ('total_spend'))
  const [sortDir, setSortDir] = useState(/** @type {SortDirection} */ ('desc'))

  const handleSort = useCallback((key) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return prevKey
      }
      setSortDir('desc')
      return key
    })
  }, [])

  const sortedRows = useMemo(() => {
    if (!data.length) return []
    return [...data].sort((a, b) => comparePurchaseRows(a, b, sortKey, sortDir, rangeDays))
  }, [data, sortKey, sortDir, rangeDays])

  const columns = useMemo(
    () => [
      {
        key: 'ingredient_name',
        header: 'Ingredient',
        render: (r) => <span className="font-medium text-slate-900">{r.ingredient_name}</span>,
      },
      {
        key: 'total_quantity',
        header: 'Total qty',
        render: (r) => {
          const { qty, unit } = splitQtyUnit(r.total_quantity, r.unit)
          return (
            <span>
              <ReportNum>{qty}</ReportNum>
              {unit ? <span className="ml-1 text-xs font-medium uppercase text-slate-500">{unit}</span> : null}
            </span>
          )
        },
      },
      {
        key: 'total_spend',
        header: (
          <SortableColumnHeader
            label="TOTAL SPEND"
            columnKey="total_spend"
            activeKey={sortKey}
            direction={sortDir}
            onSort={handleSort}
          />
        ),
        render: (r) => <ReportNum className="font-medium">{formatReportMoney(r.total_spend)}</ReportNum>,
      },
      {
        key: 'avg_rate',
        header: 'AVG RATE',
        render: (r) => <ReportNum>{formatReportMoney(r.avg_rate)}</ReportNum>,
      },
      {
        key: 'highest_rate',
        header: 'HIGHEST',
        render: (r) => <ReportNum>{formatReportMoney(r.highest_rate)}</ReportNum>,
      },
      {
        key: 'lowest_rate',
        header: 'LOWEST',
        render: (r) => <ReportNum>{formatReportMoney(r.lowest_rate)}</ReportNum>,
      },
      {
        key: 'purchase_frequency',
        header: (
          <span className="inline-flex items-start gap-1.5 normal-case tracking-normal">
            <span className="inline-flex flex-col items-start gap-0.5">
              <SortableColumnHeader
                label="HOW OFTEN PURCHASED"
                columnKey="purchase_frequency"
                activeKey={sortKey}
                direction={sortDir}
                onSort={handleSort}
              />
              {rangeDaysPhrase ? (
                <span className="pl-0.5 text-[10px] font-medium leading-tight text-slate-500">
                  ({rangeDaysPhrase} selected)
                </span>
              ) : null}
            </span>
            <span
              className="mt-0.5 inline-flex cursor-help rounded-full text-slate-400 hover:text-[#922b21]"
              title={frequencyHint}
              aria-label={frequencyHint}
              role="img"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <Info className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
            </span>
          </span>
        ),
        className: 'min-w-[11.5rem]',
        render: (r) => <PurchaseFrequencyCell row={r} rangeDays={rangeDays} />,
      },
      {
        key: 'last_purchase_date',
        header: (
          <SortableColumnHeader
            label="LAST PURCHASED"
            columnKey="last_purchase_date"
            activeKey={sortKey}
            direction={sortDir}
            onSort={handleSort}
          />
        ),
        cellClassName: 'whitespace-normal',
        render: (r) => {
          const dateStr = r.last_purchase_date ? formatReportDateShort(r.last_purchase_date) : '—'
          const { qty, unit } = splitQtyUnit(r.last_purchase_qty, r.last_purchase_unit || r.unit)
          const hasRate =
            r.last_purchase_rate != null && Number.isFinite(Number(r.last_purchase_rate))
          return (
            <span className="text-slate-700">
              <span className="block text-sm text-slate-600">{dateStr}</span>
              {r.last_purchase_qty != null ? (
                <span className="mt-0.5 block text-sm font-medium text-slate-900">
                  <ReportNum>{qty}</ReportNum>
                  {unit ? (
                    <span className="ml-1 text-xs font-semibold uppercase text-slate-500">{unit}</span>
                  ) : null}
                  {hasRate ? (
                    <>
                      {' @ '}
                      <ReportNum>{formatReportMoney(r.last_purchase_rate)}</ReportNum>
                    </>
                  ) : null}
                </span>
              ) : null}
            </span>
          )
        },
      },
      {
        key: 'spend_percentage',
        header: 'SPEND %',
        render: (r) => (
          <ReportNum className="font-semibold text-slate-900">
            {formatReportPercent(r.spend_percentage)}
          </ReportNum>
        ),
      },
    ],
    [sortKey, sortDir, handleSort, rangeDaysPhrase, frequencyHint],
  )

  return (
    <>
      <ReportSectionTitle>Ingredient analytics</ReportSectionTitle>
      <DataTable
        key={`purchase-analytics-${sortKey}-${sortDir}`}
        columns={columns}
        rows={sortedRows}
        getRowKey={(r) => String(r.ingredient_id)}
        emptyText="No purchase data for this date range."
        initialPageSize={25}
      />
    </>
  )
}
