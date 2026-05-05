import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button.jsx'

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onUpload?: (file: File) => void,
 *   title?: string,
 *   description?: string,
 *   accept?: string,
 * }} props
 */
export function BulkUploadModal({
  open,
  onClose,
  onUpload,
  title = 'Upload CSV',
  description = 'Select a .csv file. Column format can be configured when you connect the API.',
  accept = '.csv,text/csv',
}) {
  const id = useId()
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!open) {
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose],
  )

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault()
      if (file && onUpload) onUpload(file)
      onClose()
    },
    [file, onUpload, onClose],
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        className="max-h-[90vh] w-full max-w-md overflow-hidden rounded-xl bg-white shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 id={`${id}-title`} className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          <p id={`${id}-desc`} className="text-sm text-slate-600">
            {description}
          </p>

          <label className="mt-4 block">
            <span className="sr-only">CSV file</span>
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border file:border-slate-200 file:bg-slate-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-100"
              onChange={(e) => {
                const f = e.target.files?.[0]
                setFile(f ?? null)
              }}
            />
          </label>

          {file ? (
            <p className="mt-2 text-sm text-slate-600">
              Selected: <span className="font-medium text-slate-900">{file.name}</span>
            </p>
          ) : null}

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={!file}>
              Upload
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
