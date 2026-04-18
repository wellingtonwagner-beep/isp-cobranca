import { clsx } from 'clsx'

interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={clsx('bg-white dark:bg-gray-800 rounded-xl border border-purple-100 dark:border-gray-700 shadow-sm', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: CardProps) {
  return <div className={clsx('px-5 py-4 border-b border-purple-50 dark:border-gray-700', className)}>{children}</div>
}

export function CardContent({ children, className }: CardProps) {
  return <div className={clsx('px-5 py-4', className)}>{children}</div>
}

export function CardTitle({ children, className }: CardProps) {
  return <h3 className={clsx('text-base font-semibold text-gray-800 dark:text-gray-100', className)}>{children}</h3>
}
