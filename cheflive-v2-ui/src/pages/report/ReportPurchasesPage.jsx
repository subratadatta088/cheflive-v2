import { useCallback, useState } from 'react'
import { postPurchaseAnalytics, postPurchaseTimeline } from '../../apis/reportPurchase.js'
import { Breadcrumb } from '../../components/Breadcrumb.jsx'
import { PurchaseAnalyticsTable } from '../../components/reports/purchases/PurchaseAnalyticsTable.jsx'
import { PurchaseDateFilter } from '../../components/reports/purchases/PurchaseDateFilter.jsx'
import { PurchaseReportHeader } from '../../components/reports/purchases/PurchaseReportHeader.jsx'
import { PurchaseHighlights } from '../../components/reports/purchases/PurchaseHighlights.jsx'
import { PurchaseKPICards } from '../../components/reports/purchases/PurchaseKPICards.jsx'
import { PurchaseSpendPieChart } from '../../components/reports/purchases/PurchaseSpendPieChart.jsx'
import { PurchaseTimelineChart } from '../../components/reports/purchases/PurchaseTimelineChart.jsx'
import { ReportSection, ReportSectionTitle } from '../../components/reports/purchases/reportUi.jsx'
import {
  defaultReportDateRange,
  validateReportDateRange,
} from './purchaseReportUtils.js'

export function ReportPurchasesPage() {
  const defaults = defaultReportDateRange()
  const [fromDate, setFromDate] = useState(defaults.from_date)
  const [toDate, setToDate] = useState(defaults.to_date)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [analytics, setAnalytics] = useState(null)
  const [timeline, setTimeline] = useState(null)
  const [generated, setGenerated] = useState(false)

  const handleGenerate = useCallback(async () => {
    const validation = validateReportDateRange(fromDate, toDate)
    if (!validation.ok) {
      setError(validation.error)
      return
    }

    setError('')
    setLoading(true)
    try {
      const body = { from_date: fromDate, to_date: toDate }
      const [analyticsData, timelineData] = await Promise.all([
        postPurchaseAnalytics(body),
        postPurchaseTimeline(body),
      ])
      setAnalytics(analyticsData)
      setTimeline(timelineData)
      setGenerated(true)
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        e?.message ||
        'Failed to load purchase report. Please try again.'
      setError(String(msg))
      setAnalytics(null)
      setTimeline(null)
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate])

  const timelineItems = timeline?.items ?? []
  const topSpend = analytics?.charts?.top_spend_distribution ?? []

  return (
    <section className="py-4">
      <Breadcrumb items={[{ label: 'Report' }, { label: 'Purchase report' }]} />

      <ReportSection className="!my-6">
        <PurchaseDateFilter
          fromDate={fromDate}
          toDate={toDate}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
          onGenerate={handleGenerate}
          loading={loading}
          error={error}
        />
      </ReportSection>

      {generated && !loading ? (
        <>
          <ReportSection className="!mt-2">
            <PurchaseReportHeader fromDate={fromDate} toDate={toDate} />
          </ReportSection>

          <ReportSection>
            <PurchaseKPICards kpis={analytics?.kpis ?? null} />
          </ReportSection>

          <ReportSection>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="min-w-0 p-8 border border-slate-200 rounded-xl">
                <ReportSectionTitle>Daily purchase spend</ReportSectionTitle>
                <PurchaseTimelineChart items={timelineItems} />
              </div>
              <div className="min-w-0 p-8 border border-slate-200 rounded-xl">
                <ReportSectionTitle>Top spend distribution</ReportSectionTitle>
                <PurchaseSpendPieChart distribution={topSpend} />
              </div>
            </div>
          </ReportSection>

          <ReportSection>
            <PurchaseHighlights highlights={analytics?.highlights ?? []} />
          </ReportSection>

          <ReportSection>
            <PurchaseAnalyticsTable
              rows={analytics?.table ?? []}
              fromDate={fromDate}
              toDate={toDate}
            />
          </ReportSection>
        </>
      ) : !loading && !error ? (
        <ReportSection>
          <p className="text-center text-sm text-[#7a4f4a]">
            Select a date range and click Generate Report to view purchase analytics.
          </p>
        </ReportSection>
      ) : null}
    </section>
  )
}
