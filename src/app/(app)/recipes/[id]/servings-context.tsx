'use client'

import { createContext, use, useState } from 'react'

type Mode = 'scale' | 'split'

const ServingsContext = createContext<{
  servings: number
  setServings: React.Dispatch<React.SetStateAction<number>>
  mode: Mode
  setMode: React.Dispatch<React.SetStateAction<Mode>>
} | null>(null)

export function ServingsProvider({
  baseServings,
  children,
}: {
  baseServings: number
  children: React.ReactNode
}) {
  const [servings, setServings] = useState(baseServings)
  const [mode, setMode] = useState<Mode>('scale')
  return (
    <ServingsContext value={{ servings, setServings, mode, setMode }}>{children}</ServingsContext>
  )
}

export function useServings() {
  const value = use(ServingsContext)
  if (!value) throw new Error('useServings must be used inside ServingsProvider')
  return value
}
