import {
  BarChart3,
  Calendar,
  IndianRupee,
  Package,
  PieChart,
  ShoppingCart,
  TrendingUpDown,
  Wallet,
} from 'lucide-react'
import { ResponsiveContainer } from 'recharts'

/** Fixed chart height (px) for Recharts — no padded frame, full area for plot. */
export const REPORT_CHART_HEIGHT_PX = 288

/** Wrap numeric / currency values in Roboto. */
export function ReportNum({ children, className = '' }) {
  return <span className={`font-numeric ${className}`.trim()}>{children}</span>
}

export function ReportSection({ children, className = '' }) {
  return <section className={`my-10 ${className}`.trim()}>{children}</section>
}

/** Burgundy / rose palette aligned with purchase report email theme */
export const REPORT_THEME = {
  primary: '#922b21',
  accent: '#c0392b',
  muted: '#7a4f4a',
  border: '#f0dbd9',
  surface: '#fdf2f1',
  grid: '#f5e8e6',
  line: '#c0392b',
  lineMuted: '#d4a5a0',
  pie: ['#d4a5a0', '#ddb8b4', '#e5cbc7', '#ecd9d6', '#f2e4e1', '#f8eeec'],
}

export function ReportSectionTitle({ children }) {
  return (
    <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-[#922b21]/90">{children}</h3>
  )
}

/** Measurable bounds for Recharts (avoids width/height -1 in grid layouts). */
export function ReportChartShell({ children, className = '', height = REPORT_CHART_HEIGHT_PX }) {
  return (
    <div className={`w-full min-w-0 ${className}`.trim()} style={{ height }}>
      <div className="min-w-0" style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height={height} debounce={50} minWidth={0}>
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function ReportChartEmpty({ message }) {
  return (
    <div
      className="flex w-full min-w-0 items-center justify-center px-2 text-center text-sm text-[#7a4f4a]"
      style={{ height: REPORT_CHART_HEIGHT_PX }}
    >
      {message}
    </div>
  )
}

const METRIC_ICONS = {
  spend: IndianRupee,
  quantity: Package,
  date: Calendar,
  rate: TrendingUpDown,
  percent: PieChart,
}

const METRIC_STYLES = {
  spend: {
    icon: 'text-rose-700',
    text: 'text-sm font-semibold text-rose-950',
  },
  quantity: {
    icon: 'text-rose-600/80',
    text: 'text-sm font-medium text-stone-800',
  },
  date: {
    icon: 'text-rose-400/90',
    text: 'text-xs font-medium text-stone-500',
  },
  rate: {
    icon: 'text-rose-600',
    text: 'text-xs font-medium text-stone-700',
  },
  percent: {
    icon: 'text-rose-600',
    text: 'text-xs font-medium text-rose-900',
  },
  meta: {
    icon: 'text-rose-300',
    text: 'text-xs leading-relaxed text-stone-500',
  },
}

/**
 * @param {{ type: 'spend'|'quantity'|'date'|'rate'|'percent'|'meta', children: React.ReactNode, sub?: React.ReactNode }} props
 */
export function KpiMetricRow({ type, children, sub }) {
  const style = METRIC_STYLES[type] || METRIC_STYLES.meta
  const Icon = METRIC_ICONS[type]

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-start gap-2">
        {Icon ? <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${style.icon}`} strokeWidth={2.25} /> : null}
        <div className={`min-w-0 flex-1 leading-snug ${style.text}`}>{children}</div>
      </div>
      {sub ? <div className="pl-6 text-xs leading-snug text-slate-500">{sub}</div> : null}
    </div>
  )
}

export const KPI_BG_ICONS = {
  total: BarChart3,
  topSpend: Wallet,
  mostFreq: ShoppingCart,
  volatile: TrendingUpDown,
  top5: PieChart,
}

const KPI_ACCENT = {
  total: 'from-[#fdf2f1] to-white',
  topSpend: 'from-[#faf0ee] to-white',
  mostFreq: 'from-rose-50/90 to-white',
  volatile: 'from-[#f8eeec] to-white',
  top5: 'from-red-50/80 to-white',
}

const KPI_FLOAT_COLOR = {
  total: 'text-rose-700',
  topSpend: 'text-[#922b21]',
  mostFreq: 'text-rose-600',
  volatile: 'text-rose-600/90',
  top5: 'text-rose-700',
}

/**
 * @param {{
 *   accentKey: keyof typeof KPI_BG_ICONS,
 *   label: string,
 *   headline: React.ReactNode,
 *   primaryMetric?: React.ReactNode,
 *   hoverTitle?: string,
 *   metrics: React.ReactNode,
 * }} props
 */
export function KpiCardShell({ accentKey, label, headline, primaryMetric, hoverTitle, metrics }) {
  const BgIcon = KPI_BG_ICONS[accentKey]
  const gradient = KPI_ACCENT[accentKey] || KPI_ACCENT.total
  const floatColor = KPI_FLOAT_COLOR[accentKey] || KPI_FLOAT_COLOR.total

  return (
    <div
      className={`relative min-h-[9.25rem] overflow-hidden rounded-xl bg-gradient-to-br ${gradient} border border-[#f0dbd9] px-3.5 py-3.5`}
      title={hoverTitle || undefined}
    >
      {BgIcon ? (
        <BgIcon
          className={`pointer-events-none absolute -right-0 top-10  h-[7.5rem] w-[7.5rem] opacity-[0.1] ${floatColor}`}
          strokeWidth={1.25}
        />
      ) : null}
      <div className="relative z-[1] flex h-full flex-col">
        <p className="text-[13px] font-bold uppercase tracking-[0.1em] text-[#7a4f4a]">{label}</p>
        <p className="mt-2 line-clamp-2 text-[20px] font-semibold leading-snug text-[#1c0f0e]">{headline}</p>
        {primaryMetric ? <div className="mt-2">{primaryMetric}</div> : null}
        <div className="mt-auto space-y-2.5 pt-3">{metrics}</div>
      </div>
    </div>
  )
}
