import React from 'react'
import { ChevronRight } from 'lucide-react'

/**
 * @typedef {{ label: string, href?: string, onClick?: (e: React.MouseEvent) => void }} BreadcrumbItem
 *
 * @param {{
 *   items: BreadcrumbItem[],
 *   className?: string,
 *   separator?: React.ReactNode,
 *   ariaLabel?: string
 * }} props
 */
export function Breadcrumb({
  items,
  className = '',
  separator = (
    <ChevronRight className="mx-2 h-4 w-4 text-slate-400" aria-hidden="true" />
  ),
  ariaLabel = 'Breadcrumb',
}) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : []

  return (
    <nav aria-label={ariaLabel} className={className}>
      <ol className="flex flex-wrap items-center text-sm">
        {safeItems.map((item, idx) => {
          const isLast = idx === safeItems.length - 1
          const canNavigate = !isLast && (item?.href || item?.onClick)

          return (
            <li key={`${item?.label ?? 'item'}-${idx}`} className="flex items-center">
              {canNavigate ? (
                <a
                  href={item.href ?? '#'}
                  onClick={item.onClick}
                  className="text-slate-600 hover:text-slate-900 hover:underline underline-offset-4"
                >
                  {item.label}
                </a>
              ) : (
                <span
                  className={isLast ? 'text-slate-900 font-medium' : 'text-slate-500'}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item?.label}
                </span>
              )}

              {!isLast ? separator : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

