import type { ReactNode } from 'react'

interface SidebarProps {
  side: 'left' | 'right'
  /** Accessible name of the panel. */
  label: string
  open: boolean
  children: ReactNode
}

/** A column beside the canvas; on phones, a sheet below it, so the graph stays in view. */
export function Sidebar({ side, label, open, children }: SidebarProps) {
  const width = side === 'left' ? 'sm:w-67' : 'sm:w-96'
  const edge = side === 'left' ? 'sm:border-r' : 'sm:border-l'
  return (
    <section
      aria-label={label}
      hidden={!open}
      className={`${width} ${edge} flex min-h-0 flex-none flex-col overflow-hidden border-line bg-surface max-sm:order-last max-sm:h-[56%] max-sm:w-full max-sm:border-t`}
    >
      {children}
    </section>
  )
}
