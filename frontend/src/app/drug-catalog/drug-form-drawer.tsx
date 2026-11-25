'use client'

import * as React from 'react'
import {
  Badge,
  Button,
  Checkbox,
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
  type DosageForm,
  type Drug,
  type DrugCategory,
  type TtacLookupState,
  type TtacProduct,
  type TtacSearchHit,
} from '@/lib/types/drugs'
import { lookupTtac, searchTtac } from '@/lib/drugs/data-access'
import { formatJalaliDate, toPersianDigits } from '@/lib/persian'

export type DrugFormValues = {
  nameFa: string
  brandName: string
  dosageForm: DosageForm | ''
  strength: string
  atcCode: string
  manufacturer: string
  genericCode: string
  gtin: string
  isCombination: boolean
  storageTemp: 'room' | 'fridge' | 'freezer' | 'light'
  isControlled: boolean
  reorderLevel: string
  category: DrugCategory | ''
}

const EMPTY_FORM: DrugFormValues = {
  nameFa: '',
  brandName: '',
  dosageForm: '',
  strength: '',
  atcCode: '',
  manufacturer: '',
  genericCode: '',
  gtin: '',
  isCombination: false,
  storageTemp: 'room',
  isControlled: false,
  reorderLevel: '100',
  category: '',
}

type FieldErrors = Partial<Record<keyof DrugFormValues, string>>

function drugToForm(drug: Drug): DrugFormValues {
  return {
    nameFa: drug.nameFa,
    brandName: drug.brandName,
    dosageForm: drug.dosageForm,
    strength: drug.strength,
    atcCode: drug.atcCode ?? '',
    manufacturer: drug.manufacturer,
    genericCode: drug.genericCode,
    gtin: drug.gtin,
    isCombination: false,
    storageTemp: drug.storageTemp ?? 'room',
    isControlled: drug.isControlled,
    reorderLevel: String(drug.reorderLevel),
    category: drug.category,
  }
}

function productToForm(product: TtacProduct): Partial<DrugFormValues> {
  const values: Partial<DrugFormValues> = {
    nameFa: product.nameFa,
    brandName: product.brandName,
    manufacturer: product.manufacturer,
    gtin: product.gtin,
  }
  if (product.strength) values.strength = product.strength
  if (product.atcCode) values.atcCode = product.atcCode
  if (product.genericCode) values.genericCode = product.genericCode
  if (
    product.dosageForm &&
    (DOSAGE_FORMS as readonly string[]).includes(product.dosageForm)
  ) {
    values.dosageForm = product.dosageForm
  }
  if (
    product.category &&
    (DRUG_CATEGORIES as readonly string[]).includes(product.category)
  ) {
    values.category = product.category
  }
  return values
}

function validate(values: DrugFormValues): FieldErrors {
  const errors: FieldErrors = {}
  if (!values.nameFa.trim()) {
    errors.nameFa = 'نام ژنریک الزامی است.'
  }
  if (!values.dosageForm) {
    errors.dosageForm = 'شکل دارویی را انتخاب کنید.'
  }
  if (!values.strength.trim()) {
    errors.strength = 'دوز و قدرت اثر الزامی است.'
  }
  const reorder = Number(values.reorderLevel)
  if (!Number.isFinite(reorder) || reorder < 0) {
    errors.reorderLevel = 'نقطه سفارش باید عدد معتبر باشد.'
  }
  return errors
}

function isInactiveLicense(statusStr: string | undefined, status?: number): boolean {
  const normalized = (statusStr ?? '').replace(/\s/g, '')
  if (/غیر|غير/.test(normalized)) return true
  if (/فعال/.test(normalized)) return false
  return status != null && status !== 1
}

const STORAGE_OPTIONS = [
  { value: 'room', label: 'دمای اتاق (۱۵ تا ۲۵°C)', icon: 'thermostat' as const },
  { value: 'fridge', label: 'یخچالی (۲ تا ۸°C)', icon: 'ac_unit' as const },
  { value: 'light', label: 'محافظت دقیق از نور', icon: 'light_mode' as const },
  { value: 'freezer', label: 'فریزر (زیر صفر درجه)', icon: 'severe_cold' as const },
] as const

export type DrugFormDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: Drug | null
  prefill?: Partial<DrugFormValues>
  onSaved?: (values: DrugFormValues) => void | Promise<void>
}

