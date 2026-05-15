import { useCallback, useState } from 'react'
import { normalizeSelectedIds } from '../utils/selectionIds.js'

/**
 * @typedef {'single' | 'grouped' | 'flat'} ItemsPreviewMode
 */

/**
 * @param {{
 *   fetchGrouped: (args: { ids: number[] }) => Promise<Record<string, unknown>>,
 *   fetchFlat: (args: { ids: number[] }) => Promise<Record<string, unknown>>,
 *   onError?: (message: string) => void,
 * }} options
 */
export function useItemsPreviewPanel({ fetchGrouped, fetchFlat, onError }) {
  const [singleRecord, setSingleRecord] = useState(/** @type {Record<string, unknown> | null} */ (null))
  const [aggregateView, setAggregateView] = useState(/** @type {Record<string, unknown> | null} */ (null))
  const [aggregateLoading, setAggregateLoading] = useState(false)
  const [mode, setMode] = useState(/** @type {ItemsPreviewMode | null} */ (null))

  const close = useCallback(() => {
    setSingleRecord(null)
    setAggregateView(null)
    setAggregateLoading(false)
    setMode(null)
  }, [])

  const openSingle = useCallback((record) => {
    setAggregateView(null)
    setAggregateLoading(false)
    setMode('single')
    setSingleRecord(record)
  }, [])

  const fetchAggregate = useCallback(
    async (selectedRowIds, nextMode) => {
      const ids = normalizeSelectedIds(selectedRowIds)
      if (ids.length === 0) return

      setSingleRecord(null)
      setAggregateLoading(true)
      setMode(nextMode)
      setAggregateView(null)

      try {
        const fetcher = nextMode === 'grouped' ? fetchGrouped : fetchFlat
        const data = await fetcher({ ids })
        setAggregateView(data)
      } catch (e) {
        setAggregateView(null)
        setMode(null)
        const message =
          e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Could not load items.'
        onError?.(message)
      } finally {
        setAggregateLoading(false)
      }
    },
    [fetchGrouped, fetchFlat, onError],
  )

  const fetchGroupedView = useCallback(
    (selectedRowIds) => fetchAggregate(selectedRowIds, 'grouped'),
    [fetchAggregate],
  )

  const fetchFlatView = useCallback(
    (selectedRowIds) => fetchAggregate(selectedRowIds, 'flat'),
    [fetchAggregate],
  )

  const panelOpen = Boolean(singleRecord) || Boolean(aggregateView) || aggregateLoading

  return {
    singleRecord,
    aggregateView,
    aggregateLoading,
    mode,
    panelOpen,
    openSingle,
    fetchGroupedView,
    fetchFlatView,
    close,
  }
}
