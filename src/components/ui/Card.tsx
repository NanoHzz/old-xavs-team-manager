import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface CardProps {
  title?: string
  children: ReactNode
  padding?: boolean
  className?: string
}

export function Card({ title, children, padding = true, className }: CardProps) {
  return (
    <div className={cn('bg-white rounded-lg shadow', className)}>
      {title && <div className="border-b border-gray-200 px-4 py-3 font-semibold">{title}</div>}
      <div className={padding ? 'p-4' : ''}>{children}</div>
    </div>
  )
}
