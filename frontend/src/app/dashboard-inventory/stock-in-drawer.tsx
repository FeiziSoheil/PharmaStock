'use client'

import * as React from 'react'
import { toast } from 'sonner'
import {
  Badge,
  Button,
  DatePicker,
  Icon,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@/components/ui'
import { SideDrawer } from '@/components/shared'
import {
  DOSAGE_FORMS,
  DRUG_CATEGORIES,
  type Drug,
  type TtacLookupState,
} from '@/lib/types/drugs'
import type { ShelfBin } from '@/lib/types/shelves'
import {
  fetchCatalogOptions,
  fetchShelfBinOptions,
  lookupTtacForStockIn,
  submitStockIn,
} from '@/lib/inventory/data-access'
import {
  validateStockInForm,
  type StockInFieldErrors,
  type StockInFormValues,
} from '@/lib/inventory/helpers'
import { ApiError } from '@/lib/api/http'

const UNIT_OPTIONS = [
  'جعبه / بسته',
  'ویال / آمپول',
  'شیشه شربت',
  'ساشه / پودر',
  'قلم',
  'عدد',
] as const

const STORAGE_OPTIONS = [
  { value: 'room', label: 'دمای معمول اتاق', note: '۱۵ الی ۲۵ درجه سانتی‌گراد', icon: 'thermostat' as const },
  { value: 'fridge', label: 'یخچال دارویی', note: '۲ الی ۸ درجه سانتی‌گراد', icon: 'ac_unit' as const },
  { value: 'light', label: 'محافظت از نور', note: 'نگهداری دور از تابش', icon: 'light_mode' as const },
  { value: 'freezer', label: 'فریزر دارویی', note: 'زیر صفر درجه', icon: 'severe_cold' as const },
] as const

const INITIAL_VALUES: StockInFormValues = {
  mode: 'existing',
  drugId: '',
  nameFa: '',
  brandName: '',
  dosageForm: 'قرص',
  strength: '',
  category: DRUG_CATEGORIES[0],
  genericCode: '',
  gtin: '',
  manufacturer: '',
  isControlled: false,
  storageTemp: 'room',
  reorderLevel: '20',
  batchNo: '',
  expiry: '',
  quantity: '',
  unitLabel: 'جعبه / بسته',
  binId: '',
  locationLabel: '',
  buyPriceRial: '',
  consumerPriceRial: '',
}

export type StockInDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function StockInDrawer({
  open,
  onOpenChange,
  onSuccess,
}: StockInDrawerProps) {
  const [values, setValues] = React.useState<StockInFormValues>(INITIAL_VALUES)
  const [errors, setErrors] = React.useState<StockInFieldErrors>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [ttacQuery, setTtacQuery] = React.useState('')
  const [ttacState, setTtacState] = React.useState<TtacLookupState>({ status: 'idle' })

  const [drugs, setDrugs] = React.useState<Drug[]>([])
  const [bins, setBins] = React.useState<ShelfBin[]>([])
  const [optionsLoaded, setOptionsLoaded] = React.useState(false)
  const [optionsLoading, setOptionsLoading] = React.useState(false)

  // Lazy-load catalog drugs & shelf bins only when the drawer is opened.
  React.useEffect(() => {
    if (!open || optionsLoaded) return
    let cancelled = false
    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      setOptionsLoading(true)
      try {
        const [drugList, binList] = await Promise.all([
          fetchCatalogOptions(),
          fetchShelfBinOptions(),
        ])
        if (cancelled) return
        setDrugs(drugList)
        setBins(binList)
        setOptionsLoaded(true)
        if (drugList.length > 0 && !values.drugId) {
          const first = drugList[0]!
          setValues((prev) => ({
            ...prev,
            drugId: first.id,
            storageTemp: first.storageTemp ?? 'room',
            reorderLevel: String(first.reorderLevel ?? 20),
          }))
        }
        if (binList.length > 0 && !values.binId) {
          setValues((prev) => ({
            ...prev,
            binId: binList[0]!.id,
            locationLabel: binList[0]!.address,
          }))
        }
      } catch {
        if (!cancelled) {
          toast.error('بارگذاری فهرست داروها یا قفسه‌ها ناموفق بود.')
        }
      } finally {
        if (!cancelled) setOptionsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, optionsLoaded, values.binId, values.drugId])

  const setField = <K extends keyof StockInFormValues>(
    key: K,
    val: StockInFormValues[K],
  ) => {
    setValues((prev) => ({ ...prev, [key]: val }))
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }

  const handleSelectDrug = (drugId: string) => {
    const found = drugs.find((d) => d.id === drugId)
    setValues((prev) => ({
      ...prev,
      drugId,
      storageTemp: found?.storageTemp ?? prev.storageTemp,
      reorderLevel: found ? String(found.reorderLevel) : prev.reorderLevel,
    }))
    setErrors((prev) => ({ ...prev, drugId: undefined }))
  }

  const handleSelectBin = (binId: string) => {
    const found = bins.find((b) => b.id === binId)
    setValues((prev) => ({
      ...prev,
      binId,
      locationLabel: found?.address ?? prev.locationLabel,
    }))
    setErrors((prev) => ({ ...prev, binId: undefined }))
  }

  const handleTtacLookup = async () => {
    const q = ttacQuery.trim() || values.gtin.trim() || values.genericCode.trim()
    if (!q) {
      setTtacState({ status: 'error', message: 'کد IRC یا بارکد GTIN را وارد کنید.' })
      return
    }
    setTtacState({ status: 'loading' })
    const res = await lookupTtacForStockIn(q)
    setTtacState(res)
    if (res.status === 'found') {
      const p = res.product
      setValues((prev) => ({
        ...prev,
        mode: 'new',
        nameFa: p.nameFa || prev.nameFa,
        brandName: p.brandName || prev.brandName,
        dosageForm:
          p.dosageForm && (DOSAGE_FORMS as readonly string[]).includes(p.dosageForm)
            ? p.dosageForm
            : prev.dosageForm,
        strength: p.strength || prev.strength,
        category:
          p.category && (DRUG_CATEGORIES as readonly string[]).includes(p.category)
            ? p.category
            : prev.category,
        gtin: p.gtin || prev.gtin,
        genericCode: p.genericCode || p.irc || prev.genericCode,
        manufacturer: p.manufacturer || prev.manufacturer,
      }))
      toast.success('مشخصات فرآورده از تیتک بازیابی شد.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nextErrors = validateStockInForm(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      const firstKey = Object.keys(nextErrors)[0]
      document.getElementById(`stock-in-${firstKey}`)?.focus()
      return
    }

    setSubmitting(true)
    try {
      const res = await submitStockIn({
        drugId: values.mode === 'existing' ? values.drugId : undefined,
        nameFa: values.mode === 'new' ? values.nameFa.trim() : undefined,
        brandName: values.mode === 'new' ? values.brandName.trim() : undefined,
        dosageForm: values.mode === 'new' ? values.dosageForm : undefined,
        strength: values.mode === 'new' ? values.strength.trim() : undefined,
        category: values.mode === 'new' ? values.category : undefined,
        genericCode: values.mode === 'new' ? values.genericCode.trim() : undefined,
        gtin: values.mode === 'new' ? values.gtin.trim() : undefined,
        manufacturer: values.mode === 'new' ? values.manufacturer.trim() : undefined,
        isControlled: values.mode === 'new' ? values.isControlled : undefined,
        storageTemp: values.storageTemp,
        reorderLevel: Number(values.reorderLevel || 0),
        batchNo: values.batchNo.trim(),
        expiry: values.expiry.trim(),
        quantity: Number(values.quantity),
        unitLabel: values.unitLabel,
        binId: values.binId || undefined,
        locationLabel: values.locationLabel.trim() || undefined,
        buyPriceRial: values.buyPriceRial ? Number(values.buyPriceRial) : undefined,
        consumerPriceRial: values.consumerPriceRial
          ? Number(values.consumerPriceRial)
          : undefined,
      })

      toast.success(
        res.createdNewDrug
          ? `داروی «${res.drug.nameFa}» و سری ساخت ${res.batch.batchNo} با موفقیت در کاردکس انبار ثبت شد.`
          : `سری ساخت ${res.batch.batchNo} برای «${res.drug.nameFa}» با موفقیت وارد انبار شد.`,
      )
      setValues({
        ...INITIAL_VALUES,
        drugId: drugs[0]?.id ?? '',
        binId: bins[0]?.id ?? '',
        locationLabel: bins[0]?.address ?? '',
      })
      setErrors({})
      setOptionsLoaded(false)
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message)
      } else {
        toast.error('ثبت ورود دارو به انبار با خطا مواجه شد.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="ورود داروی جدید به انبار"
      description="تخصیص بچ، استانداردهای نگهداری و موقعیت انبارش"
      footer={
        open ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              انصراف
            </Button>
            <Button
              type="submit"
              form="stock-in-form"
              disabled={submitting}
            >
              <Icon name="check_circle" size={18} data-slot="icon" />
              {submitting ? 'در حال ثبت...' : 'ثبت و افزودن به کاردکس انبار'}
            </Button>
          </>
        ) : null
      }
    >
      {open ? (
      <form
        id="stock-in-form"
        onSubmit={handleSubmit}
        className="space-y-4"
        noValidate
      >
        <div
          role="tablist"
          aria-label="نوع ثبت ورودی"
          className="grid grid-cols-2 gap-2 rounded-default bg-surface-muted p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={values.mode === 'existing'}
            className={
              values.mode === 'existing'
                ? 'rounded-sm bg-surface px-3 py-2 text-label-md font-semibold text-primary border border-border-default'
                : 'rounded-sm px-3 py-2 text-label-md text-text-secondary hover:text-text-primary'
            }
            onClick={() => setField('mode', 'existing')}
          >
            انتخاب از کاتالوگ موجود
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={values.mode === 'new'}
            className={
              values.mode === 'new'
                ? 'rounded-sm bg-surface px-3 py-2 text-label-md font-semibold text-primary border border-border-default'
                : 'rounded-sm px-3 py-2 text-label-md text-text-secondary hover:text-text-primary'
            }
            onClick={() => setField('mode', 'new')}
          >
            ثبت داروی جدید + ورود بچ
          </button>
        </div>

        {values.mode === 'existing' ? (
          <div className="space-y-1.5">
            <Label htmlFor="stock-in-drugId">
              انتخاب دارو از کاتالوگ <span className="text-status-critical-fg">*</span>
            </Label>
            <Select
              value={values.drugId}
              onValueChange={handleSelectDrug}
              disabled={optionsLoading}
            >
              <SelectTrigger
                id="stock-in-drugId"
                aria-invalid={Boolean(errors.drugId)}
              >
                <SelectValue
                  placeholder={
                    optionsLoading ? 'در حال بارگذاری داروها...' : 'یک دارو انتخاب کنید'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {drugs.map((drug) => (
                    <SelectItem key={drug.id} value={drug.id}>
                      {drug.nameFa} ({drug.dosageForm} {drug.strength})
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {errors.drugId ? (
              <p className="text-label-sm text-status-critical-fg">{errors.drugId}</p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3 rounded-default border border-border-default bg-surface-muted/40 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1">
                <Label htmlFor="stock-in-ttac">استعلام سریع از سامانه تیتک (TTAC)</Label>
                <Input
                  id="stock-in-ttac"
                  dir="ltr"
                  value={ttacQuery}
                  onChange={(e) => setTtacQuery(e.target.value)}
                  placeholder="IRC یا GTIN..."
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleTtacLookup()}
                disabled={ttacState.status === 'loading'}
              >
                <Icon name="qr_code_scanner" size={18} data-slot="icon" />
                {ttacState.status === 'loading' ? 'در حال استعلام...' : 'استعلام تیتک'}
              </Button>
            </div>
            {ttacState.status === 'not_found' ? (
              <p className="text-label-sm text-status-warning-fg">
                فرآورده‌ای در کش تیتک یافت نشد؛ مشخصات را دستی وارد کنید.
              </p>
            ) : ttacState.status === 'error' ? (
              <p className="text-label-sm text-status-critical-fg">{ttacState.message}</p>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="stock-in-nameFa">
                نام رسمی فارسی دارو <span className="text-status-critical-fg">*</span>
              </Label>
              <Input
                id="stock-in-nameFa"
                value={values.nameFa}
                onChange={(e) => setField('nameFa', e.target.value)}
                placeholder="مثال: کپسول آموکسی‌سیلین ۵۰۰ میلی‌گرم"
                aria-invalid={Boolean(errors.nameFa)}
              />
              {errors.nameFa ? (
                <p className="text-label-sm text-status-critical-fg">{errors.nameFa}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="stock-in-brandName">نام برند / ژنریک لاتین</Label>
                <Input
                  id="stock-in-brandName"
                  dir="ltr"
                  value={values.brandName}
                  onChange={(e) => setField('brandName', e.target.value)}
                  placeholder="Amoxicillin 500mg"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stock-in-strength">
                  دوز و قدرت اثر <span className="text-status-critical-fg">*</span>
                </Label>
                <Input
                  id="stock-in-strength"
                  dir="ltr"
                  value={values.strength}
                  onChange={(e) => setField('strength', e.target.value)}
                  placeholder="500mg"
                  aria-invalid={Boolean(errors.strength)}
                />
                {errors.strength ? (
                  <p className="text-label-sm text-status-critical-fg">{errors.strength}</p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="stock-in-dosageForm">
                  شکل دارویی <span className="text-status-critical-fg">*</span>
                </Label>
                <Select
                  value={values.dosageForm}
                  onValueChange={(val) => setField('dosageForm', val)}
                >
                  <SelectTrigger id="stock-in-dosageForm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {DOSAGE_FORMS.map((form) => (
                        <SelectItem key={form} value={form}>
                          {form}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stock-in-category">
                  دسته درمانی <span className="text-status-critical-fg">*</span>
                </Label>
                <Select
                  value={values.category}
                  onValueChange={(val) => setField('category', val)}
                >
                  <SelectTrigger id="stock-in-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {DRUG_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="stock-in-genericCode">کد IRC / ژنریک</Label>
                <Input
                  id="stock-in-genericCode"
                  dir="ltr"
                  value={values.genericCode}
                  onChange={(e) => setField('genericCode', e.target.value)}
                  placeholder="IRC-00000000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stock-in-gtin">بارکد GTIN / UID</Label>
                <Input
                  id="stock-in-gtin"
                  dir="ltr"
                  value={values.gtin}
                  onChange={(e) => setField('gtin', e.target.value)}
                  placeholder="6260000000000"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-default border border-border-default bg-surface px-3 py-2">
              <div>
                <div className="text-label-md font-medium text-text-primary">
                  داروی تحت کنترل / مخدر
                </div>
                <div className="text-label-sm text-text-secondary">
                  ثبت در دفترچه داروهای تحت نظارت
                </div>
              </div>
              <Switch
                checked={values.isControlled}
                onCheckedChange={(checked) => setField('isControlled', checked)}
                aria-label="داروی تحت کنترل"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="stock-in-batchNo">
              شماره سری ساخت (Batch No) <span className="text-status-critical-fg">*</span>
            </Label>
            <Input
              id="stock-in-batchNo"
              dir="ltr"
              value={values.batchNo}
              onChange={(e) => setField('batchNo', e.target.value)}
              placeholder="BATCH-2026-X"
              aria-invalid={Boolean(errors.batchNo)}
            />
            {errors.batchNo ? (
              <p className="text-label-sm text-status-critical-fg">{errors.batchNo}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="stock-in-expiry">
              تاریخ انقضای شمسی <span className="text-status-critical-fg">*</span>
            </Label>
            <DatePicker
              id="stock-in-expiry"
              value={values.expiry}
              onChange={(iso) => setField('expiry', iso)}
              placeholder="انتخاب تاریخ انقضا"
              aria-invalid={Boolean(errors.expiry)}
            />
            {errors.expiry ? (
              <p className="text-label-sm text-status-critical-fg">{errors.expiry}</p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="stock-in-quantity">
              تعداد ورودی به انبار <span className="text-status-critical-fg">*</span>
            </Label>
            <Input
              id="stock-in-quantity"
              type="number"
              min={1}
              dir="ltr"
              value={values.quantity}
              onChange={(e) => setField('quantity', e.target.value)}
              placeholder="100"
              aria-invalid={Boolean(errors.quantity)}
            />
            {errors.quantity ? (
              <p className="text-label-sm text-status-critical-fg">{errors.quantity}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="stock-in-unitLabel">واحد شمارش</Label>
            <Select
              value={values.unitLabel}
              onValueChange={(val) => setField('unitLabel', val)}
            >
              <SelectTrigger id="stock-in-unitLabel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {UNIT_OPTIONS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="stock-in-binId">
              موقعیت انبارش فیزیکی (قفسه) <span className="text-status-critical-fg">*</span>
            </Label>
            <Select
              value={values.binId}
              onValueChange={handleSelectBin}
              disabled={optionsLoading}
            >
              <SelectTrigger
                id="stock-in-binId"
                aria-invalid={Boolean(errors.binId)}
              >
                <SelectValue placeholder="انتخاب قفسه" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {bins.map((bin) => (
                    <SelectItem key={bin.id} value={bin.id}>
                      {bin.address} — {bin.zoneLabel}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {errors.binId ? (
              <p className="text-label-sm text-status-critical-fg">{errors.binId}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="stock-in-reorderLevel">نقطه هشدار سفارش مجدد (ROP)</Label>
            <Input
              id="stock-in-reorderLevel"
              type="number"
              min={0}
              dir="ltr"
              value={values.reorderLevel}
              onChange={(e) => setField('reorderLevel', e.target.value)}
              aria-invalid={Boolean(errors.reorderLevel)}
            />
            {errors.reorderLevel ? (
              <p className="text-label-sm text-status-critical-fg">{errors.reorderLevel}</p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="stock-in-buyPriceRial">قیمت خرید واحد (ریال)</Label>
            <Input
              id="stock-in-buyPriceRial"
              type="number"
              min={0}
              dir="ltr"
              value={values.buyPriceRial}
              onChange={(e) => setField('buyPriceRial', e.target.value)}
              placeholder="35000"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stock-in-consumerPriceRial">قیمت مصرف‌کننده (ریال)</Label>
            <Input
              id="stock-in-consumerPriceRial"
              type="number"
              min={0}
              dir="ltr"
              value={values.consumerPriceRial}
              onChange={(e) => setField('consumerPriceRial', e.target.value)}
              placeholder="45000"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>شرایط نگهداری و کنترل دما</Label>
          <RadioGroup
            value={values.storageTemp}
            onValueChange={(val) =>
              setField('storageTemp', val as StockInFormValues['storageTemp'])
            }
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          >
            {STORAGE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2 rounded-default border border-border-default bg-surface p-2.5 hover:bg-surface-muted/60"
              >
                <RadioGroupItem value={opt.value} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-label-md font-medium text-text-primary">
                    <Icon name={opt.icon} size={14} className="text-primary" data-slot="icon" />
                    <span>{opt.label}</span>
                  </div>
                  <div className="text-label-sm text-text-secondary">{opt.note}</div>
                </div>
              </label>
            ))}
          </RadioGroup>
        </div>

        {values.storageTemp === 'fridge' ? (
          <Badge variant="info" className="w-fit">
            زنجیره سرد ۲ تا ۸ درجه فعال خواهد شد
          </Badge>
        ) : null}
      </form>
      ) : null}
    </SideDrawer>
  )
}
