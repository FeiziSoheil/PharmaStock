'use client'

import * as React from 'react'
import { toast } from 'sonner'
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Icon,
  Input,
  Label,
} from '@/components/ui'
import { ApiError } from '@/lib/api/http'
import type { UserAccount } from '@/lib/types/users'
import { resetUserAccountPassword } from '@/lib/users/data-access'
import { validateResetPassword } from '@/lib/users/validation'

export type ResetPasswordDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserAccount | null
  onSuccess: () => void
}

function ResetPasswordForm({
  user,
  onOpenChange,
  onSuccess,
}: {
  user: UserAccount | null
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [unlock, setUnlock] = React.useState(Boolean(user?.permanentlyLocked))
  const [errors, setErrors] = React.useState<{
    password?: string
    confirmPassword?: string
  }>({})
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user) return
    const nextErrors = validateResetPassword(password, confirmPassword)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    setSubmitting(true)
    setServerError(null)
    try {
      await resetUserAccountPassword(user.id, password, unlock)
      toast.success(`رمز عبور ${user.name} با موفقیت بازنشانی شد`)
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      setServerError(
        err instanceof ApiError ? err.message : 'خطا در بازنشانی رمز عبور',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {serverError ? (
        <div
          role="alert"
          className="rounded-default border border-status-critical-border bg-status-critical-bg px-3 py-2 text-body-sm text-status-critical-fg"
        >
          {serverError}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="reset-pw-new">کلمه عبور جدید</Label>
        <Input
          id="reset-pw-new"
          type="password"
          dir="ltr"
          className="font-latin text-start"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setErrors((prev) => ({ ...prev, password: undefined }))
          }}
          placeholder="حداقل ۸ کاراکتر"
          error={Boolean(errors.password)}
        />
        {errors.password ? (
          <p className="text-label-sm text-status-critical-fg" role="alert">
            {errors.password}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reset-pw-confirm">تکرار کلمه عبور جدید</Label>
        <Input
          id="reset-pw-confirm"
          type="password"
          dir="ltr"
          className="font-latin text-start"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value)
            setErrors((prev) => ({ ...prev, confirmPassword: undefined }))
          }}
          placeholder="تکرار کلمه عبور"
          error={Boolean(errors.confirmPassword)}
        />
        {errors.confirmPassword ? (
          <p className="text-label-sm text-status-critical-fg" role="alert">
            {errors.confirmPassword}
          </p>
        ) : null}
      </div>

      <label className="flex cursor-pointer items-center gap-2 select-none">
        <Checkbox
          checked={unlock}
          onCheckedChange={(checked) => setUnlock(checked === true)}
        />
        <span className="text-body-sm text-text-secondary">
          رفع قفل و فعال‌سازی مجدد حساب کاربری
        </span>
      </label>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={submitting}
          onClick={() => onOpenChange(false)}
        >
          انصراف
        </Button>
        <Button type="submit" loading={submitting}>
          ثبت رمز عبور جدید
        </Button>
      </DialogFooter>
    </form>
  )
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: ResetPasswordDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-slot="reset-password-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Icon name="key" size={20} data-slot="icon" />
            <span>بازنشانی کلمه عبور</span>
          </DialogTitle>
          <DialogDescription>
            {user
              ? `تنظیم کلمه عبور جدید برای ${user.name} (${user.username})`
              : 'تنظیم کلمه عبور جدید'}
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <ResetPasswordForm
            key={user?.id ?? 'none'}
            user={user}
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
