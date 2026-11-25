'use client'

import * as React from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { AlertBanner } from '@/components/shared/alert-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAppearance } from '@/lib/settings/appearance-context'
import {
  fetchSystemSettings,
  fallbackDefaultSettings,
  saveSystemSettings,
  testTTACConnection,
} from '@/lib/settings/data-access'
import type { SystemSettings, TestTTACResult } from '@/lib/types/settings'
import { getSettingsNavItems } from './nav'
import { toast } from 'sonner'

export function SettingsView({ initialSettings }: { initialSettings?: SystemSettings }) {
  const { appearance, updateAppearance, resetAppearance } = useAppearance()
  const [settings, setSettings] = React.useState<SystemSettings>(
    initialSettings || fallbackDefaultSettings,
  )
  const [dirty, setDirty] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [testingTTAC, setTestingTTAC] = React.useState(false)
  const [ttacTestResult, setTtacTestResult] = React.useState<TestTTACResult | null>(null)

  React.useEffect(() => {
    if (!initialSettings) {
      void fetchSystemSettings().then((res) => {
        setSettings(res)
      })
    }
  }, [initialSettings])

  const handleIdentityChange = (field: keyof SystemSettings['pharmacyIdentity'], value: string) => {
    setSettings((prev) => ({
      ...prev,
      pharmacyIdentity: { ...prev.pharmacyIdentity, [field]: value },
    }))
    setDirty(true)
  }

  const handleRulesChange = (
    field: keyof SystemSettings['inventoryRules'],
    value: number | boolean,
  ) => {
    setSettings((prev) => ({
      ...prev,
      inventoryRules: { ...prev.inventoryRules, [field]: value },
    }))
    setDirty(true)
  }

  const handleTTACChange = (
    field: keyof SystemSettings['ttacIntegration'],
    value: string | number | boolean,
  ) => {
    setSettings((prev) => ({
      ...prev,
      ttacIntegration: { ...prev.ttacIntegration, [field]: value },
    }))
    setDirty(true)
  }

  const handleSecurityChange = (
    field: keyof SystemSettings['securityConfig'],
    value: number | boolean,
  ) => {
    setSettings((prev) => ({
      ...prev,
      securityConfig: { ...prev.securityConfig, [field]: value },
    }))
    setDirty(true)
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setSaving(true)
    try {
      const res = await saveSystemSettings({
        pharmacyIdentity: settings.pharmacyIdentity,
        inventoryRules: settings.inventoryRules,
        ttacIntegration: settings.ttacIntegration,
        securityConfig: settings.securityConfig,
      })
      setSettings(res)
      setDirty(false)
      toast.success('تنظیمات با موفقیت ذخیره و در سیستم اعمال شد.')
    } catch {
      toast.error('خطا در ذخیره تنظیمات.')
    } finally {
      setSaving(false)
    }
  }

  const handleRunTtacTest = async () => {
    setTestingTTAC(true)
    setTtacTestResult(null)
    try {
      const res = await testTTACConnection()
      setTtacTestResult(res)
      if (res.success) {
        toast.success(`ارتباط با تیتک برقرار شد (تأخیر: ${res.latencyMs} میلی‌ثانیه).`)
      } else {
        toast.error('ارتباط با تیتک برقرار نشد.')
      }
    } catch {
      toast.error('خطا در تست اتصال تیتک.')
    } finally {
      setTestingTTAC(false)
    }
  }

  return (
    <AppShell
      navItems={getSettingsNavItems()}
      header={{
        branchLabel: settings.pharmacyIdentity.branchNameFa || 'شعبه مرکزی',
        searchPlaceholder: 'جستجوی تنظیمات، کد یا آدرس...',
      }}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 tablet:p-6" dir="rtl">
        {/* Main Header Card */}
        <div className="flex flex-col gap-4 rounded-card border border-border-default bg-surface p-6 shadow-sm tablet:flex-row tablet:items-center tablet:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-default bg-primary-tint text-primary">
                <Icon name="tune" size={24} />
              </span>
              <h1 className="text-heading-xl font-bold text-text-primary">
                تنظیمات سیستم و انبار دارو
              </h1>
              {dirty ? (
                <Badge variant="outline" className="border-warning bg-warning/10 text-warning">
                  تغییرات ذخیره‌نشده
                </Badge>
              ) : (
                <Badge variant="outline" className="text-text-muted">
                  همگام با پایگاه داده
                </Badge>
              )}
            </div>
            <p className="text-body-sm text-text-muted">
              پیکربندی هویت داروخانه، آستانه‌های هشدار انقضا، قوانین FEFO، اتصال سامانه تیتک و کنترل‌های امنیتی
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="default"
              onClick={() => void handleSave()}
              disabled={saving || !dirty}
              className="gap-2"
            >
              <Icon name="save" size={18} />
              <span>{saving ? 'در حال ذخیره‌سازی...' : 'ذخیره تغییرات'}</span>
            </Button>
          </div>
        </div>

        {dirty ? (
          <AlertBanner
            tone="warning"
            title="تغییرات شما هنوز ذخیره نشده‌اند"
            description="برای اعمال دائمی تنظیمات بر روی تمامی فرآیندهای انبارداری و سربرگ‌های چاپی، دکمه ذخیره تغییرات را بزنید."
          />
        ) : null}

        {/* Tabs Interface */}
        <Tabs defaultValue="identity" className="w-full">
          <TabsList className="mb-4 grid grid-cols-2 tablet:grid-cols-5">
            <TabsTrigger value="identity" className="gap-2">
              <Icon name="domain" size={18} />
              <span>هویت و چاپ اسناد</span>
            </TabsTrigger>
            <TabsTrigger value="rules" className="gap-2">
              <Icon name="warehouse" size={18} />
              <span>قوانین انبار و FEFO</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2">
              <Icon name="palette" size={18} />
              <span>ظاهر و رابط کاربری</span>
            </TabsTrigger>
            <TabsTrigger value="ttac" className="gap-2">
              <Icon name="hub" size={18} />
              <span>سامانه تیتک (TTAC)</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Icon name="policy" size={18} />
              <span>امنیت و ممیزی</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Identity & Print */}
          <TabsContent value="identity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-heading-md">مشخصات رسمی داروخانه و سربرگ</CardTitle>
                <CardDescription>
                  این اطلاعات در سربرگ اسناد رسمی، فاکتورها، حواله‌های خروج و هدر بالای سامانه درج می‌شوند.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="pharmacy-name">نام داروخانه</Label>
                    <Input
                      id="pharmacy-name"
                      value={settings.pharmacyIdentity.nameFa}
                      onChange={(e) => handleIdentityChange('nameFa', e.target.value)}
                      placeholder="مثال: داروخانه دکتر حسینی"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="branch-name">نام شعبه انبار</Label>
                    <Input
                      id="branch-name"
                      value={settings.pharmacyIdentity.branchNameFa}
                      onChange={(e) => handleIdentityChange('branchNameFa', e.target.value)}
                      placeholder="مثال: شعبه مرکزی"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="technical-officer">نام و نام خانوادگی مسئول فنی</Label>
                    <Input
                      id="technical-officer"
                      value={settings.pharmacyIdentity.technicalOfficer}
                      onChange={(e) => handleIdentityChange('technicalOfficer', e.target.value)}
                      placeholder="دکتر داروساز مسئول فنی"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="med-council-no">کد نظام پزشکی مسئول فنی</Label>
                    <Input
                      id="med-council-no"
                      value={settings.pharmacyIdentity.medicalCouncilNo}
                      onChange={(e) => handleIdentityChange('medicalCouncilNo', e.target.value)}
                      placeholder="مثال: د-۱۲۳۴۵"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="license-number">شماره پروانه تاسیس داروخانه</Label>
                    <Input
                      id="license-number"
                      value={settings.pharmacyIdentity.licenseNumber}
                      onChange={(e) => handleIdentityChange('licenseNumber', e.target.value)}
                      placeholder="شماره پروانه وزارت بهداشت"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">شماره تلفن تماس انبار</Label>
                    <Input
                      id="phone"
                      value={settings.pharmacyIdentity.phone}
                      onChange={(e) => handleIdentityChange('phone', e.target.value)}
                      placeholder="۰۲۱-۸۸۷۷۶۶۵۵"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">نشانی دقیق ثبتی انبار / داروخانه</Label>
                  <Input
                    id="address"
                    value={settings.pharmacyIdentity.address}
                    onChange={(e) => handleIdentityChange('address', e.target.value)}
                    placeholder="تهران، خیابان ولیعصر..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="footer-notice">متن پاورقی پیش‌فرض اسناد چاپی</Label>
                  <Textarea
                    id="footer-notice"
                    rows={3}
                    value={settings.pharmacyIdentity.printFooterNotice}
                    onChange={(e) => handleIdentityChange('printFooterNotice', e.target.value)}
                    placeholder="متن اخطار یا رهگیری چاپ‌شده ذیل تمامی حواله‌ها و رسیدها..."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Inventory Rules & FEFO */}
          <TabsContent value="rules" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-heading-md">آستانه‌های هشدار انقضا (روز مانده تا انقضا)</CardTitle>
                <CardDescription>
                  تعیین بازه‌های زمانی برای شناسایی خودکار اقلام بحرانی، مشمول اخطار و تحت پایش.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 tablet:grid-cols-3">
                  <div className="space-y-2 rounded-default border border-status-critical-border bg-status-critical-bg p-4">
                    <Label htmlFor="crit-expiry" className="text-status-critical-fg font-semibold">
                      آستانه بحرانی (قرمز)
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="crit-expiry"
                        type="number"
                        min={1}
                        value={settings.inventoryRules.criticalExpiryDays}
                        onChange={(e) =>
                          handleRulesChange('criticalExpiryDays', parseInt(e.target.value) || 30)
                        }
                      />
                      <span className="text-body-sm text-text-muted">روز</span>
                    </div>
                    <p className="text-label-sm text-text-muted">معمولاً کمتر از ۱ ماه تا انقضا</p>
                  </div>

                  <div className="space-y-2 rounded-default border border-status-warning-border bg-status-warning-bg p-4">
                    <Label htmlFor="warn-expiry" className="text-status-warning-fg font-semibold">
                      آستانه هشدار (زرد)
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="warn-expiry"
                        type="number"
                        min={1}
                        value={settings.inventoryRules.warningExpiryDays}
                        onChange={(e) =>
                          handleRulesChange('warningExpiryDays', parseInt(e.target.value) || 90)
                        }
                      />
                      <span className="text-body-sm text-text-muted">روز</span>
                    </div>
                    <p className="text-label-sm text-text-muted">معمولاً بین ۱ تا ۳ ماه تا انقضا</p>
                  </div>

                  <div className="space-y-2 rounded-default border border-border-default bg-surface-muted p-4">
                    <Label htmlFor="watch-expiry" className="text-text-primary font-semibold">
                      آستانه پایش دوره (آبی / خاکستری)
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="watch-expiry"
                        type="number"
                        min={1}
                        value={settings.inventoryRules.watchExpiryDays}
                        onChange={(e) =>
                          handleRulesChange('watchExpiryDays', parseInt(e.target.value) || 180)
                        }
                      />
                      <span className="text-body-sm text-text-muted">روز</span>
                    </div>
                    <p className="text-label-sm text-text-muted">معمولاً بین ۳ تا ۶ ماه تا انقضا</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-heading-md">تنظیمات سفارش خودکار و قوانین سخت‌گیرانه</CardTitle>
                <CardDescription>
                  محاسبه پوشش موجودی و ضوابط بالینی انبارداری
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-4 tablet:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="crit-cover">پوشش بحرانی سفارش (روز)</Label>
                    <Input
                      id="crit-cover"
                      type="number"
                      min={1}
                      value={settings.inventoryRules.criticalCoverDays}
                      onChange={(e) =>
                        handleRulesChange('criticalCoverDays', parseInt(e.target.value) || 2)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="low-cover">پوشش کمبود موجودی (روز)</Label>
                    <Input
                      id="low-cover"
                      type="number"
                      min={1}
                      value={settings.inventoryRules.lowCoverDays}
                      onChange={(e) =>
                        handleRulesChange('lowCoverDays', parseInt(e.target.value) || 5)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reorder-cycle">چرخه بازسفارش استاندارد (روز)</Label>
                    <Input
                      id="reorder-cycle"
                      type="number"
                      min={1}
                      value={settings.inventoryRules.reorderCycleDays}
                      onChange={(e) =>
                        handleRulesChange('reorderCycleDays', parseInt(e.target.value) || 14)
                      }
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between rounded-default border border-border-default p-4">
                    <div className="space-y-1">
                      <Label htmlFor="strict-fefo" className="text-body-md font-semibold">
                        الزام خروج قطعی بر مبنای FEFO (اولین انقضا، اولین خروج)
                      </Label>
                      <p className="text-label-sm text-text-muted">
                        در صورت فعال بودن، حواله خروج از سری ساخت دیرتر در حضور سری ساخت نزدیک‌تر مسدود می‌گردد.
                      </p>
                    </div>
                    <Switch
                      id="strict-fefo"
                      checked={settings.inventoryRules.strictFefoEnforced}
                      onCheckedChange={(checked) => handleRulesChange('strictFefoEnforced', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-default border border-border-default p-4">
                    <div className="space-y-1">
                      <Label htmlFor="dual-signoff" className="text-body-md font-semibold">
                        الزام تایید دوم برای داروهای مخدر و تحت کنترل
                      </Label>
                      <p className="text-label-sm text-text-muted">
                        هرگونه خروج یا انتقال داروهای تحت نظارت نیازمند امضای الکترونیک مسئول فنی خواهد بود.
                      </p>
                    </div>
                    <Switch
                      id="dual-signoff"
                      checked={settings.inventoryRules.requireDualSignOff}
                      onCheckedChange={(checked) => handleRulesChange('requireDualSignOff', checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Appearance & UI Preferences */}
          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-2 tablet:flex-row tablet:items-center tablet:justify-between">
                  <div>
                    <CardTitle className="text-heading-md">پوسته رنگی و تم سامانه</CardTitle>
                    <CardDescription>
                      انتخاب پالت رنگی کلینیکال و حالت شب برای شیفت‌های شبانه داروخانه.
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      resetAppearance()
                      toast.info('تنظیمات ظاهری به حالت پیش‌فرض بازگشت.')
                    }}
                    className="gap-2 self-start"
                  >
                    <Icon name="history" size={16} />
                    <span>بازنشانی به پیش‌فرض</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-4 tablet:grid-cols-3">
                  {/* Theme 1: Clinical Light */}
                  <div
                    onClick={() => updateAppearance({ theme: 'clinical-light' })}
                    className={`cursor-pointer rounded-default border p-4 transition-all ${
                      appearance.theme === 'clinical-light'
                        ? 'border-primary ring-2 ring-primary/20 bg-primary-tint/30'
                        : 'border-border-default bg-surface hover:border-border-strong'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-3">
                      <span className="font-semibold text-body-md text-text-primary">
                        کلینیکال روز (پیش‌فرض)
                      </span>
                      {appearance.theme === 'clinical-light' ? (
                        <Icon name="check_circle" size={20} className="text-primary" />
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="size-6 rounded-full border border-teal-600 bg-teal-600" />
                      <span className="size-6 rounded-full border border-slate-200 bg-slate-100" />
                      <span className="size-6 rounded-full border border-emerald-500 bg-emerald-500" />
                    </div>
                    <p className="mt-3 text-label-sm text-text-muted">
                      پوسته استاندارد سبزآبی درمانی، بهینه برای روشنایی روز داروخانه.
                    </p>
                  </div>

                  {/* Theme 2: Hospital Blue */}
                  <div
                    onClick={() => updateAppearance({ theme: 'hospital-blue' })}
                    className={`cursor-pointer rounded-default border p-4 transition-all ${
                      appearance.theme === 'hospital-blue'
                        ? 'border-primary ring-2 ring-primary/20 bg-primary-tint/30'
                        : 'border-border-default bg-surface hover:border-border-strong'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-3">
                      <span className="font-semibold text-body-md text-text-primary">
                        آبی بیمارستانی (کبالت)
                      </span>
                      {appearance.theme === 'hospital-blue' ? (
                        <Icon name="check_circle" size={20} className="text-primary" />
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="size-6 rounded-full border border-blue-600 bg-blue-600" />
                      <span className="size-6 rounded-full border border-blue-200 bg-blue-100" />
                      <span className="size-6 rounded-full border border-emerald-500 bg-emerald-500" />
                    </div>
                    <p className="mt-3 text-label-sm text-text-muted">
                      کنتراست بالاتر برای مانیتورهای صنعتی انبار و خوانایی سریع‌تر.
                    </p>
                  </div>

                  {/* Theme 3: Dark Mode */}
                  <div
                    onClick={() => updateAppearance({ theme: 'clinical-dark' })}
                    className={`cursor-pointer rounded-default border p-4 transition-all ${
                      appearance.theme === 'clinical-dark'
                        ? 'border-primary ring-2 ring-primary/20 bg-primary-tint/30'
                        : 'border-border-default bg-surface hover:border-border-strong'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-3">
                      <span className="font-semibold text-body-md text-text-primary">
                        حالت شب (تاریک ملایم)
                      </span>
                      {appearance.theme === 'clinical-dark' ? (
                        <Icon name="check_circle" size={20} className="text-primary" />
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="size-6 rounded-full border border-slate-700 bg-slate-900" />
                      <span className="size-6 rounded-full border border-teal-500 bg-teal-500" />
                      <span className="size-6 rounded-full border border-slate-800 bg-slate-800" />
                    </div>
                    <p className="mt-3 text-label-sm text-text-muted">
                      کاهش خیرگی نور و خستگی چشم برای کشیک و شیفت شب انبار.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-heading-md">تراکم چیدمان و خوانایی متن</CardTitle>
                <CardDescription>
                  تنظیم فواصل ردیف‌های جداول، اندازه قلم و چیدمان سایدبار
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-6 tablet:grid-cols-2">
                  {/* Density */}
                  <div className="space-y-3">
                    <Label className="text-body-md font-semibold">تراکم سطرهای جدول و داده‌ها</Label>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant={appearance.density === 'comfortable' ? 'default' : 'outline'}
                        onClick={() => updateAppearance({ density: 'comfortable' })}
                        className="flex-1 gap-2"
                      >
                        <Icon name="view_agenda" size={18} />
                        <span>عادی (پیش‌فرض)</span>
                      </Button>
                      <Button
                        type="button"
                        variant={appearance.density === 'compact' ? 'default' : 'outline'}
                        onClick={() => updateAppearance({ density: 'compact' })}
                        className="flex-1 gap-2"
                      >
                        <Icon name="density_small" size={18} />
                        <span>فشرده (اقلام بیشتر)</span>
                      </Button>
                    </div>
                    <p className="text-label-sm text-text-muted">
                      حالت فشرده ارتفاع ردیف‌های کاردکس و قفسه‌ها را برای مشاهده اقلام بیشتر کاهش می‌دهد.
                    </p>
                  </div>

                  {/* Font Size */}
                  <div className="space-y-3">
                    <Label className="text-body-md font-semibold">اندازه قلم و متون سیستم</Label>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant={appearance.fontSize === 'standard' ? 'default' : 'outline'}
                        onClick={() => updateAppearance({ fontSize: 'standard' })}
                        className="flex-1 gap-2"
                      >
                        <Icon name="format_size" size={18} />
                        <span>استاندارد (۱۰۰٪)</span>
                      </Button>
                      <Button
                        type="button"
                        variant={appearance.fontSize === 'large' ? 'default' : 'outline'}
                        onClick={() => updateAppearance({ fontSize: 'large' })}
                        className="flex-1 gap-2"
                      >
                        <Icon name="text_increase" size={18} />
                        <span>درشت‌تر (۱۰۶٪)</span>
                      </Button>
                    </div>
                    <p className="text-label-sm text-text-muted">
                      افزایش خوانایی نام ژنریک داروها و دوزها از فواصل دورتر از صفحه مانیتور.
                    </p>
                  </div>
                </div>

                {/* Live Preview Box */}
                <div className="rounded-default border border-border-default bg-surface-muted p-4">
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-label-sm font-semibold text-text-secondary">
                      پیش‌نمایش زنده جدول با تنظیمات جاری:
                    </span>
                    <Badge variant="outline" className="text-label-sm">
                      {appearance.theme} / {appearance.density}
                    </Badge>
                  </div>
                  <div className="overflow-hidden rounded border border-border-default bg-surface">
                    <table className="w-full text-start text-body-sm">
                      <thead className="border-b border-border-default bg-surface-muted text-text-secondary">
                        <tr>
                          <th className="px-cell-x py-2 text-start">کد ژنریک</th>
                          <th className="px-cell-x py-2 text-start">نام فرآورده دارویی</th>
                          <th className="px-cell-x py-2 text-start">سری ساخت</th>
                          <th className="px-cell-x py-2 text-start">موجودی</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        <tr className="h-table-row hover:bg-surface-hover">
                          <td className="px-cell-x py-1 font-mono text-text-muted">01244</td>
                          <td className="px-cell-x py-1 font-semibold text-text-primary">
                            آمپرول ۵۰۰ میلی‌گرم کپسول
                          </td>
                          <td className="px-cell-x py-1 font-mono">B-4409</td>
                          <td className="px-cell-x py-1 text-primary font-bold">۱,۲۰۰ عدد</td>
                        </tr>
                        <tr className="h-table-row hover:bg-surface-hover">
                          <td className="px-cell-x py-1 font-mono text-text-muted">08911</td>
                          <td className="px-cell-x py-1 font-semibold text-text-primary">
                            سفکسیم ۴۰۰ میلی‌گرم قرص
                          </td>
                          <td className="px-cell-x py-1 font-mono">B-9912</td>
                          <td className="px-cell-x py-1 text-primary font-bold">۴۵۰ عدد</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 4: TTAC Integration */}
          <TabsContent value="ttac" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-2 tablet:flex-row tablet:items-center tablet:justify-between">
                  <div>
                    <CardTitle className="text-heading-md">درگاه استعلام و اصالت‌سنجی تیتک (TTAC)</CardTitle>
                    <CardDescription>
                      پیکربندی وب‌سرویس سازمان غذا و دارو برای استعلام بارکد، GTIN و سری ساخت.
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleRunTtacTest()}
                    disabled={testingTTAC}
                    className="gap-2 self-start"
                  >
                    <Icon name="cell_tower" size={18} />
                    <span>{testingTTAC ? 'در حال آزمون...' : 'آزمون اتصال به سامانه'}</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {ttacTestResult ? (
                  <AlertBanner
                    tone={ttacTestResult.success ? 'valid' : 'critical'}
                    title={ttacTestResult.success ? 'اتصال موفق' : 'خطا در برقراری ارتباط'}
                    description={`${ttacTestResult.message} (تأخیر: ${ttacTestResult.latencyMs} میلی‌ثانیه)`}
                  />
                ) : null}

                <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ttac-url">آدرس پایه وب‌سرویس (Base URL)</Label>
                    <Input
                      id="ttac-url"
                      value={settings.ttacIntegration.baseUrl}
                      onChange={(e) => handleTTACChange('baseUrl', e.target.value)}
                      placeholder="https://newapi.ttac.ir"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ttac-timeout">مهلت زمانی پاسخ (Timeout بر حسب میلی‌ثانیه)</Label>
                    <Input
                      id="ttac-timeout"
                      type="number"
                      step={500}
                      min={500}
                      value={settings.ttacIntegration.timeoutMs}
                      onChange={(e) =>
                        handleTTACChange('timeoutMs', parseInt(e.target.value) || 5000)
                      }
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cache-ttl">مدت ماندگاری کش محلی استعلامات (ساعت)</Label>
                    <Input
                      id="cache-ttl"
                      type="number"
                      min={1}
                      value={settings.ttacIntegration.cacheTtlHours}
                      onChange={(e) =>
                        handleTTACChange('cacheTtlHours', parseInt(e.target.value) || 24)
                      }
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-default border border-border-default p-4">
                  <div className="space-y-1">
                    <Label htmlFor="live-ttac" className="text-body-md font-semibold">
                      استعلام زنده تیتک در فرم‌های ورود کالا و کاتالوگ
                    </Label>
                    <p className="text-label-sm text-text-muted">
                      در صورت غیرفعال بودن، استعلام فقط از کش دیتابیس محلی انجام می‌شود.
                    </p>
                  </div>
                  <Switch
                    id="live-ttac"
                    checked={settings.ttacIntegration.liveLookupActive}
                    onCheckedChange={(checked) => handleTTACChange('liveLookupActive', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 4: Security & Audit */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-heading-md">سیاست‌های امنیتی، نشست و ممیزی</CardTitle>
                <CardDescription>
                  مدیریت نشست‌های کاربری و ثبت ردپای تغییرات در لاگ بازرسی قانونی.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="session-timeout">مدت انقضای نشست فعال کاربر (ساعت)</Label>
                    <Input
                      id="session-timeout"
                      type="number"
                      min={1}
                      max={72}
                      value={settings.securityConfig.sessionTimeoutHours}
                      onChange={(e) =>
                        handleSecurityChange('sessionTimeoutHours', parseInt(e.target.value) || 12)
                      }
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between rounded-default border border-border-default p-4">
                    <div className="space-y-1">
                      <Label htmlFor="audit-all" className="text-body-md font-semibold">
                        ثبت کامل رویدادهای تغییر تنظیمات در Audit Log
                      </Label>
                      <p className="text-label-sm text-text-muted">
                        ثبت شناسه کاربر، آدرس IP و مقادیر قبل/بعد در زنجیره ممیزی غیرقابل تغییر.
                      </p>
                    </div>
                    <Switch
                      id="audit-all"
                      checked={settings.securityConfig.auditAllMutations}
                      onCheckedChange={(checked) => handleSecurityChange('auditAllMutations', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-default border border-border-default p-4">
                    <div className="space-y-1">
                      <Label htmlFor="strong-pw" className="text-body-md font-semibold">
                        الزام استفاده از گذرواژه پیچیده برای پرسنل انبار
                      </Label>
                      <p className="text-label-sm text-text-muted">
                        شامل حداقل ۸ کاراکتر با حروف کوچک، بزرگ و اعداد.
                      </p>
                    </div>
                    <Switch
                      id="strong-pw"
                      checked={settings.securityConfig.enforceStrongPassword}
                      onCheckedChange={(checked) =>
                        handleSecurityChange('enforceStrongPassword', checked)
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
