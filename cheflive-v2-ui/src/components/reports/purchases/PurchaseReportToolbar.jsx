import { Download, Mail, Printer } from 'lucide-react'
import { Button } from '../../Button.jsx'

export function PurchaseReportToolbar() {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="secondary">
        <Download className="h-4 w-4 shrink-0" aria-hidden />
        Download report
      </Button>
      <Button type="button" variant="secondary">
        <Mail className="h-4 w-4 shrink-0" aria-hidden />
        Send report
      </Button>
      <Button type="button" variant="secondary">
        <Printer className="h-4 w-4 shrink-0" aria-hidden />
        Print report
      </Button>
    </div>
  )
}
