'use client'

import * as React from 'react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { AlertBanner } from '@/components/shared'
import { ApiError } from '@/lib/api/http'
import {
  normalizeDigits,
  validateControlledForm,
  type ControlledFormErrors,
  type ControlledFormState,
} from '@/lib/controlled/validation'
import { formatJalaliDate, formatPersianNumber } from '@/lib/persian'
import type {
  ControlledTxType,
  ControlledWasteMode,
  CreateControlledEntryInput,
  VaultBinOption,
  VaultDrugStock,
} from '@/lib/types/controlled'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  vaultItems: VaultDrugStock[]
  vaultBins: VaultBinOption[]
  initialDrugId?: string
  onSubmit: (input: CreateControlledEntryInput) => Promise<void>
}

function buildInitialForm(
  vaultItems: VaultDrugStock[],
  vaultBins: VaultBinOption[],
  initialDrugId?: string,
): ControlledFormState {
  const firstDrug =
    vaultItems.find((item) => item.drugId === initialDrugId) ?? vaultItems[0]
  const firstBatch = firstDrug?.activeBatches[0]
  const firstBin = vaultBins[0]
  return {
    drugId: firstDrug?.drugId ?? '',
    txType: 'out_prescription',
    wasteMode: 'used_ampoule',
    quantity: '1',
    batchId: firstBatch?.batchId ?? '',
    batchNo: firstBatch?.batchNo ?? '',
    expiry: firstBatch?.expiry ?? '',
    binId: firstBin?.id ?? '',
    physicianName: '',
    physicianLicense: '',
    patientNationalId: '',
    patientNote: '',
    trackingCode: '',
    sepasCode: '',
    technicalAck: false,
  }
}

export function ControlledRegisterDialog({
  open,
  onOpenChange,
  vaultItems,
  vaultBins,
  initialDrugId,
  onSubmit,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <ControlledRegisterDialogBody
          onOpenChange={onOpenChange}
          vaultItems={vaultItems}
          vaultBins={vaultBins}
          initialDrugId={initialDrugId}
          onSubmit={onSubmit}
        />
      ) : null}
    </Dialog>
  )
}

