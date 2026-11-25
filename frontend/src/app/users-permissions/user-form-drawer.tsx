'use client'

import * as React from 'react'
import { toast } from 'sonner'
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { AlertBanner, SideDrawer } from '@/components/shared'
import { ApiError } from '@/lib/api/http'
import type { BranchOption, UserAccount } from '@/lib/types/users'
import { createUserAccount, updateUserAccount } from '@/lib/users/data-access'
import {
  validateUserForm,
  type UserFormErrors,
  type UserFormValues,
} from '@/lib/users/validation'

const ROLE_OPTIONS = [
  { value: 'technical_officer', label: 'داروساز مسئول فنی (Pharmacist in Charge)' },
  { value: 'warehouse_lead', label: 'انباردار داروخانه (Warehouse Lead)' },
  { value: 'dispensing_clerk', label: 'متصدی نسخه و پیشخوان (Dispensing Clerk)' },
  { value: 'super_admin', label: 'مدیر سامانه / مؤسس (Super Admin)' },
] as const

const UNIT_PRESETS = [
  'داروخانه مرکزی (بخش بالینی)',
  'انبار مرکزی و قرنطینه دارویی',
  'باجه پذیرش نسخ و بیمه تأمین',
  'دفتر مدیریت و فناوری اطلاعات',
] as const

export type UserFormDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  user?: UserAccount | null
  branches: BranchOption[]
  onSuccess: () => void
}

function normalizeRoleForSelect(role: string): string {
  if (role === 'warehouse_operator') return 'warehouse_lead'
  if (role === 'pharmacist') return 'technical_officer'
  if (role === 'intake_clerk') return 'dispensing_clerk'
  return role || 'dispensing_clerk'
}

