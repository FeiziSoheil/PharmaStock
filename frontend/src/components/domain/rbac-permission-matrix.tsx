'use client'

import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Icon } from '@/components/ui/icon'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type RbacRole = {
  id: string
  label: string
  subtitle?: string
  highlight?: boolean
}

export type RbacPermission = {
  id: string
  label: string
  group?: string
  badge?: string
  sensitive?: boolean
}

export type RbacCellMeta = {
  variant?: 'exclusive' | 'forbidden' | 'disabled'
  label?: string
}

export type RbacPermissionMatrixProps = {
  roles: RbacRole[]
  permissions: RbacPermission[]
  /** map permissionId -> roleId -> boolean */
  value: Record<string, Record<string, boolean>>
  disabledCells?: Record<string, Record<string, boolean>>
  cellMeta?: Record<string, Record<string, RbacCellMeta>>
  readOnly?: boolean
  onChange?: (permissionId: string, roleId: string, checked: boolean) => void
  className?: string
}

type MatrixRow =
  | { type: 'group'; key: string; label: string }
  | { type: 'permission'; key: string; permission: RbacPermission }

function buildMatrixRows(permissions: RbacPermission[]): MatrixRow[] {
  const rows: MatrixRow[] = []
  let lastGroup: string | undefined

  for (const permission of permissions) {
    if (permission.group && permission.group !== lastGroup) {
      rows.push({
        type: 'group',
        key: `group:${permission.group}`,
        label: permission.group,
      })
      lastGroup = permission.group
    } else if (!permission.group) {
      lastGroup = undefined
    }

    rows.push({
      type: 'permission',
      key: permission.id,
      permission,
    })
  }

  return rows
}

const stickyPermissionHead =
  'sticky start-0 z-[calc(var(--ps-z-sticky)+2)] bg-surface-muted text-right'

const stickyPermissionCell =
  'sticky start-0 z-[calc(var(--ps-z-sticky)+1)] bg-surface text-right'

function RbacPermissionMatrix({
  roles,
  permissions,
  value,
  disabledCells,
  cellMeta,
  readOnly = false,
  onChange,
  className,
}: RbacPermissionMatrixProps) {
  const rows = React.useMemo(() => buildMatrixRows(permissions), [permissions])
  const colSpan = roles.length + 1

  return (
    <div
      data-slot="rbac-permission-matrix"
      className={cn('w-full', className)}
    >
      <Table className="border-collapse text-right">
        <TableHeader>
          <TableRow className="h-auto max-h-none hover:bg-transparent">
            <TableHead className={cn(stickyPermissionHead, 'min-w-56 py-3')}>
              ماژول‌ها و عملیات سیستمی
            </TableHead>
            {roles.map((role) => (
              <TableHead
                key={role.id}
                className={cn(
                  'py-3 text-center',
                  role.highlight && 'bg-secondary-tint',
                )}
              >
                <div className="flex flex-col items-center gap-0.5">
                  <span className="inline-flex items-center gap-1 font-semibold text-text-primary">
                    {role.highlight ? (
                      <Icon
                        name="verified"
                        size={16}
                        className="text-primary"
                        data-slot="icon"
                      />
                    ) : null}
                    <span>{role.label}</span>
                  </span>
                  {role.subtitle ? (
                    <span
                      dir="ltr"
                      className="font-latin text-label-sm font-normal text-text-muted"
                    >
                      {role.subtitle}
                    </span>
                  ) : null}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            if (row.type === 'group') {
              return (
                <TableRow
                  key={row.key}
                  className="h-auto max-h-none bg-surface-muted hover:bg-surface-muted"
                >
                  <TableCell
                    colSpan={colSpan}
                    className={cn(
                      stickyPermissionCell,
                      'bg-surface-muted py-2 text-right font-semibold text-primary whitespace-normal',
                    )}
                  >
                    {row.label}
                  </TableCell>
                </TableRow>
              )
            }

            const { permission } = row

            return (
              <TableRow
                key={row.key}
                className={cn(
                  'h-auto max-h-none',
                  permission.sensitive &&
                    permission.badge &&
                    'bg-status-critical-bg/40 hover:bg-status-critical-bg/60',
                )}
              >
                <TableCell
                  className={cn(
                    stickyPermissionCell,
                    'py-2.5 whitespace-normal font-normal',
                    permission.sensitive &&
                      permission.badge &&
                      'bg-status-critical-bg/20',
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        permission.sensitive && permission.badge
                          ? 'font-semibold text-status-critical-fg'
                          : 'text-text-primary',
                      )}
                    >
                      {permission.label}
                    </span>
                    {permission.badge ? (
                      <Badge
                        variant="outline"
                        className="border-status-critical-border bg-status-critical-bg text-status-critical-fg text-label-sm"
                      >
                        {permission.badge}
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                {roles.map((role) => {
                  const checked = Boolean(value[permission.id]?.[role.id])
                  const meta = cellMeta?.[permission.id]?.[role.id]
                  const cellDisabled =
                    readOnly ||
                    Boolean(disabledCells?.[permission.id]?.[role.id]) ||
                    Boolean(meta)
                  const checkboxId = `rbac-${permission.id}-${role.id}`
                  const accessibleName = `${permission.label} — ${role.label}`

                  if (meta?.variant === 'exclusive') {
                    return (
                      <TableCell
                        key={role.id}
                        className={cn(
                          'text-center',
                          role.highlight && 'bg-secondary-tint/40',
                        )}
                      >
                        <span
                          data-slot="rbac-exclusive-lock"
                          aria-label={`${accessibleName}: ${meta.label ?? 'انحصار مسئول فنی'}`}
                          className="inline-flex items-center gap-1 rounded-default border border-primary-border bg-surface px-2.5 py-1 text-label-sm font-semibold text-primary"
                        >
                          <Icon name="verified_user" size={15} data-slot="icon" />
                          <span>{meta.label ?? 'انحصار مسئول فنی'}</span>
                        </span>
                      </TableCell>
                    )
                  }

                  if (meta?.variant === 'forbidden') {
                    return (
                      <TableCell
                        key={role.id}
                        className={cn(
                          'text-center',
                          role.highlight && 'bg-secondary-tint/40',
                        )}
                      >
                        <span
                          data-slot="rbac-forbidden-lock"
                          aria-label={`${accessibleName}: ${meta.label ?? 'غیرمجاز'}`}
                          className="inline-flex items-center gap-1 text-label-sm text-text-muted"
                        >
                          <Icon name="lock" size={15} data-slot="icon" />
                          <span>{meta.label ?? 'غیرمجاز'}</span>
                        </span>
                      </TableCell>
                    )
                  }

                  return (
                    <TableCell
                      key={role.id}
                      className={cn(
                        'text-center',
                        role.highlight && 'bg-secondary-tint/40',
                      )}
                    >
                      <div className="inline-flex items-center justify-center">
                        <Checkbox
                          id={checkboxId}
                          checked={checked}
                          disabled={cellDisabled}
                          aria-label={accessibleName}
                          onCheckedChange={(next) => {
                            if (cellDisabled) return
                            onChange?.(permission.id, role.id, next === true)
                          }}
                        />
                        <Label htmlFor={checkboxId} className="sr-only">
                          {accessibleName}
                        </Label>
                      </div>
                    </TableCell>
                  )
                })}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export { RbacPermissionMatrix }
