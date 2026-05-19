import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  formatReportCurrency,
  formatReportDateShort,
} from '../../../pages/report/purchaseReportUtils.js'
import {
  REPORT_CHART_HEIGHT_PX,
  REPORT_THEME,
  ReportChartEmpty,
  ReportChartShell,
} from './reportUi.jsx'

const TIMELINE_CHART_HEIGHT_PX = Math.round(REPORT_CHART_HEIGHT_PX)

function formatTimelineAxisTick(label) {
  const s = String(label ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return s || '—'
  const d = new Date(`${s.slice(0, 10)}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/**
 * @param {{ items: Array<{ date: string, total_purchase_amount: number }> }} props
 */
export function PurchaseTimelineChart({ items }) {
  const data = Array.isArray(items)
    ? items.map((row) => ({
        label: row.date,
        amount: Number(row.total_purchase_amount) || 0,
      }))
    : []

  if (!data.length) {
    return <ReportChartEmpty message="No timeline data for this range." />
  }

  const dense = data.length > 6
  const xAngle = dense ? -32 : data.length > 3 ? -18 : 0
  const bottomMargin = xAngle ? 56 : 20

  return (
    <ReportChartShell >
      <LineChart
        data={data}
        margin={{ top: 12, right: 16, left: 4, bottom: bottomMargin }}
      >
        <CartesianGrid stroke={REPORT_THEME.grid} vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: REPORT_THEME.border }}
          tick={{ fontSize: 11, fill: REPORT_THEME.muted }}
          tickFormatter={formatTimelineAxisTick}
          angle={xAngle}
          textAnchor={xAngle ? 'end' : 'middle'}
          height={xAngle ? 64 : 36}
          interval={dense ? Math.ceil(data.length / 8) - 1 : 0}
          minTickGap={12}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={64}
          tick={{ fontSize: 11, fill: REPORT_THEME.muted }}
          tickFormatter={(v) => formatReportCurrency(Number(v))}
        />
        <Tooltip
          cursor={{ stroke: REPORT_THEME.lineMuted, strokeWidth: 1, strokeDasharray: '4 4' }}
          contentStyle={{
            borderRadius: 10,
            borderColor: REPORT_THEME.border,
            backgroundColor: '#ffffff',
            fontSize: 12,
            color: '#1c0f0e',
          }}
          formatter={(value) => [formatReportCurrency(Number(value)), 'Spend']}
          labelFormatter={(label) => formatReportDateShort(label)}
          labelStyle={{ color: REPORT_THEME.muted, fontWeight: 600 }}
        />
        <Line
          type="monotone"
          dataKey="amount"
          stroke={REPORT_THEME.line}
          strokeWidth={2.5}
          dot={{
            r: 4,
            fill: '#ffffff',
            stroke: REPORT_THEME.primary,
            strokeWidth: 2,
          }}
          activeDot={{
            r: 6,
            fill: REPORT_THEME.primary,
            stroke: '#ffffff',
            strokeWidth: 2,
          }}
        />
      </LineChart>
    </ReportChartShell>
  )
}
