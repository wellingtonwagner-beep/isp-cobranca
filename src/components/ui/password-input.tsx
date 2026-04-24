'use client'

import { useState, forwardRef } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput(
  { value, onChange, className, ...rest },
  ref,
) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        ref={ref}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        className={`pr-10 ${className || ''}`}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        className="absolute inset-y-0 right-0 flex items-center justify-center w-10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
})
