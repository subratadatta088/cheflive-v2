import { formatReportDateRangeLabel } from '../../../pages/report/purchaseReportUtils.js'
import { PurchaseReportToolbar } from './PurchaseReportToolbar.jsx'

/**
 * @param {{ fromDate: string, toDate: string }} props
 */
export function PurchaseReportHeader({ fromDate, toDate }) {
  const rangeLabel = formatReportDateRangeLabel(fromDate, toDate)

  return (
    <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-xl font-semibold tracking-tight text-[#1c0f0e] sm:text-2xl">
        Purchase Analytics{' '}
        {rangeLabel ? (
          <span className="font-medium text-[#7a4f4a]">{rangeLabel}</span>
        ) : null}
      </h2>
      <PurchaseReportToolbar />
    </header>
  )
}
