import { normalizePersianText } from '@/lib/persian'
import type {
  ControlledTxType,
  ControlledWasteMode,
} from '@/lib/types/controlled'

export type ControlledFormState = {
  drugId: string
  txType: ControlledTxType
  wasteMode: ControlledWasteMode
  quantity: string
  batchId: string
  batchNo: string
  expiry: string
  binId: string
  physicianName: string
  physicianLicense: string
  patientNationalId: string
  patientNote: string
  trackingCode: string
  sepasCode: string
  technicalAck: boolean
}

export type ControlledFormErrors = Partial<
  Record<keyof ControlledFormState | 'form', string>
>

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function normalizeDigits(raw: string): string {
  return normalizePersianText(raw).trim()
}

export function validateControlledForm(
  form: ControlledFormState,
  availableBatchQty?: number,
): ControlledFormErrors {
  const errors: ControlledFormErrors = {}

  if (!form.drugId.trim()) {
    errors.drugId = 'انتخاب فرآورده تحت کنترل الزامی است.'
  }

  const qtyNum = Number(normalizeDigits(form.quantity))
  if (!Number.isInteger(qtyNum) || qtyNum <= 0 || qtyNum > 10000) {
    errors.quantity = 'تعداد واحد باید عدد صحیح بین ۱ تا ۱۰۰۰۰ باشد.'
  } else if (
    typeof availableBatchQty === 'number' &&
    (form.txType === 'out_prescription' ||
      (form.txType === 'waste_return' && form.wasteMode === 'damaged_stock')) &&
    qtyNum > availableBatchQty
  ) {
    errors.quantity = 'تعداد درخواستی از موجودی فعال سری ساخت بیشتر است.'
  }

  if (!form.batchNo.trim() && !form.batchId.trim()) {
    errors.batchNo = 'شماره سری ساخت الزامی است.'
  }

  if (!form.trackingCode.trim()) {
    errors.trackingCode = 'شناسه یکتای TTAC / سپاس الزامی است.'
  }

  if (form.txType === 'out_prescription') {
    if (!form.physicianName.trim()) {
      errors.physicianName = 'نام پزشک معالج الزامی است.'
    }
    const nid = normalizeDigits(form.patientNationalId)
    if (!/^\d{10}$/.test(nid)) {
      errors.patientNationalId = 'کدملی بیمار باید دقیقاً ۱۰ رقم باشد.'
    }
  }

  if (form.txType === 'in_distributor') {
    if (!form.physicianName.trim()) {
      errors.physicianName = 'نام شرکت پخش یا حواله‌دهنده الزامی است.'
    }
    const exp = normalizeDigits(form.expiry)
    if (!ISO_DATE_RE.test(exp)) {
      errors.expiry = 'تاریخ انقضای معتبر (YYYY-MM-DD) وارد کنید.'
    }
  }

  if (!form.technicalAck) {
    errors.technicalAck = 'تأیید و امضای دیجیتال مسئول فنی الزامی است.'
  }

  return errors
}
