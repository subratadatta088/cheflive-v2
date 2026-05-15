import { PackagePlus } from 'lucide-react'
import { Button } from '../../../components/Button.jsx'
import { usePurchaseLowStock } from './usePurchaseLowStock.js'

/**
 * @param {{
 *   disabled?: boolean,
 *   setRows: (updater: (prev: unknown[]) => unknown[]) => void,
 *   onRowsAppended?: (rows: Array<{ id: string, ingredient_id: string }>) => void,
 *   onSuccess?: (count: number) => void,
 *   onError?: (message: string) => void,
 * }} props
 */
export function PurchaseLowStockButton({ disabled, setRows, onRowsAppended, onSuccess, onError }) {
  const { loading, appendLowStockRows } = usePurchaseLowStock({ setRows, onRowsAppended })

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={disabled || loading}
      onClick={async () => {
        const result = await appendLowStockRows()
        if (result?.error) {
          onError?.(result.error)
          return
        }
        if (result.added === 0) {
          onError?.('No new low-stock items to add (duplicates skipped or list empty).')
          return
        }
        onSuccess?.(result.added)
      }}
    >
      <PackagePlus className="h-4 w-4 shrink-0" aria-hidden="true" />
      {loading ? 'Loading…' : 'Add low stock items'}
    </Button>
  )
}
