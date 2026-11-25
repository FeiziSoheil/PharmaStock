import * as React from 'react'
import { cn } from '@/lib/utils'

export type PageHeaderProps = React.ComponentProps<'header'> & {
  title: string
  description?: string
  breadcrumbs?: React.ReactNode
  actions?: React.ReactNode
}

/**
 * In-page title block under TopHeader: breadcrumbs, Persian H1, optional actions.
 */
function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        'flex flex-col gap-3 border-b border-border-subtle pb-4',
        className,
      )}
      {...props}
    >
      {breadcrumbs ? (
        <div data-slot="page-header-breadcrumbs">{breadcrumbs}</div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-headline-md text-text-primary">{title}</h1>
          {description ? (
            <p className="text-body-md text-text-secondary">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div
            data-slot="page-header-actions"
            className="flex flex-wrap items-center gap-2"
          >
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  )
}

export { PageHeader }
