import { cn } from '@/lib/utils'

export function AppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('shrink-0', className)}>
      <rect width="32" height="32" rx="8" fill="#4A5D3A" />
      <path d="M15.4 13.6C12.6 11.7 12.4 7.6 15.9 4.6c2.6 3.2 2.4 6.9-.5 9z" fill="#F2D27A" />
      <path d="M16.6 13.6c.6-2.6 2.6-4.1 5.4-4.1-.5 2.6-2.6 4.1-5.4 4.1z" fill="#F2D27A" />
      <path d="M5.5 15h21a10.5 10.5 0 0 1-21 0z" fill="#FBF8F2" />
    </svg>
  )
}
