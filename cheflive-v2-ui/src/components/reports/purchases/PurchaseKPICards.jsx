import {
  formatQtyWithUnit,
  formatReportCurrency,
  formatReportCurrencyCompact,
  formatReportDateShort,
  formatReportPercent,
  splitQtyUnit,
} from '../../../pages/report/purchaseReportUtils.js'
import { KpiCardShell, KpiMetricRow, ReportNum } from './reportUi.jsx'

function formatRatePurchaseLine(rate, unit, qty, date) {
  if (rate == null || !Number.isFinite(Number(rate))) return null
  const u = unit ? String(unit).trim() : 'unit'
  const chunks = [`${formatReportCurrency(rate)}/${u}`]
  if (qty != null) chunks.push(formatQtyWithUnit(qty, u))
  if (date) chunks.push(formatReportDateShort(date))
  return chunks.join(' · ')
}

function QtyMetric({ qty, unit, suffix = '' }) {
  const parts = splitQtyUnit(qty, unit)
  return (
    <KpiMetricRow type="quantity">
      <ReportNum>
        {parts.qty}
        {parts.unit ? <span className="ml-1 font-sans text-[11px] font-semibold uppercase text-slate-500">{parts.unit}</span> : null}
      </ReportNum>
      {suffix ? <span className="font-sans text-slate-600"> {suffix}</span> : null}
    </KpiMetricRow>
  )
}

function SpendMetric({ amount, suffix = '' }) {
  return (
    <KpiMetricRow type="spend">
      <ReportNum className="text-[15px] font-semibold">{amount}</ReportNum>
      {suffix ? <span className="font-sans font-normal text-rose-800/80"> {suffix}</span> : null}
    </KpiMetricRow>
  )
}

/**
 * @param {{ kpis: Record<string, unknown> | null }} props
 */
