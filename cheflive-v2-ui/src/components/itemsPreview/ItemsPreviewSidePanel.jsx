import { SplitDetailPanel } from '../SplitDetailPanel.jsx'
import { formatMoney } from '../../utils/formatters.js'

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   title: import('react').ReactNode,
 *   loading?: boolean,
 *   loadingMessage?: string,
 *   summaryFields?: Array<{ label: string, value: import('react').ReactNode }>,
 *   missingIds?: number[],
 *   entityLabel?: string,
 *   children?: import('react').ReactNode,
 * }} props
 */
export function ItemsPreviewSidePanel({
  open,
  onClose,
  title,
  loading = false,
  loadingMessage = 'Loading items…',
  summaryFields = [],
  missingIds = [],
  entityLabel = 'record',
  children,
}) {
  return (
    <SplitDetailPanel open={open} onClose={onClose} title={title}>
      {loading ? (
        <p className="text-sm text-slate-600">{loadingMessage}</p>
      ) : (
        <div className="space-y-4">
          {summaryFields.length > 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm">
              <div
                className={`grid grid-cols-1 gap-4 sm:divide-x sm:divide-slate-200 ${
                  summaryFields.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'
                }`}
              >
                {summaryFields.map((field, idx) => (
                  <div
                    key={field.label}
                    className={`min-w-0 ${idx === 0 ? 'sm:pe-4' : idx === summaryFields.length - 1 ? 'sm:ps-4' : 'sm:px-4'}`}
                  >
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{field.label}</div>
                    <div className="mt-0.5 font-medium tabular-nums text-slate-900">{field.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {missingIds.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {missingIds.length === 1
                ? `1 selected ${entityLabel} could not be loaded (#${missingIds[0]}).`
                : `${missingIds.length} selected ${entityLabel}s could not be loaded: ${missingIds.map((id) => `#${id}`).join(', ')}.`}
            </div>
          ) : null}

          {children}
        </div>
      )}
    </SplitDetailPanel>
  )
}

/** Format a money summary field value. */
export function moneySummaryValue(n) {
  return formatMoney(Number.isFinite(Number(n)) ? Number(n) : 0)
}