function ControlledRegisterDialogBody({
  onOpenChange,
  vaultItems,
  vaultBins,
  initialDrugId,
  onSubmit,
}: Omit<Props, 'open'>) {
  const [form, setForm] = React.useState<ControlledFormState>(() =>
    buildInitialForm(vaultItems, vaultBins, initialDrugId),
  )
  const [errors, setErrors] = React.useState<ControlledFormErrors>({})
  const [submitting, setSubmitting] = React.useState(false)

  const selectedDrug = React.useMemo(
    () => vaultItems.find((item) => item.drugId === form.drugId),
    [vaultItems, form.drugId],
  )

  const activeBatches = React.useMemo(
    () => selectedDrug?.activeBatches ?? [],
    [selectedDrug],
  )
  const selectedBatch = React.useMemo(
    () => activeBatches.find((b) => b.batchId === form.batchId),
    [activeBatches, form.batchId],
  )

  const needsExistingBatch =
    form.txType === 'out_prescription' ||
    (form.txType === 'waste_return' && form.wasteMode === 'damaged_stock')

  const handleDrugChange = (drugId: string) => {
    const drug = vaultItems.find((item) => item.drugId === drugId)
    const batch = drug?.activeBatches[0]
    setForm((prev) => ({
      ...prev,
      drugId,
      batchId: needsExistingBatch ? (batch?.batchId ?? '') : '',
      batchNo: needsExistingBatch ? (batch?.batchNo ?? '') : prev.batchNo,
      expiry: needsExistingBatch ? (batch?.expiry ?? '') : prev.expiry,
    }))
    setErrors((prev) => ({ ...prev, drugId: undefined, batchNo: undefined }))
  }

  const handleTxTypeChange = (txType: ControlledTxType) => {
    const useExisting =
      txType === 'out_prescription' ||
      (txType === 'waste_return' && form.wasteMode === 'damaged_stock')
    const batch = selectedDrug?.activeBatches[0]
    setForm((prev) => ({
      ...prev,
      txType,
      batchId: useExisting ? (batch?.batchId ?? '') : '',
      batchNo: useExisting ? (batch?.batchNo ?? '') : '',
      expiry: txType === 'in_distributor' ? '' : (batch?.expiry ?? ''),
    }))
    setErrors({})
  }

  const handleBatchPick = (batchId: string) => {
    const batch = activeBatches.find((b) => b.batchId === batchId)
    setForm((prev) => ({
      ...prev,
      batchId,
      batchNo: batch?.batchNo ?? prev.batchNo,
      expiry: batch?.expiry ?? prev.expiry,
    }))
    setErrors((prev) => ({ ...prev, batchNo: undefined, quantity: undefined }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const availableQty = needsExistingBatch ? selectedBatch?.quantity : undefined
    const clientErrors = validateControlledForm(form, availableQty)
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors)
      return
    }

    setSubmitting(true)
    setErrors({})
    try {
      await onSubmit({
        drugId: form.drugId,
        txType: form.txType,
        wasteMode: form.txType === 'waste_return' ? form.wasteMode : undefined,
        quantity: Number(normalizeDigits(form.quantity)),
        batchId: needsExistingBatch && form.batchId ? form.batchId : undefined,
        batchNo: form.batchNo.trim(),
        expiry: form.txType === 'in_distributor' ? normalizeDigits(form.expiry) : undefined,
        binId: form.txType === 'in_distributor' ? form.binId : undefined,
        physicianName: form.physicianName.trim() || undefined,
        physicianLicense: form.physicianLicense.trim() || undefined,
        patientNationalId: normalizeDigits(form.patientNationalId) || undefined,
        patientNote: form.patientNote.trim() || undefined,
        trackingCode: form.trackingCode.trim(),
        sepasCode: form.sepasCode.trim() || undefined,
        technicalAck: form.technicalAck,
      })
      onOpenChange(false)
    } catch (err) {
      if (err instanceof ApiError && err.fields && typeof err.fields === 'object') {
        const mapped: ControlledFormErrors = {}
        for (const [k, v] of Object.entries(err.fields as Record<string, unknown>)) {
          if (typeof v === 'string') {
            mapped[k as keyof ControlledFormState] = v
          }
        }
        mapped.form = err.message
        setErrors(mapped)
      } else {
        setErrors({
          form:
            err instanceof Error
              ? err.message
              : 'ثبت ردیف در دفترچه با خطا مواجه شد.',
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        data-testid="controlled-register-dialog"
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-lg bg-status-critical-bg text-status-critical-fg">
              <Icon name="enhanced_encryption" size={20} data-slot="icon" />
            </span>
            <div>
              <DialogTitle>ثبت گردش جدید در دفترچه رسمی مخدر</DialogTitle>
              <DialogDescription>
                پروتکل شماره ۸ نظارت دارویی — سامانه TTAC و سپاس
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {errors.form ? (
            <AlertBanner tone="critical" title="خطا در اعتبارسنجی" description={errors.form} />
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ctrl-drug">نام فرآورده و غلظت</Label>
              <Select value={form.drugId} onValueChange={handleDrugChange}>
                <SelectTrigger id="ctrl-drug" data-testid="ctrl-form-drug">
                  <SelectValue placeholder="انتخاب دارو از فهرست سهمیه..." />
                </SelectTrigger>
                <SelectContent className="z-[calc(var(--ps-z-modal)+10)]">
                  {vaultItems.map((item) => (
                    <SelectItem key={item.drugId} value={item.drugId}>
                      {item.nameFa} ({formatPersianNumber(item.availableStock)}{' '}
                      {item.unitLabel})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.drugId ? (
                <p className="text-label-sm text-status-critical-fg">{errors.drugId}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ctrl-tx-type">نوع گردش</Label>
              <Select
                value={form.txType}
                onValueChange={(v) => handleTxTypeChange(v as ControlledTxType)}
              >
                <SelectTrigger id="ctrl-tx-type" data-testid="ctrl-form-tx-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[calc(var(--ps-z-modal)+10)]">
                  <SelectItem value="out_prescription">
                    خروج با نسخه الکترونیک بیمار (-)
                  </SelectItem>
                  <SelectItem value="in_distributor">
                    ورود محموله توزیع دولتی (+)
                  </SelectItem>
                  <SelectItem value="waste_return">
                    ثبت پوکه مصرفی و امحا
                  </SelectItem>
                </SelectContent>
              </Select>
              {errors.txType ? (
                <p className="text-label-sm text-status-critical-fg">{errors.txType}</p>
              ) : null}
            </div>

            {form.txType === 'waste_return' ? (
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="ctrl-waste-mode">نحوه ثبت امحا / پوکه</Label>
                <Select
                  value={form.wasteMode}
                  onValueChange={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      wasteMode: v as ControlledWasteMode,
                    }))
                  }
                >
                  <SelectTrigger id="ctrl-waste-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[calc(var(--ps-z-modal)+10)]">
                    <SelectItem value="used_ampoule">
                      پلمب پوکه مصرف‌شده (بدون کسر مجدد از موجودی فعال)
                    </SelectItem>
                    <SelectItem value="damaged_stock">
                      معدوم‌سازی / مرجوعی موجودی ناسالم (کسر از گاوصندوق)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="ctrl-qty">
                تعداد واحد ({selectedDrug?.unitLabel ?? 'عدد/ویال'})
              </Label>
              <Input
                id="ctrl-qty"
                data-testid="ctrl-form-qty"
                type="number"
                min={1}
                max={10000}
                dir="ltr"
                value={form.quantity}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, quantity: e.target.value }))
                  setErrors((prev) => ({ ...prev, quantity: undefined }))
                }}
              />
              {errors.quantity ? (
                <p className="text-label-sm text-status-critical-fg">{errors.quantity}</p>
              ) : null}
            </div>

            {needsExistingBatch && activeBatches.length > 0 ? (
              <div className="space-y-1.5">
                <Label htmlFor="ctrl-batch-select">سری ساخت فعال در گاوصندوق</Label>
                <Select value={form.batchId} onValueChange={handleBatchPick}>
                  <SelectTrigger id="ctrl-batch-select" data-testid="ctrl-form-batch-select">
                    <SelectValue placeholder="انتخاب سری ساخت..." />
                  </SelectTrigger>
                  <SelectContent className="z-[calc(var(--ps-z-modal)+10)]">
                    {activeBatches.map((batch) => (
                      <SelectItem key={batch.batchId} value={batch.batchId}>
                        <span dir="ltr">{batch.batchNo}</span> — موجودی{' '}
                        {formatPersianNumber(batch.quantity)} (انقضا{' '}
                        {formatJalaliDate(`${batch.expiry}T12:00:00`)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.batchNo ? (
                  <p className="text-label-sm text-status-critical-fg">{errors.batchNo}</p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="ctrl-batch-no">شماره سری ساخت (Batch No)</Label>
                <Input
                  id="ctrl-batch-no"
                  data-testid="ctrl-form-batch-no"
                  dir="ltr"
                  placeholder="مثال: MR-10"
                  value={form.batchNo}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, batchNo: e.target.value }))
                    setErrors((prev) => ({ ...prev, batchNo: undefined }))
                  }}
                />
                {errors.batchNo ? (
                  <p className="text-label-sm text-status-critical-fg">{errors.batchNo}</p>
                ) : null}
              </div>
            )}

            {form.txType === 'in_distributor' ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="ctrl-expiry">تاریخ انقضا (میلادی YYYY-MM-DD)</Label>
                  <Input
                    id="ctrl-expiry"
                    data-testid="ctrl-form-expiry"
                    dir="ltr"
                    placeholder="2028-03-01"
                    value={form.expiry}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, expiry: e.target.value }))
                      setErrors((prev) => ({ ...prev, expiry: undefined }))
                    }}
                  />
                  {errors.expiry ? (
                    <p className="text-label-sm text-status-critical-fg">{errors.expiry}</p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ctrl-bin">موقعیت گاوصندوق (زون S)</Label>
                  <Select
                    value={form.binId}
                    onValueChange={(binId) => setForm((prev) => ({ ...prev, binId }))}
                  >
                    <SelectTrigger id="ctrl-bin">
                      <SelectValue placeholder="انتخاب محفظه گاوصندوق..." />
                    </SelectTrigger>
                    <SelectContent className="z-[calc(var(--ps-z-modal)+10)]">
                      {vaultBins.map((bin) => (
                        <SelectItem key={bin.id} value={bin.id}>
                          <span dir="ltr">{bin.address}</span> · {bin.zoneLabel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="ctrl-physician">
                {form.txType === 'in_distributor'
                  ? 'شرکت پخش / حواله‌دهنده'
                  : 'نام پزشک معالج'}
              </Label>
              <Input
                id="ctrl-physician"
                data-testid="ctrl-form-physician"
                placeholder={
                  form.txType === 'in_distributor'
                    ? 'مثال: شرکت پخش رازی'
                    : 'مثال: دکتر محمدرضا صابری'
                }
                value={form.physicianName}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, physicianName: e.target.value }))
                  setErrors((prev) => ({ ...prev, physicianName: undefined }))
                }}
              />
              {errors.physicianName ? (
                <p className="text-label-sm text-status-critical-fg">
                  {errors.physicianName}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ctrl-license">
                {form.txType === 'in_distributor'
                  ? 'شماره حواله پخش'
                  : 'شماره نظام پزشکی'}
              </Label>
              <Input
                id="ctrl-license"
                placeholder={
                  form.txType === 'in_distributor' ? 'مثال: ۲۲۹۰۱-ص' : 'مثال: م-۴۸۹۲۱'
                }
                value={form.physicianLicense}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, physicianLicense: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ctrl-nid">
                کدملی بیمار / تحویل‌گیرنده
                {form.txType === 'out_prescription' ? ' (۱۰ رقم الزامی)' : ' (اختیاری)'}
              </Label>
              <Input
                id="ctrl-nid"
                data-testid="ctrl-form-nid"
                dir="ltr"
                maxLength={10}
                placeholder="0071234583"
                value={form.patientNationalId}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, patientNationalId: e.target.value }))
                  setErrors((prev) => ({ ...prev, patientNationalId: undefined }))
                }}
              />
              {errors.patientNationalId ? (
                <p className="text-label-sm text-status-critical-fg">
                  {errors.patientNationalId}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ctrl-sepas">کد رهگیری سپاس (اختیاری)</Label>
              <Input
                id="ctrl-sepas"
                dir="ltr"
                placeholder="مثال: 1804928"
                value={form.sepasCode}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, sepasCode: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="ctrl-tracking">شناسه یکتای نسخه الکترونیک / کد TTAC</Label>
              <Input
                id="ctrl-tracking"
                data-testid="ctrl-form-tracking"
                dir="ltr"
                placeholder="مثال: TTAC-8849201948"
                value={form.trackingCode}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, trackingCode: e.target.value }))
                  setErrors((prev) => ({ ...prev, trackingCode: undefined }))
                }}
              />
              {errors.trackingCode ? (
                <p className="text-label-sm text-status-critical-fg">
                  {errors.trackingCode}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="ctrl-note">توضیحات پرونده / مامور تحویل (اختیاری)</Label>
              <Input
                id="ctrl-note"
                placeholder="مثال: پرونده شیمی‌درمانی بیمارستان پارس یا شماره پلمب پوکه"
                value={form.patientNote}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, patientNote: e.target.value }))
                }
              />
            </div>
          </div>

          <div
            className={cn(
              'rounded-lg border p-3',
              errors.technicalAck
                ? 'border-status-critical-border bg-status-critical-bg/40'
                : 'border-status-warning-border bg-status-warning-bg/40',
            )}
          >
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="ctrl-tech-ack"
                data-testid="ctrl-form-ack"
                checked={form.technicalAck}
                onCheckedChange={(checked) => {
                  setForm((prev) => ({ ...prev, technicalAck: checked === true }))
                  setErrors((prev) => ({ ...prev, technicalAck: undefined }))
                }}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <Label
                  htmlFor="ctrl-tech-ack"
                  className="cursor-pointer font-semibold text-text-primary"
                >
                  تأیید و امضای دیجیتال مسئول فنی داروخانه
                </Label>
                <p className="text-body-sm text-text-secondary">
                  ثبت این فرم به‌عنوان سند حقوقی غیرقابل‌ویرایش (WORM) در دفترچه
                  وزارت بهداشت منظور شده و با امضای مسئول فنی پلمب می‌گردد.
                </p>
                {errors.technicalAck ? (
                  <p className="text-label-sm text-status-critical-fg">
                    {errors.technicalAck}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <DialogFooter>
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
              disabled={submitting}
              data-testid="ctrl-form-submit"
            >
              <Icon name="verified" size={18} data-slot="icon" />
              {submitting ? 'در حال پلمب و ثبت…' : 'تایید و امضای دیجیتال در دفترچه'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
  )
}