export function PurchaseKPICards({ kpis }) {
  if (!kpis) return null

  const topSpend = kpis.highest_spend_ingredient
  const mostFreq = kpis.most_frequently_purchased_ingredient
  const mostVolatile = kpis.most_volatile_ingredient
  const top5Pct = kpis.top_5_spend_contribution_percentage

  const cards = []

  cards.push(
    <KpiCardShell
      key="total"
      accentKey="total"
      label="Total purchase"
      headline="Period spend"
      hoverTitle={formatReportCurrency(kpis.total_purchase_amount)}
      primaryMetric={
        <SpendMetric amount={formatReportCurrencyCompact(kpis.total_purchase_amount)} />
      }
      metrics={
        <>
          <KpiMetricRow type="meta">
            <ReportNum>{kpis.total_purchase_entries ?? 0}</ReportNum>
            <span className="font-sans"> purchase bills</span>
          </KpiMetricRow>
          <KpiMetricRow type="meta">
            <ReportNum>{kpis.total_unique_ingredients ?? 0}</ReportNum>
            <span className="font-sans"> unique ingredients</span>
          </KpiMetricRow>
        </>
      }
    />,
  )

  if (topSpend) {
    cards.push(
      <KpiCardShell
        key="top-spend"
        accentKey="topSpend"
        label="Highest spend"
        headline={topSpend.ingredient_name}
        hoverTitle={[
          topSpend.ingredient_name,
          `${formatReportCurrency(topSpend.total_spend)} spent`,
          `${formatQtyWithUnit(topSpend.total_quantity, topSpend.unit)} purchased`,
          `${formatReportPercent(topSpend.spend_percentage)} of total spend`,
        ].join('\n')}
        metrics={
          <>
            <SpendMetric amount={formatReportCurrencyCompact(topSpend.total_spend)} suffix="spent" />
            <QtyMetric qty={topSpend.total_quantity} unit={topSpend.unit} suffix="purchased" />
            <KpiMetricRow type="percent">
              <ReportNum>{formatReportPercent(topSpend.spend_percentage)}</ReportNum>
              <span className="font-sans"> of total spend</span>
            </KpiMetricRow>
          </>
        }
      />,
    )
  }

  if (mostFreq) {
    cards.push(
      <KpiCardShell
        key="most-freq"
        accentKey="mostFreq"
        label="Most purchased"
        headline={mostFreq.ingredient_name}
        hoverTitle={[
          mostFreq.ingredient_name,
          `Purchased ${mostFreq.purchase_frequency ?? 0} times`,
          `${formatQtyWithUnit(mostFreq.total_quantity, mostFreq.unit)} total`,
          `${formatReportCurrency(mostFreq.total_spend)} total spend`,
          Number.isFinite(mostFreq.purchase_frequency_days_avg)
            ? `Every ${Number(mostFreq.purchase_frequency_days_avg).toFixed(1)} days avg`
            : '',
        ]
          .filter(Boolean)
          .join('\n')}
        primaryMetric={
          <KpiMetricRow type="meta">
            {(mostFreq.purchase_frequency ?? 0) === 1 ? (
              <span className="font-sans font-medium text-slate-800">Purchased once</span>
            ) : (
              <>
                <span className="font-sans font-medium text-slate-800">Purchased </span>
                <ReportNum className="text-base font-semibold text-slate-900">
                  {mostFreq.purchase_frequency ?? 0}
                </ReportNum>
                <span className="font-sans font-medium text-slate-800"> times</span>
              </>
            )}
          </KpiMetricRow>
        }
        metrics={
          <>
            <QtyMetric qty={mostFreq.total_quantity} unit={mostFreq.unit} suffix="total qty" />
            <SpendMetric amount={formatReportCurrency(mostFreq.total_spend)} suffix="total spend" />
            {Number.isFinite(mostFreq.purchase_frequency_days_avg) ? (
              <KpiMetricRow type="date">
                Every <ReportNum>~{Number(mostFreq.purchase_frequency_days_avg).toFixed(1)}</ReportNum> days (avg)
              </KpiMetricRow>
            ) : null}
          </>
        }
      />,
    )
  }

  if (mostVolatile) {
    const highLine = formatRatePurchaseLine(
      mostVolatile.highest_rate,
      mostVolatile.highest_rate_unit,
      mostVolatile.highest_rate_qty,
      mostVolatile.highest_rate_date,
    )
    const lowLine = formatRatePurchaseLine(
      mostVolatile.lowest_rate,
      mostVolatile.lowest_rate_unit,
      mostVolatile.lowest_rate_qty,
      mostVolatile.lowest_rate_date,
    )
    cards.push(
      <KpiCardShell
        key="volatile"
        accentKey="volatile"
        label="Most volatile"
        headline={mostVolatile.ingredient_name}
        hoverTitle={[
          mostVolatile.ingredient_name,
          highLine ? `High: ${highLine}` : '',
          lowLine ? `Low: ${lowLine}` : '',
          Number.isFinite(mostVolatile.rate_spread)
            ? `Spread: ${formatReportCurrency(mostVolatile.rate_spread)}`
            : '',
        ]
          .filter(Boolean)
          .join('\n')}
        metrics={
          <>
            {highLine ? (
              <KpiMetricRow type="rate" sub={<span className="font-sans">High purchase</span>}>
                <ReportNum>{highLine}</ReportNum>
              </KpiMetricRow>
            ) : null}
            {lowLine ? (
              <KpiMetricRow type="rate" sub={<span className="font-sans">Low purchase</span>}>
                <ReportNum>{lowLine}</ReportNum>
              </KpiMetricRow>
            ) : null}
            {Number.isFinite(mostVolatile.rate_spread) ? (
              <SpendMetric amount={formatReportCurrency(mostVolatile.rate_spread)} suffix="rate spread" />
            ) : null}
          </>
        }
      />,
    )
  }

  if (Number.isFinite(top5Pct)) {
    cards.push(
      <KpiCardShell
        key="top5"
        accentKey="top5"
        label="Top 5 share"
        headline="Spend concentration"
        primaryMetric={
          <KpiMetricRow type="percent">
            <ReportNum className="text-lg font-bold text-rose-900">{formatReportPercent(top5Pct)}</ReportNum>
          </KpiMetricRow>
        }
        metrics={
          <KpiMetricRow type="meta">Combined spend of top 5 ingredients · see pie chart</KpiMetricRow>
        }
      />,
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards}
    </div>
  )
}
