'use client'

import * as React from 'react'

export type ShellDrawerPayload = {
  open: boolean
  title: string
  description?: string
  body: React.ReactNode
  footer?: React.ReactNode
  side?: 'start' | 'end'
  className?: string
  onOpenChange?: (open: boolean) => void
}

export type ShellDrawerContextValue = {
  /** Push-island host is active (desktop/tablet inside AppShell). */
  pushEnabled: boolean
  publish: (payload: ShellDrawerPayload | null) => void
}

const ShellDrawerContext = React.createContext<ShellDrawerContextValue | null>(
  null,
)

function useShellDrawerHost(): ShellDrawerContextValue | null {
  return React.useContext(ShellDrawerContext)
}

export { ShellDrawerContext, useShellDrawerHost }
