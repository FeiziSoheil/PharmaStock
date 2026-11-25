'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Badge, Button, Checkbox, Icon, Label } from '@/components/ui'
import { AlertBanner, SideDrawer } from '@/components/shared'
import { ApiError } from '@/lib/api/http'
import { getAuditRoleLabel } from '@/lib/domain/auditEvents'
import type { RbacMatrixData, UserAccount, UserDetail } from '@/lib/types/users'
import {
  fetchUserDetail,
  saveUserCustomPermissions,
} from '@/lib/users/data-access'

export type UserPermissionsDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserAccount | null
  matrixData: RbacMatrixData | null
  onSaved: () => void
}

function matrixRoleFor(role: string): string {
  if (role === 'warehouse_operator') return 'warehouse_lead'
  if (role === 'pharmacist') return 'technical_officer'
  if (role === 'intake_clerk') return 'dispensing_clerk'
  return role
}

export function UserPermissionsDrawer({
  open,
  onOpenChange,
  user,
  matrixData,
  onSaved,
}: UserPermissionsDrawerProps) {
  const [detail, setDetail] = React.useState<UserDetail | null>(null)
  const [loadedKey, setLoadedKey] = React.useState<string>('')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [draftOverrides, setDraftOverrides] = React.useState<
    Record<string, boolean | null>
  >({})

  const requestKey = open && user ? `${user.id}` : ''

  React.useEffect(() => {
    if (!open || !user) return
    let active = true
    const key = user.id
    fetchUserDetail(user.id)
      .then((res) => {
        if (!active) return
        setDetail(res)
        setError(null)
        setDraftOverrides({})
        setLoadedKey(key)
      })
      .catch((err) => {
        if (!active) return
        setError(
          err instanceof ApiError
            ? err.message
            : 'خطا در دریافت مجوزهای کاربر',
        )
        setLoadedKey(key)
      })
    return () => {
      active = false
    }
  }, [open, user])

  const loading = Boolean(requestKey) && loadedKey !== requestKey
  const canonRole = user ? matrixRoleFor(user.role) : ''

  const resolveState = (
    permId: string,
  ): {
    checked: boolean
    isOverride: boolean
    locked: boolean
    lockReason?: string
  } => {
    const baseRoleValue = Boolean(matrixData?.matrix[permId]?.[canonRole])
    const lock = matrixData?.lockedCells[permId]?.[canonRole]
    if (lock) {
      return {
        checked: lock.forcedValue,
        isOverride: false,
        locked: true,
        lockReason: lock.label ?? 'قفل قانونی تفکیک وظایف',
      }
    }
    if (permId in draftOverrides) {
      const ov = draftOverrides[permId]
      if (ov === null || ov === undefined) {
        return { checked: baseRoleValue, isOverride: false, locked: false }
      }
      return { checked: ov, isOverride: ov !== baseRoleValue, locked: false }
    }
    const existing =
      detail?.id === user?.id ? detail?.customPermissions?.[permId] : undefined
    if (existing !== undefined) {
      return {
        checked: existing,
        isOverride: existing !== baseRoleValue,
        locked: false,
      }
    }
    return { checked: baseRoleValue, isOverride: false, locked: false }
  }

  const handleToggle = (permId: string, nextChecked: boolean) => {
    const baseRoleValue = Boolean(matrixData?.matrix[permId]?.[canonRole])
    setDraftOverrides((prev) => ({
      ...prev,
      [permId]: nextChecked === baseRoleValue ? null : nextChecked,
    }))
  }

  const handleResetAll = () => {
    if (!matrixData) return
    const cleared: Record<string, null> = {}
    for (const p of matrixData.permissions) {
      cleared[p.id] = null
    }
    setDraftOverrides(cleared)
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      await saveUserCustomPermissions(user.id, draftOverrides)
      toast.success(`مجوزهای اختصاصی ${user.name} ذخیره شد`)
      onOpenChange(false)
      onSaved()
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'ذخیره مجوزهای اختصاصی با خطا مواجه شد',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={user ? `مجوزهای اختصاصی: ${user.name}` : 'تنظیم مجوز اختصاصی'}
      description={
        user
          ? `نقش پایه: ${getAuditRoleLabel(user.role)} · کد پرسنلی: ${user.personnelCode || user.username}`
          : undefined
      }
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={loading || saving}
            onClick={handleResetAll}
          >
            بازگشت به پیش‌فرض نقش
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              بستن
            </Button>
            <Button
              type="button"
              loading={saving}
              disabled={loading || Object.keys(draftOverrides).length === 0}
              onClick={handleSave}
            >
              ثبت مجوزهای اختصاصی
            </Button>
          </div>
        </div>
      }
    >
      <div data-slot="user-permissions-drawer" className="space-y-4">
        <AlertBanner
          tone="info"
          title="محدودیت قانونی تفکیک وظایف"
          description="مجوزهای قفل‌شده مطابق بخشنامه سازمان غذا و دارو قابل اعطای اختصاصی نیستند."
        />

        {error ? (
          <AlertBanner tone="critical" title="خطا" description={error} />
        ) : null}

        {loading || !matrixData ? (
          <div className="space-y-2 py-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="h-10 animate-pulse rounded-default bg-surface-subtle"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {matrixData.permissions.map((perm) => {
              const state = resolveState(perm.id)
              const cbId = `user-perm-${perm.id}`
              return (
                <div
                  key={perm.id}
                  className="flex items-center justify-between gap-3 rounded-default border border-border-subtle bg-surface px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <Label
                      htmlFor={cbId}
                      className="cursor-pointer text-body-sm font-medium text-text-primary"
                    >
                      {perm.label}
                    </Label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-label-sm text-text-muted">
                        {perm.group}
                      </span>
                      {state.isOverride ? (
                        <Badge variant="secondary" className="text-label-sm">
                          تغییر اختصاصی
                        </Badge>
                      ) : null}
                      {state.locked ? (
                        <Badge
                          variant="outline"
                          className="gap-1 text-label-sm text-text-muted"
                        >
                          <Icon name="lock" size={12} data-slot="icon" />
                          <span>{state.lockReason}</span>
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <Checkbox
                    id={cbId}
                    checked={state.checked}
                    disabled={state.locked || saving}
                    aria-label={perm.label}
                    onCheckedChange={(next) =>
                      handleToggle(perm.id, next === true)
                    }
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </SideDrawer>
  )
}
