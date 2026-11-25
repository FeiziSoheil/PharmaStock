'use client'

import type { CSSProperties } from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { Icon } from '@/components/ui/icon'

/**
 * Light-only toast host (clinical-light). No next-themes / dark mode.
 * Placement: bottom-start (bottom-left in RTL physical terms via sonner's RTL support).
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="bottom-left"
      dir="rtl"
      icons={{
        success: <Icon name="check_circle" size={16} data-slot="icon" />,
        info: <Icon name="info" size={16} data-slot="icon" />,
        warning: <Icon name="warning" size={16} data-slot="icon" />,
        error: <Icon name="error" size={16} data-slot="icon" />,
        loading: (
          <Icon
            name="progress_activity"
            size={16}
            className="animate-spin"
            data-slot="icon"
          />
        ),
      }}
      style={
        {
          '--normal-bg': 'var(--ps-surface)',
          '--normal-text': 'var(--ps-text)',
          '--normal-border': 'var(--ps-border)',
          '--success-bg': 'var(--ps-status-valid-bg)',
          '--success-text': 'var(--ps-status-valid-fg)',
          '--success-border': 'var(--ps-status-valid-border)',
          '--error-bg': 'var(--ps-status-critical-bg)',
          '--error-text': 'var(--ps-status-critical-fg)',
          '--error-border': 'var(--ps-status-critical-border)',
          '--border-radius': 'var(--ps-radius-default)',
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            'group toast border border-border-default bg-surface text-text-primary shadow-dropdown',
          description: 'text-text-secondary',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-surface-subtle text-text-secondary',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
