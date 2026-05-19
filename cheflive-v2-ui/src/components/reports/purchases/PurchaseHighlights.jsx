import { Lightbulb } from 'lucide-react'

/**
 * @param {{ highlights: string[] }} props
 */
export function PurchaseHighlights({ highlights }) {
  const items = Array.isArray(highlights) ? highlights.filter(Boolean) : []
  if (!items.length) return null

  return (
    <div className='my-14'>
      <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-[#922b21]/90">Operational highlights</h3>
      <ul className="space-y-3 rounded-xl border border-[#f0dbd9] bg-[#fdf2f1]/50 p-4">
        {items.map((text) => (
          <li key={text} className="my-4 flex gap-3 border-b border-[#f0dbd9] pb-3 last:border-0 last:pb-0">
            <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" strokeWidth={2} />
            <p className="text-[16px] font-semibold leading-relaxed text-[#1c0f0e]">{text}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