export function DrugFormDrawer({
  open,
  onOpenChange,
  editing,
  prefill,
  onSaved,
}: DrugFormDrawerProps) {
  const title = editing
    ? 'ویرایش قلم در کاتالوگ انبار'
    : 'ثبت داروی جدید در کاتالوگ انبار'
  const description = editing
    ? 'ویرایش مشخصات ژنریک و به‌روزرسانی کاردکس'
    : 'در حال ثبت اقلام ژنریک و تخصیص کد کاردکس'

  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline">
              <Icon name="print" size={18} data-slot="icon" />
              چاپ برچسب قفسه
            </Button>
            <Button type="submit" form="drug-catalog-form">
              <Icon name="save" size={18} data-slot="icon" />
              ذخیره در کاتالوگ و ایجاد کاردکس
            </Button>
          </div>
        </div>
      }
    >
      {open ? (
        <DrugFormBody
          key={editing?.id ?? `new-${prefill?.gtin ?? prefill?.nameFa ?? ''}`}
          editing={editing}
          prefill={prefill}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      ) : null}
    </SideDrawer>
  )
}

function DrugFormBody({
  editing,
  prefill,
  onOpenChange,
  onSaved,
}: {
  editing: Drug | null
  prefill?: Partial<DrugFormValues>
  onOpenChange: (open: boolean) => void
  onSaved?: (values: DrugFormValues) => void | Promise<void>
}) {
  const [values, setValues] = React.useState<DrugFormValues>(() =>
    editing ? drugToForm(editing) : { ...EMPTY_FORM, ...prefill },
  )
  const [errors, setErrors] = React.useState<FieldErrors>({})
  const [ttacQuery, setTtacQuery] = React.useState(
    () => editing?.gtin ?? prefill?.gtin ?? prefill?.genericCode ?? '',
  )
  const [ttac, setTtac] = React.useState<TtacLookupState>({ status: 'idle' })
  const [hits, setHits] = React.useState<TtacSearchHit[]>([])

  function patch(partial: Partial<DrugFormValues>) {
    setValues((prev) => ({ ...prev, ...partial }))
  }

  async function handleTtacLookup() {
    setTtac({ status: 'loading' })
    setHits([])
    const q = ttacQuery.trim()
    const digitsOnly = /^[0-9]+$/.test(q)
    if (digitsOnly && (q.length === 16 || q.length === 13 || q.length === 14)) {
      const result = await lookupTtac(q)
      setTtac(result)
      return
    }
    try {
      const res = await searchTtac(q)
      if (res.error) {
        setTtac({ status: 'error', message: res.error })
        return
      }
      setHits(res.items)
      const sole = res.items.length === 1 ? res.items[0] : undefined
      if (sole) {
        const result = await lookupTtac(sole.irc)
        setTtac(result)
        return
      }
      setTtac(res.items.length === 0 ? { status: 'not_found' } : { status: 'idle' })
    } catch {
      setTtac({ status: 'error', message: 'ارتباط با سامانه تیتک برقرار نشد. دوباره تلاش کنید.' })
    }
  }

  async function handlePickHit(irc: string) {
    setTtac({ status: 'loading' })
    const result = await lookupTtac(irc)
    setTtac(result)
  }

  function handleUseTtacData() {
    if (ttac.status !== 'found') return
    patch(productToForm(ttac.product))
    setErrors({})
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    onSaved?.(values)
    onOpenChange(false)
  }

  return (
    <form id="drug-catalog-form" className="flex flex-col gap-6 pb-4" onSubmit={handleSubmit}>
      <section className="space-y-3 rounded-default border border-border-subtle bg-surface-muted p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-label-lg font-semibold text-primary">
            <Icon name="qr_code_scanner" size={20} data-slot="icon" />
            استعلام برخط سامانه تیتک (TTAC) و اسکن بارکد
          </h3>
          <span className="inline-flex items-center gap-1 rounded-badge bg-secondary-tint px-2 py-0.5 text-label-sm text-secondary">
            <Icon name="verified_user" size={14} data-slot="icon" />
            سازمان غذا و دارو
          </span>
        </div>
        <p className="text-body-sm text-text-secondary">
          جهت ورود سریع و بدون خطای مشخصات، بارکد دوبعدی GTIN/UID دارو را اسکن کنید، کد ملی IRC را وارد نمایید، یا نام تجاری را جستجو کنید.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Icon
              name="barcode"
              size={18}
              className="pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 text-text-placeholder"
              data-slot="icon"
            />
            <Input
              dir="ltr"
              className="ps-10 font-latin"
              placeholder="اسکن بارکد سریع (GTIN / UID / IRC) یا نام تجاری..."
              value={ttacQuery}
              onChange={(event) => setTtacQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handleTtacLookup()
                }
              }}
              aria-label="کد استعلام تی‌تک"
              data-testid="ttac-query"
            />
          </div>
          <Button
            type="button"
            data-testid="ttac-lookup"
            onClick={handleTtacLookup}
            loading={ttac.status === 'loading'}
          >
            <Icon name="search_check" size={18} data-slot="icon" />
            استعلام تی‌تک
          </Button>
        </div>

        {hits.length > 1 ? (
          <div className="space-y-2">
            <p className="text-label-sm text-text-secondary">
              چند پروانه مطابق جستجو یافت شد. یکی را انتخاب کنید؛ درج در فرم فقط با دکمهٔ بعدی انجام می‌شود.
            </p>
            <ul className="flex flex-col gap-2" aria-label="نتایج جستجوی تی‌تک">
              {hits.map((hit) => {
                const inactive = isInactiveLicense(hit.statusStr, hit.status)
                const selected =
                  ttac.status === 'found' &&
                  (ttac.product.irc === hit.irc || ttac.product.genericCode === hit.irc)
                return (
                  <li key={hit.irc}>
                    <button
                      type="button"
                      data-testid="ttac-hit"
                      aria-pressed={selected}
                      disabled={ttac.status === 'loading'}
                      onClick={() => void handlePickHit(hit.irc)}
                      className={
                        selected
                          ? 'flex w-full flex-col gap-1 rounded-default border border-secondary bg-secondary-tint/40 p-3 text-start'
                          : 'flex w-full flex-col gap-1 rounded-default border border-border-default bg-surface p-3 text-start transition-colors hover:bg-surface-hover disabled:opacity-60'
                      }
                    >
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-label-md font-semibold text-text-primary">
                          {hit.nameFa}
                        </span>
                        <Badge variant={inactive ? 'warning' : 'valid'}>
                          {hit.statusStr || (inactive ? 'غیرفعال' : 'فعال')}
                        </Badge>
                      </span>
                      <span className="text-body-sm text-text-secondary">{hit.manufacturer}</span>
                      <span className="font-latin text-label-sm text-text-secondary" dir="ltr">
                        IRC: {hit.irc}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}

        {ttac.status === 'found' ? (
          <div className="flex items-start gap-3 rounded-default border border-status-valid-border bg-status-valid-bg p-3 text-status-valid-fg">
            <Icon name="check_circle" size={22} className="mt-0.5" data-slot="icon" />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="flex flex-wrap items-center gap-2 text-label-md font-semibold text-text-primary">
                <span>
                  یافته‌شده در سامانه غذا و دارو: {ttac.product.nameFa}{' '}
                  {ttac.product.strength}
                </span>
                {isInactiveLicense(ttac.product.statusStr) ? (
                  <Badge variant="warning">{ttac.product.statusStr || 'غیرفعال'}</Badge>
                ) : null}
              </p>
              <p className="text-body-sm text-text-secondary" dir="ltr">
                {ttac.product.manufacturer} | IRC: {ttac.product.irc} | ATC:{' '}
                {ttac.product.atcCode} | دوز: {ttac.product.strength}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-label-sm text-text-secondary">
                  تاریخ تایید پروانه: {formatJalaliDate(ttac.product.licenseExpiry)}
                </span>
                <Button type="button" size="sm" variant="secondary" onClick={handleUseTtacData}>
                  <Icon name="auto_fix_high" size={14} data-slot="icon" />
                  درج خودکار در فرم (Auto Fill)
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {ttac.status === 'not_found' ? (
          <p
            className="rounded-default border border-status-warning-border bg-status-warning-bg px-3 py-2 text-body-sm text-status-warning-fg"
            role="status"
          >
            موردی در سامانه تیتک یافت نشد.
          </p>
        ) : null}

        {ttac.status === 'error' ? (
          <p
            className="rounded-default border border-status-critical-border bg-status-critical-bg px-3 py-2 text-body-sm text-status-critical-fg"
            role="alert"
          >
            {ttac.message}
          </p>
        ) : null}
      </section>

      <section className="space-y-4">
        <h3 className="flex items-center gap-1.5 border-b border-border-subtle pb-2 text-label-lg font-bold text-text-primary">
          <Icon name="description" size={18} className="text-primary" data-slot="icon" />
          اطلاعات ژنریک و تخصصی دارو
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="نام ژنریک فرآورده (Generic Name)"
            required
            error={errors.nameFa}
            htmlFor="drug-nameFa"
          >
            <Input
              id="drug-nameFa"
              value={values.nameFa}
              aria-invalid={Boolean(errors.nameFa) || undefined}
              onChange={(event) => patch({ nameFa: event.target.value })}
            />
          </Field>
          <Field label="نام تجاری و برند (Brand Name)" htmlFor="drug-brand">
            <Input
              id="drug-brand"
              value={values.brandName}
              onChange={(event) => patch({ brandName: event.target.value })}
            />
          </Field>
          <Field
            label="شکل دارویی (Dosage Form)"
            required
            error={errors.dosageForm}
            htmlFor="drug-dosage"
          >
            <Select
              value={values.dosageForm || undefined}
              onValueChange={(value) => patch({ dosageForm: value as DosageForm })}
            >
              <SelectTrigger id="drug-dosage" aria-invalid={Boolean(errors.dosageForm) || undefined}>
                <SelectValue placeholder="انتخاب شکل دارویی" />
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
          </Field>
          <Field
            label="دوز و قدرت اثر (Strength)"
            required
            error={errors.strength}
            htmlFor="drug-strength"
          >
            <Input
              id="drug-strength"
              value={values.strength}
              aria-invalid={Boolean(errors.strength) || undefined}
              onChange={(event) => patch({ strength: event.target.value })}
            />
          </Field>
          <Field label="کد سیستمیک ATC" htmlFor="drug-atc">
            <Input
              id="drug-atc"
              dir="ltr"
              className="font-latin font-semibold text-primary"
              value={values.atcCode}
              onChange={(event) => patch({ atcCode: event.target.value })}
            />
          </Field>
          <Field label="شرکت صاحب پروانه ساخت / واردکننده" htmlFor="drug-mfr">
            <Input
              id="drug-mfr"
              value={values.manufacturer}
              onChange={(event) => patch({ manufacturer: event.target.value })}
            />
          </Field>
          <Field label="شناسه رهگیری ملی IRC" htmlFor="drug-irc">
            <Input
              id="drug-irc"
              dir="ltr"
              className="font-latin"
              value={values.genericCode}
              onChange={(event) => patch({ genericCode: event.target.value })}
            />
          </Field>
          <Field label="بارکد بین‌المللی کالا (GTIN)" htmlFor="drug-gtin">
            <Input
              id="drug-gtin"
              dir="ltr"
              className="font-latin"
              value={values.gtin}
              onChange={(event) => patch({ gtin: event.target.value })}
            />
          </Field>
          <Field label="رده درمانی" htmlFor="drug-category">
            <Select
              value={values.category || undefined}
              onValueChange={(value) => patch({ category: value as DrugCategory })}
            >
              <SelectTrigger id="drug-category">
                <SelectValue placeholder="انتخاب رده" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {DRUG_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            id="drug-combo"
            checked={values.isCombination}
            onCheckedChange={(checked) => patch({ isCombination: checked === true })}
          />
          <Label htmlFor="drug-combo" className="cursor-pointer font-normal">
            فرمولاسیون دارویی ترکیبی است (دارای بیش از یک ماده مؤثره ژنریک)
          </Label>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="flex items-center gap-1.5 border-b border-border-subtle pb-2 text-label-lg font-bold text-text-primary">
          <Icon name="inventory_2" size={18} className="text-primary" data-slot="icon" />
          شرایط انبارداری و الزامات قانونی نگهداری
        </h3>

        <div className="space-y-2">
          <Label>دمای الزامی نگهداری در انبار</Label>
          <RadioGroup
            value={values.storageTemp}
            onValueChange={(value) =>
              patch({ storageTemp: value as DrugFormValues['storageTemp'] })
            }
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          >
            {STORAGE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-default border border-border-default bg-surface p-2.5 transition-colors hover:bg-surface-hover has-[[data-state=checked]]:border-secondary has-[[data-state=checked]]:bg-secondary-tint/40"
              >
                <RadioGroupItem value={option.value} aria-label={option.label} />
                <span className="flex items-center gap-1 text-label-sm text-text-primary">
                  <Icon name={option.icon} size={18} data-slot="icon" />
                  {toPersianDigits(option.label)}
                </span>
              </label>
            ))}
          </RadioGroup>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-default bg-surface-subtle p-4">
          <div className="flex items-start gap-3">
            <Icon name="lock_clock" size={22} className="text-status-critical-fg" data-slot="icon" />
            <div>
              <p className="text-label-lg font-semibold text-text-primary">
                قلم تحت کنترل و داروهای مخدر
              </p>
              <p className="text-body-sm text-text-secondary">
                نیازمند ثبت در سامانه اختصاصی مخدرات و نظارت مستقیم مسئول فنی
              </p>
            </div>
          </div>
          <Switch
            checked={values.isControlled}
            onCheckedChange={(checked) => patch({ isControlled: checked })}
            aria-label="قلم تحت کنترل"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="حداقل نقطه سفارش (Reorder Level)"
            error={errors.reorderLevel}
            htmlFor="drug-reorder"
          >
            <Input
              id="drug-reorder"
              type="number"
              min={0}
              dir="ltr"
              className="font-latin tabular-nums-data"
              value={values.reorderLevel}
              aria-invalid={Boolean(errors.reorderLevel) || undefined}
              onChange={(event) => patch({ reorderLevel: event.target.value })}
            />
          </Field>
        </div>
      </section>
    </form>
  )
}

function Field({
  label,
  required,
  error,
  htmlFor,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="ms-1 text-status-critical-fg">*</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="text-label-sm text-status-critical-fg" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
