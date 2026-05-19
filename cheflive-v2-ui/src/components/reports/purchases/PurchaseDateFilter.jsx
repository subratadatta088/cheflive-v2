import { BarChart3, Loader2 } from 'lucide-react'
import { Button } from '../../Button.jsx'

const DATE_INPUT_CLASS =
  'h-9 w-full min-w-[10.5rem] rounded-lg border border-[#f0dbd9] bg-white px-3 text-sm text-[#1c0f0e] ' +
  'focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100'

/**
 * @param {{
 *   fromDate: string,
 *   toDate: string,
 *   onFromDateChange: (v: string) => void,
 *   onToDateChange: (v: string) => void,
 *   onGenerate: () => void,
 *   loading?: boolean,
 *   error?: string,
 * }} props
 */
export function PurchaseDateFilter({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onGenerate,
  loading = false,
  error = '',
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[#7a4f4a]">From date</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => onFromDateChange(e.target.value)}
            className={DATE_INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[#7a4f4a]">To date</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => onToDateChange(e.target.value)}
            className={DATE_INPUT_CLASS}
          />
        </label>
        <Button
          type="button"
          variant="dark"
          className="shrink-0 px-4 py-2"
          onClick={onGenerate}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <BarChart3 className="h-4 w-4 shrink-0" aria-hidden />
          )}
          {loading ? 'Generating…' : 'Generate report'}
        </Button>
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
