import { HTMLAttributes } from 'react'

type BadgeVariant = 'scheduled' | 'recording' | 'processing' | 'completed' | 'failed' | 'default'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  children: React.ReactNode
}

export default function Badge({ variant = 'default', children, className = '', ...props }: BadgeProps) {
  const variants = {
    scheduled: 'bg-blue-100 text-blue-800 border-blue-200',
    recording: 'bg-green-100 text-green-800 border-green-200 animate-pulse',
    processing: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    completed: 'bg-gray-100 text-gray-800 border-gray-200',
    failed: 'bg-red-100 text-red-800 border-red-200',
    default: 'bg-gray-100 text-gray-800 border-gray-200',
  }

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
