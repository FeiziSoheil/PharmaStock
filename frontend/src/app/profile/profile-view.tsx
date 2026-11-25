'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout'
import { AlertBanner, PageHeader } from '@/components/shared'
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Icon,
  Input,
  Label,
  Skeleton,
} from '@/components/ui'
import {
  apiChangePassword,
  apiGetMe,
  apiUpdateMe,
  type ProfileMe,
} from '@/lib/api/profile'
import { updateSessionUser } from '@/lib/api/session'
import { getAuditRoleLabel } from '@/lib/domain/auditEvents'
import { getAppNavItems } from '@/lib/nav/app-nav'
import { formatJalaliDate, formatPersianTime, toPersianDigits } from '@/lib/persian'
import {
  validateChangePasswordForm,
  validateProfileForm,
  type ChangePasswordFormErrors,
  type ChangePasswordFormValues,
  type ProfileFormErrors,
  type ProfileFormValues,
} from '@/lib/profile/validation'
import { cn } from '@/lib/utils'

export function ProfileView() {
  const [profile, setProfile] = React.useState<ProfileMe | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [fetchError, setFetchError] = React.useState<string | null>(null)

  // Profile edit form state
  const [profileForm, setProfileForm] = React.useState<ProfileFormValues>({
    name: '',
    email: '',
    phone: '',
  })
  const [profileErrors, setProfileErrors] = React.useState<ProfileFormErrors>({})
  const [savingProfile, setSavingProfile] = React.useState(false)

  // Password change form state
  const [passwordForm, setPasswordForm] =
    React.useState<ChangePasswordFormValues>({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    })
  const [passwordErrors, setPasswordErrors] =
    React.useState<ChangePasswordFormErrors>({})
  const [changingPassword, setChangingPassword] = React.useState(false)
  const [showCurrentPass, setShowCurrentPass] = React.useState(false)
  const [showNewPass, setShowNewPass] = React.useState(false)
  const [showConfirmPass, setShowConfirmPass] = React.useState(false)

  const applyProfile = React.useCallback((data: ProfileMe) => {
    setProfile(data)
    setProfileForm({
      name: data.name || '',
      email: data.email || '',
      phone: data.phone || '',
    })
  }, [])

  const loadProfile = React.useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      applyProfile(await apiGetMe())
    } catch {
      setFetchError('دریافت اطلاعات پروفایل با خطا مواجه شد. لطفاً دوباره تلاش کنید.')
    } finally {
      setLoading(false)
    }
  }, [applyProfile])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await apiGetMe()
        if (cancelled) return
        applyProfile(data)
      } catch {
        if (!cancelled) {
          setFetchError('دریافت اطلاعات پروفایل با خطا مواجه شد. لطفاً دوباره تلاش کنید.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applyProfile])

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors = validateProfileForm(profileForm)
    setProfileErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSavingProfile(true)
    try {
      const updated = await apiUpdateMe({
        name: profileForm.name.trim(),
        email: profileForm.email.trim() || undefined,
        phone: profileForm.phone.trim() || undefined,
      })
      setProfile(updated)
      updateSessionUser({ name: updated.name })
      toast.success('مشخصات فردی با موفقیت ذخیره شد.')
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'خطا در ذخیره‌سازی اطلاعات'
      toast.error(msg)
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors = validateChangePasswordForm(passwordForm)
    setPasswordErrors(errors)
    if (Object.keys(errors).length > 0) return

    setChangingPassword(true)
    try {
      const res = await apiChangePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      if (res.ok) {
        toast.success(res.message || 'رمز عبور با موفقیت تغییر یافت.')
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        })
        setPasswordErrors({})
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'خطا در تغییر رمز عبور'
      toast.error(msg)
    } finally {
      setChangingPassword(false)
    }
  }

  const initial = profile?.name ? Array.from(profile.name.trim())[0] : '؟'
  const roleLabel = profile?.role
    ? getAuditRoleLabel(profile.role)
    : 'نقش تعریف‌نشده'

  return (
    <AppShell
      navItems={getAppNavItems()}
      header={{
        branchLabel: profile?.branchNameFa || 'شعبه مرکزی',
        searchPlaceholder: 'جستجو در انبار دارو...',
      }}
      contentClassName="space-y-6"
    >
      <PageHeader
        title="پروفایل و تنظیمات حساب کاربری"
        description="مشاهده هویت پرسنلی، ویرایش اطلاعات تماس و تغییر رمز عبور"
        breadcrumbs={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">داشبورد</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>پروفایل کاربری</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
      />

      {fetchError ? (
        <AlertBanner
          tone="critical"
          title="خطا در اتصال به سامانه"
          description={fetchError}
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadProfile}
            >
              تلاش مجدد
            </Button>
          }
        />
      ) : null}

      {loading && !profile ? (
        <div
          data-slot="profile-skeleton"
          className="grid grid-cols-1 gap-6 lg:grid-cols-12"
          aria-busy="true"
          aria-label="در حال بارگذاری پروفایل کاربر"
        >
          <div className="space-y-6 lg:col-span-5">
            <div className="space-y-4 rounded-default border border-border-default bg-card p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="size-14 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-36" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <div className="space-y-3 pt-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </div>
          </div>
          <div className="space-y-6 lg:col-span-7">
            <div className="space-y-4 rounded-default border border-border-default bg-card p-6">
              <Skeleton className="h-6 w-40" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-28" />
            </div>
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Right column: Identity & Security card (Read-only) */}
        <div className="space-y-6 lg:col-span-5">
          <Card className="border-border-default">
            <CardHeader className="flex flex-row items-center gap-4 pb-4">
              <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-tint text-headline-sm font-bold text-primary">
                {initial}
              </span>
              <div className="min-w-0 flex-1">
                <CardTitle className="truncate text-title-md text-text-primary">
                  {profile?.name || (loading ? 'در حال بارگذاری…' : '—')}
                </CardTitle>
                <CardDescription className="mt-1 flex items-center gap-2">
                  <Badge variant="outline" className="border-primary/30 text-primary">
                    {roleLabel}
                  </Badge>
                  <span className="text-label-sm text-text-muted" dir="ltr">
                    @{profile?.username || '—'}
                  </span>
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 border-t border-border-subtle pt-4 text-body-sm">
              <div className="flex justify-between py-1">
                <span className="text-text-muted">شناسه کاربری (Username):</span>
                <span className="font-semibold text-text-primary" dir="ltr">
                  {profile?.username || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-text-muted">کد پرسنلی / نظام پزشکی:</span>
                <span className="font-semibold text-text-primary">
                  {profile?.personnelCode || profile?.medicalCouncilNo || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-text-muted">شعبه یا انبار استقرار:</span>
                <span className="font-semibold text-text-primary">
                  {profile?.branchNameFa || 'شعبه مرکزی'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-text-muted">واحد سازمانی:</span>
                <span className="font-semibold text-text-primary">
                  {profile?.unitLabel || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-text-muted">وضعیت حساب:</span>
                <Badge
                  variant={profile?.status === 'active' ? 'default' : 'secondary'}
                  className={cn(
                    profile?.status === 'active' &&
                      'bg-status-valid-bg text-status-valid-fg border-status-valid-border',
                  )}
                >
                  {profile?.status === 'active' ? 'فعال' : 'غیرفعال / محدود'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Last Login & Security Info */}
          <Card className="border-border-default">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Icon name="security" size={20} className="text-primary" data-slot="icon" />
                <CardTitle className="text-title-sm text-text-primary">
                  امنیت نشست و ورود به سیستم
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-body-sm">
              <div className="flex justify-between py-1">
                <span className="text-text-muted">آخرین ورود موفق:</span>
                <span className="font-semibold text-text-primary">
                  {profile?.lastLoginAt
                    ? `${formatJalaliDate(profile.lastLoginAt)} ساعت ${formatPersianTime(profile.lastLoginAt)}`
                    : 'ثبت نشده'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-text-muted">نشانی IP آخرین نشست:</span>
                <span className="font-latin text-text-primary" dir="ltr">
                  {profile?.lastLoginIp || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-text-muted">مرورگر و دستگاه:</span>
                <span className="text-text-primary truncate max-w-[180px]" dir="ltr">
                  {profile?.lastLoginDevice || 'مرورگر استاندارد بالینی'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Left column: Edit info & Change password forms */}
        <div className="space-y-6 lg:col-span-7">
          {/* Edit Profile Form */}
          <Card className="border-border-default">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Icon name="badge" size={20} className="text-primary" data-slot="icon" />
                <CardTitle className="text-title-sm text-text-primary">
                  ویرایش مشخصات فردی و اطلاعات تماس
                </CardTitle>
              </div>
              <CardDescription>
                نام نمایشی و اطلاعات تماس شما در لاگ‌های ممیزی و اسناد بالینی ثبت می‌گردد.
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleProfileSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="profile-name">نام و نام خانوادگی</Label>
                  <Input
                    id="profile-name"
                    value={profileForm.name}
                    onChange={(e) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="مثال: دکتر محمدرضا رضایی"
                    disabled={loading || savingProfile}
                    className={cn(profileErrors.name && 'border-status-critical-fg')}
                  />
                  {profileErrors.name ? (
                    <p className="text-label-sm text-status-critical-fg">
                      {profileErrors.name}
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-email">پست الکترونیک (ایمیل)</Label>
                    <Input
                      id="profile-email"
                      type="email"
                      dir="ltr"
                      value={profileForm.email}
                      onChange={(e) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      placeholder="rezaei@pharmastock.ir"
                      disabled={loading || savingProfile}
                      className={cn(profileErrors.email && 'border-status-critical-fg')}
                    />
                    {profileErrors.email ? (
                      <p className="text-label-sm text-status-critical-fg">
                        {profileErrors.email}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="profile-phone">شماره تماس همراه</Label>
                    <Input
                      id="profile-phone"
                      type="tel"
                      dir="ltr"
                      value={profileForm.phone}
                      onChange={(e) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          phone: toPersianDigits(e.target.value),
                        }))
                      }
                      placeholder="۰۹۱۲۱۱۱۱۱۱۱"
                      disabled={loading || savingProfile}
                      className={cn(profileErrors.phone && 'border-status-critical-fg')}
                    />
                    {profileErrors.phone ? (
                      <p className="text-label-sm text-status-critical-fg">
                        {profileErrors.phone}
                      </p>
                    ) : null}
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex justify-end border-t border-border-subtle pt-4">
                <Button type="submit" disabled={loading || savingProfile}>
                  {savingProfile ? (
                    <>
                      <Icon name="progress_activity" size={18} className="animate-spin" data-slot="icon" />
                      در حال ذخیره…
                    </>
                  ) : (
                    <>
                      <Icon name="save" size={18} data-slot="icon" />
                      ذخیره تغییرات
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {/* Change Password Form */}
          <Card className="border-border-default">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Icon name="lock" size={20} className="text-primary" data-slot="icon" />
                <CardTitle className="text-title-sm text-text-primary">
                  تغییر رمز عبور ورود
                </CardTitle>
              </div>
              <CardDescription>
                جهت ارتقای امنیت سامانه، رمز عبور باید حداقل شامل ۸ کاراکتر و متفاوت از رمز فعلی باشد.
              </CardDescription>
            </CardHeader>

            <form onSubmit={handlePasswordSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="current-pass">رمز عبور فعلی</Label>
                  <div className="relative">
                    <Input
                      id="current-pass"
                      type={showCurrentPass ? 'text' : 'password'}
                      dir="ltr"
                      value={passwordForm.currentPassword}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          currentPassword: e.target.value,
                        }))
                      }
                      placeholder="••••••••"
                      disabled={changingPassword}
                      className={cn(
                        'pe-10',
                        passwordErrors.currentPassword && 'border-status-critical-fg',
                      )}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute end-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                      aria-label={showCurrentPass ? 'مخفی‌سازی رمز' : 'نمایش رمز'}
                    >
                      <Icon
                        name={showCurrentPass ? 'visibility' : 'visibility'}
                        size={18}
                        data-slot="icon"
                      />
                    </button>
                  </div>
                  {passwordErrors.currentPassword ? (
                    <p className="text-label-sm text-status-critical-fg">
                      {passwordErrors.currentPassword}
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-pass">رمز عبور جدید</Label>
                    <div className="relative">
                      <Input
                        id="new-pass"
                        type={showNewPass ? 'text' : 'password'}
                        dir="ltr"
                        value={passwordForm.newPassword}
                        onChange={(e) =>
                          setPasswordForm((prev) => ({
                            ...prev,
                            newPassword: e.target.value,
                          }))
                        }
                        placeholder="حداقل ۸ کاراکتر"
                        disabled={changingPassword}
                        className={cn(
                          'pe-10',
                          passwordErrors.newPassword && 'border-status-critical-fg',
                        )}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute end-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                        aria-label={showNewPass ? 'مخفی‌سازی رمز' : 'نمایش رمز'}
                      >
                        <Icon
                          name={showNewPass ? 'visibility' : 'visibility'}
                          size={18}
                          data-slot="icon"
                        />
                      </button>
                    </div>
                    {passwordErrors.newPassword ? (
                      <p className="text-label-sm text-status-critical-fg">
                        {passwordErrors.newPassword}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-pass">تکرار رمز عبور جدید</Label>
                    <div className="relative">
                      <Input
                        id="confirm-pass"
                        type={showConfirmPass ? 'text' : 'password'}
                        dir="ltr"
                        value={passwordForm.confirmPassword}
                        onChange={(e) =>
                          setPasswordForm((prev) => ({
                            ...prev,
                            confirmPassword: e.target.value,
                          }))
                        }
                        placeholder="تکرار رمز عبور جدید"
                        disabled={changingPassword}
                        className={cn(
                          'pe-10',
                          passwordErrors.confirmPassword && 'border-status-critical-fg',
                        )}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="absolute end-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                        aria-label={showConfirmPass ? 'مخفی‌سازی رمز' : 'نمایش رمز'}
                      >
                        <Icon
                          name={showConfirmPass ? 'visibility' : 'visibility'}
                          size={18}
                          data-slot="icon"
                        />
                      </button>
                    </div>
                    {passwordErrors.confirmPassword ? (
                      <p className="text-label-sm text-status-critical-fg">
                        {passwordErrors.confirmPassword}
                      </p>
                    ) : null}
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex justify-end border-t border-border-subtle pt-4">
                <Button
                  type="submit"
                  variant="outline"
                  disabled={changingPassword}
                >
                  {changingPassword ? (
                    <>
                      <Icon name="progress_activity" size={18} className="animate-spin" data-slot="icon" />
                      در حال تغییر رمز…
                    </>
                  ) : (
                    <>
                      <Icon name="lock_reset" size={18} data-slot="icon" />
                      تغییر رمز عبور
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
      )}
    </AppShell>
  )
}