function UserFormBody({
  mode,
  user,
  branches,
  onOpenChange,
  onSuccess,
  setSubmitting,
}: {
  mode: 'create' | 'edit'
  user?: UserAccount | null
  branches: BranchOption[]
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  setSubmitting: React.Dispatch<React.SetStateAction<boolean>>
}) {
  const defaultBranchId = branches[0]?.id ?? 'branch-central'

  const [values, setValues] = React.useState<UserFormValues>(() =>
    mode === 'edit' && user
      ? {
          username: user.username,
          name: user.name,
          email: user.email ?? '',
          phone: user.phone ?? '',
          personnelCode: user.personnelCode ?? '',
          medicalCouncilNo: user.medicalCouncilNo ?? '',
          role: normalizeRoleForSelect(user.role),
          branchId: user.branchId || defaultBranchId,
          unitLabel: user.unitLabel || UNIT_PRESETS[0],
          password: '',
        }
      : {
          username: '',
          name: '',
          email: '',
          phone: '',
          personnelCode: '',
          medicalCouncilNo: '',
          role: 'technical_officer',
          branchId: defaultBranchId,
          unitLabel: UNIT_PRESETS[0],
          password: '',
        },
  )
  const [errors, setErrors] = React.useState<UserFormErrors>({})
  const [serverError, setServerError] = React.useState<string | null>(null)

  const updateField = <K extends keyof UserFormValues>(
    field: K,
    next: UserFormValues[K],
  ) => {
    setValues((prev) => ({ ...prev, [field]: next }))
    setErrors((prev) => {
      if (!prev[field]) return prev
      const copy = { ...prev }
      delete copy[field]
      return copy
    })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const nextErrors = validateUserForm(values, mode)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setSubmitting(true)
    setServerError(null)
    try {
      if (mode === 'create') {
        await createUserAccount({
          username: values.username.trim(),
          name: values.name.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
          personnelCode: values.personnelCode.trim(),
          medicalCouncilNo: values.medicalCouncilNo.trim(),
          role: values.role,
          branchId: values.branchId,
          unitLabel: values.unitLabel.trim(),
          password: values.password,
          active: true,
        })
        toast.success('کاربر جدید با موفقیت در سامانه ثبت شد')
      } else if (user) {
        await updateUserAccount(user.id, {
          name: values.name.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
          personnelCode: values.personnelCode.trim(),
          medicalCouncilNo: values.medicalCouncilNo.trim(),
          role: values.role,
          branchId: values.branchId,
          unitLabel: values.unitLabel.trim(),
        })
        toast.success('مشخصات و نقش کاربر به‌روزرسانی شد')
      }
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message)
        if (err.fields && typeof err.fields === 'object') {
          setErrors((prev) => ({
            ...prev,
            ...(err.fields as Partial<Record<keyof UserFormValues, string>>),
          }))
        }
      } else {
        setServerError('خطا در ذخیره اطلاعات کاربر')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      id="user-form-drawer-form"
      data-slot="user-form-drawer"
      onSubmit={handleSubmit}
      className="space-y-4 pb-2"
    >
      {serverError ? (
        <AlertBanner tone="critical" title="خطا در ثبت اطلاعات" description={serverError} />
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="user-form-name">نام و نام‌خانوادگی کامل</Label>
          <Input
            id="user-form-name"
            value={values.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="مثال: دکتر سارا انصاری"
            error={Boolean(errors.name)}
          />
          {errors.name ? (
            <p className="text-label-sm text-status-critical-fg" role="alert">
              {errors.name}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="user-form-username">نام کاربری (شناسه ورود)</Label>
          <Input
            id="user-form-username"
            dir="ltr"
            className="font-latin text-start"
            value={values.username}
            disabled={mode === 'edit'}
            onChange={(e) => updateField('username', e.target.value)}
            placeholder="s.ansari"
            error={Boolean(errors.username)}
          />
          {errors.username ? (
            <p className="text-label-sm text-status-critical-fg" role="alert">
              {errors.username}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="user-form-personnel">کد پرسنلی / نظام پزشکی</Label>
          <Input
            id="user-form-personnel"
            value={values.personnelCode}
            onChange={(e) => updateField('personnelCode', e.target.value)}
            placeholder="مثال: د-۹۹۱۲۳"
            error={Boolean(errors.personnelCode)}
          />
          {errors.personnelCode ? (
            <p className="text-label-sm text-status-critical-fg" role="alert">
              {errors.personnelCode}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="user-form-phone">شماره تماس همراه</Label>
          <Input
            id="user-form-phone"
            dir="ltr"
            className="font-latin text-start"
            value={values.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder="09123456789"
            error={Boolean(errors.phone)}
          />
          {errors.phone ? (
            <p className="text-label-sm text-status-critical-fg" role="alert">
              {errors.phone}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="user-form-email">پست الکترونیک</Label>
          <Input
            id="user-form-email"
            dir="ltr"
            className="font-latin text-start"
            value={values.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="s.ansari@pharmastock.ir"
            error={Boolean(errors.email)}
          />
          {errors.email ? (
            <p className="text-label-sm text-status-critical-fg" role="alert">
              {errors.email}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="user-form-medical">شماره نظام پزشکی (اختیاری)</Label>
          <Input
            id="user-form-medical"
            value={values.medicalCouncilNo}
            onChange={(e) => updateField('medicalCouncilNo', e.target.value)}
            placeholder="نظام پزشکی دائم"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="user-form-role">نقش سازمانی</Label>
        <Select
          value={values.role}
          onValueChange={(next) => updateField('role', next)}
        >
          <SelectTrigger id="user-form-role" aria-label="نقش سازمانی">
            <SelectValue placeholder="انتخاب نقش" />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.role ? (
          <p className="text-label-sm text-status-critical-fg" role="alert">
            {errors.role}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="user-form-branch">شعبه استقرار</Label>
        <Select
          value={values.branchId}
          onValueChange={(next) => updateField('branchId', next)}
        >
          <SelectTrigger id="user-form-branch" aria-label="شعبه استقرار">
            <SelectValue placeholder="انتخاب شعبه" />
          </SelectTrigger>
          <SelectContent>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.nameFa}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.branchId ? (
          <p className="text-label-sm text-status-critical-fg" role="alert">
            {errors.branchId}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="user-form-unit">واحد استقرار فیزیکی</Label>
        <Input
          id="user-form-unit"
          value={values.unitLabel}
          onChange={(e) => updateField('unitLabel', e.target.value)}
          placeholder="مثال: داروخانه مرکزی (بخش بالینی)"
        />
      </div>

      {mode === 'create' ? (
        <div className="space-y-1.5">
          <Label htmlFor="user-form-password">کلمه عبور اولیه</Label>
          <Input
            id="user-form-password"
            type="password"
            dir="ltr"
            className="font-latin text-start"
            value={values.password}
            onChange={(e) => updateField('password', e.target.value)}
            placeholder="حداقل ۸ کاراکتر"
            error={Boolean(errors.password)}
          />
          {errors.password ? (
            <p className="text-label-sm text-status-critical-fg" role="alert">
              {errors.password}
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  )
}

export function UserFormDrawer({
  open,
  onOpenChange,
  mode,
  user,
  branches,
  onSuccess,
}: UserFormDrawerProps) {
  const [submitting, setSubmitting] = React.useState(false)

  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={
        mode === 'create'
          ? 'افزودن پرسنل جدید به سامانه'
          : `ویرایش پروفایل: ${user?.name ?? ''}`
      }
      description="اطلاعات هویتی، کد پرسنلی و نقش سازمانی کاربر را مطابق ضوابط داروخانه وارد کنید."
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            انصراف
          </Button>
          <Button
            type="submit"
            form="user-form-drawer-form"
            loading={submitting}
          >
            {mode === 'create' ? 'ثبت و صدور حساب کاربری' : 'ذخیره تغییرات پروفایل'}
          </Button>
        </div>
      }
    >
      {open ? (
        <UserFormBody
          key={`${mode}-${user?.id ?? 'new'}-${branches[0]?.id ?? ''}`}
          mode={mode}
          user={user}
          branches={branches}
          onOpenChange={onOpenChange}
          onSuccess={onSuccess}
          setSubmitting={setSubmitting}
        />
      ) : null}
    </SideDrawer>
  )
}
