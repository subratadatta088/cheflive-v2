import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import {
  formatQtyWithUnit,
  formatReportCurrencyCompact,
  formatReportPercent,
} from '../../../pages/report/purchaseReportUtils.js'
import { REPORT_CHART_HEIGHT_PX, REPORT_THEME, ReportChartEmpty, ReportNum } from './reportUi.jsx'

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null

  return (
    <div className="rounded-lg border border-[#f0dbd9] bg-white px-3 py-2.5 text-xs text-[#1c0f0e] shadow-md">
      <p className="font-semibold text-[#922b21]">{row.name}</p>
      <p className="mt-1.5">
        <ReportNum className="text-sm font-semibold text-rose-900">
          {formatReportCurrencyCompact(row.value)}
        </ReportNum>
      </p>
      <p className="mt-1 text-stone-600">{formatQtyWithUnit(row.total_quantity, row.unit)}</p>
      <p className="mt-0.5">
        <ReportNum className="font-semibold text-rose-800">{formatReportPercent(row.percentage)}</ReportNum>
        <span className="text-stone-500"> of spend</span>
      </p>
    </div>
  )
}

/**
 * @param {{ distribution: Array<{ ingredient_name: string, total_spend: number, total_quantity?: number, unit?: string, percentage: number }> }} props
 */
export function PurchaseSpendPieChart({ distribution }) {
  const data = Array.isArray(distribution)
    ? distribution.map((row) => ({
        name: row.ingredient_name,
        value: Number(row.total_spend) || 0,
        total_quantity: row.total_quantity,
        unit: row.unit,
        percentage: row.percentage,
      }))
    : []

  if (!data.length) {
    return <ReportChartEmpty message="No spend distribution data." />
  }

  const colors = REPORT_THEME.pie
  const pieHeight = Math.min(REPORT_CHART_HEIGHT_PX, 260)

  return (
    <div className="flex w-full min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
      <div className="w-full min-w-0 shrink-0 sm:w-[42%]" style={{ height: pieHeight }}>
        <ResponsiveContainer width="100%" height={pieHeight} debounce={50} minWidth={0}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius="88%"
              innerRadius="38%"
              paddingAngle={2}
              stroke="#ffffff"
              strokeWidth={2}
              label={false}
            >
              {data.map((_, idx) => (
                <Cell key={idx} fill={colors[idx % colors.length]} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="min-w-0 flex-1 space-y-2.5 sm:max-h-[288px] sm:overflow-y-auto sm:pr-1">
        {data.map((row, idx) => (
          <li key={`${row.name}-${idx}`} className="flex items-start gap-2.5 text-sm leading-snug">
            <span
              className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: colors[idx % colors.length] }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 break-words">
              <span className="font-medium text-[#1c0f0e]">{row.name}</span>
              <span className="mt-0.5 block text-[#7a4f4a]">
                <ReportNum className="font-semibold text-rose-900">
                  {formatReportPercent(row.percentage)}
                </ReportNum>
                <span className="mx-1.5 text-[#f0dbd9]">·</span>
                <ReportNum>{formatReportCurrencyCompact(row.value)}</ReportNum>
                {row.total_quantity != null && Number.isFinite(Number(row.total_quantity)) ? (
                  <>
                    <span className="mx-1.5 text-[#f0dbd9]">·</span>
                    <ReportNum>{formatQtyWithUnit(row.total_quantity, row.unit)}</ReportNum>
                  </>
                ) : null}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
