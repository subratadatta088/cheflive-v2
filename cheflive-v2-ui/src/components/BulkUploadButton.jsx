import { useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from './Button.jsx'
import { BulkUploadModal } from './BulkUploadModal.jsx'

/**
 * @param {{
 *   onUpload?: (file: File) => void,
 *   className?: string,
 *   variant?: 'primary' | 'secondary' | 'warning' | 'danger',
 * }} props
 */
export function BulkUploadButton({ onUpload, className = '', variant = 'secondary' }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" variant={variant} className={className} onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" aria-hidden="true" />
        Upload CSV
      </Button>
      <BulkUploadModal
        open={open}
        onClose={() => setOpen(false)}
        onUpload={onUpload}
        title="Upload ingredients (CSV)"
        description="Choose a CSV file. Expected columns can be mapped after API integration."
      />
    </>
  )
}
