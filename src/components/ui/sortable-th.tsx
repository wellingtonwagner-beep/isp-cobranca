'use client'

import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'

export type SortDir = 'asc' | 'desc'

interface Props<F extends string> {
  field: F
  sortBy: F
  sortDir: SortDir
  onSort: (f: F) => void
  align?: 'left' | 'right' | 'center'
  className?: string
  children: React.ReactNode
}

export function SortableTh<F extends string>({
  field, sortBy, sortDir, onSort, align = 'left', className = '', children,
}: Props<F>) {
  const active = sortBy === field
  const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  const justifyClass = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''
  return (
    <th className={`px-4 py-2 ${alignClass} ${className}`}>
      <button
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 transition-colors ${justifyClass} ${active ? 'text-purple-600 dark:text-purple-400' : ''}`}
      >
        {children}
        <Icon size={11} className={active ? '' : 'opacity-40'} />
      </button>
    </th>
  )
}

/**
 * Helper para alternar sort: clicar no mesmo campo inverte direcao,
 * trocar de campo reseta para 'asc'. Retorna o novo estado.
 */
export function toggleSort<F extends string>(
  current: { sortBy: F; sortDir: SortDir },
  field: F,
): { sortBy: F; sortDir: SortDir } {
  if (current.sortBy === field) {
    return { sortBy: field, sortDir: current.sortDir === 'asc' ? 'desc' : 'asc' }
  }
  return { sortBy: field, sortDir: 'asc' }
}
