'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
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
  CardHeader,
  CardTitle,
  DatePicker,
  Icon,
  Input,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Textarea,
} from '@/components/ui'
import { AppShell } from '@/components/layout'
import {
  ActionTooltip,
  AlertBanner,
  DenseDataTable,
  PageHeader,
  type DenseColumn,
} from '@/components/shared'
import { Stepper, type StepperStep, type StepStatus } from '@/components/domain'
import { ApiError } from '@/lib/api/http'
import { apiFindDrugById } from '@/lib/api/drugs'
import { fetchDrugs } from '@/lib/drugs/data-access'
import {
  formatJalaliDate,
  formatPersianNumber,
  formatRial,
  normalizePersianText,
  toPersianDigits,
} from '@/lib/persian'
import {
  addReceiptLine,
  confirmReceipt,
  createReceipt,
  deleteReceiptLine,
  getReceipt,
  patchReceipt,
  patchReceiptLine,
  type ReceiptLineInput,
} from '@/lib/receipts/data-access'
import {
  canAdvanceToStep3,
  canConfirmReceipt,
  computeReceiptTotals,
} from '@/lib/receipts/totals'
import type { Drug } from '@/lib/types/drugs'
import type {
  InvoiceReceipt,
  PurchaseType,
  ReceiptHeader,
  ReceiptLine,
  ReceiptStatus,
} from '@/lib/types/receipts'
import { SHELF_ZONES } from '@/lib/types/shelves'
import { getReceiptNavItems } from './nav'

type WizardStep = 1 | 2 | 3

type HeaderForm = {
  invoiceNo: string
  distributor: string
  issuedAt: string
  receivedAt: string
  warehouseLabel: string
  purchaseType: PurchaseType
  discountRial: string
  vatRial: string
  note: string
}

type LineForm = {
  drugId: string
  nameFa: string
  gtin: string
  irc: string
  batchNo: string
  expiry: string
  quantity: string
  unitLabel: string
  buyPrice: string
  consumerPrice: string
}

type ShelfDraft = {
  locationLabel: string
  binId: string
  zone: string
}

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'مشخصات فاکتور و شرکت پخش',
  2: 'اسکن بارکد، سری ساخت و ورود اقلام',
  3: 'تطبیق نهایی، قفسه و کاردکس',
}

const PURCHASE_OPTIONS: { value: PurchaseType; label: string }[] = [
  { value: 'official_ttac', label: 'رسمی با بارکد اصالت (تی‌تک)' },
  { value: 'official', label: 'رسمی' },
  { value: 'other', label: 'سایر' },
]

const EMPTY_HEADER: HeaderForm = {
  invoiceNo: '',
  distributor: '',
  issuedAt: '',
  receivedAt: '',
  warehouseLabel: '',
  purchaseType: 'official_ttac',
  discountRial: '0',
  vatRial: '0',
  note: '',
}

const EMPTY_LINE: LineForm = {
  drugId: '',
  nameFa: '',
  gtin: '',
  irc: '',
  batchNo: '',
  expiry: '',
  quantity: '',
  unitLabel: 'عدد',
  buyPrice: '',
  consumerPrice: '',
}

const STATUS_LABEL: Record<ReceiptStatus, string> = {
  draft: 'پیش‌نویس',
  confirmed: 'تاییدشده',
  cancelled: 'لغوشده',
}

const STEP_META: Record<StepStatus, string> = {
  completed: 'پایان‌یافته',
  current: 'در حال پردازش',
  upcoming: 'مرحله آتی',
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.fields && typeof err.fields === 'object') {
      const parts = Object.values(err.fields as Record<string, unknown>).filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      )
      if (parts.length > 0) return parts.join(' ')
    }
    return err.message || 'درخواست ناموفق بود.'
  }
  if (err instanceof Error && err.message) return err.message
  return 'خطای غیرمنتظره رخ داد.'
}

function parseNonNegativeInt(raw: string): number | null {
  const normalized = normalizePersianText(raw).replace(/[,،\s]/g, '')
  if (!/^\d+$/.test(normalized)) return null
  const value = Number(normalized)
  if (!Number.isSafeInteger(value)) return null
  return value
}

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function displayDate(iso: string): string {
  if (!iso) return '—'
  const value = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso
  return formatJalaliDate(value)
}

function headerFromReceipt(header: ReceiptHeader): HeaderForm {
  return {
    invoiceNo: header.invoiceNo,
    distributor: header.distributor,
    issuedAt: header.issuedAt.slice(0, 10),
    receivedAt: header.receivedAt.slice(0, 10),
    warehouseLabel: header.warehouseLabel,
    purchaseType: header.purchaseType,
    discountRial: String(header.discountRial),
    vatRial: String(header.vatRial),
    note: header.note ?? '',
  }
}

function draftsFrom(receipt: InvoiceReceipt): Record<string, ShelfDraft> {
  return Object.fromEntries(
    receipt.lines.map((line) => [
      line.id,
      {
        locationLabel: line.locationLabel ?? '',
        binId: line.binId ?? '',
        zone: line.zone ?? '',
      },
    ]),
  )
}

function buildHeader(form: HeaderForm): { ok: true; header: ReceiptHeader } | { ok: false; message: string } {
  const invoiceNo = form.invoiceNo.trim()
  const distributor = form.distributor.trim()
  const issuedAt = form.issuedAt.trim()
  const receivedAt = form.receivedAt.trim()
  const warehouseLabel = form.warehouseLabel.trim()
  const discountRial = parseNonNegativeInt(form.discountRial)
  const vatRial = parseNonNegativeInt(form.vatRial)
  if (!invoiceNo) return { ok: false, message: 'شماره فاکتور الزامی است.' }
  if (!distributor) return { ok: false, message: 'شرکت پخش الزامی است.' }
  if (!isIsoDate(issuedAt)) return { ok: false, message: 'تاریخ صدور باید به‌صورت میلادی YYYY-MM-DD باشد.' }
  if (!isIsoDate(receivedAt)) return { ok: false, message: 'تاریخ دریافت باید به‌صورت میلادی YYYY-MM-DD باشد.' }
  if (!warehouseLabel) return { ok: false, message: 'انبار الزامی است.' }
  if (discountRial === null) return { ok: false, message: 'تخفیف باید عدد صحیح ریال باشد.' }
  if (vatRial === null) return { ok: false, message: 'مالیات باید عدد صحیح ریال باشد.' }
  return {
    ok: true,
    header: {
      invoiceNo,
      distributor,
      issuedAt,
      receivedAt,
      warehouseLabel,
      purchaseType: form.purchaseType,
      discountRial,
      vatRial,
      note: form.note.trim(),
    },
  }
}

function sameHeader(a: ReceiptHeader, b: ReceiptHeader): boolean {
  return (
    a.invoiceNo === b.invoiceNo &&
    a.distributor === b.distributor &&
    a.issuedAt.slice(0, 10) === b.issuedAt.slice(0, 10) &&
    a.receivedAt.slice(0, 10) === b.receivedAt.slice(0, 10) &&
    a.warehouseLabel === b.warehouseLabel &&
    a.purchaseType === b.purchaseType &&
    a.discountRial === b.discountRial &&
    a.vatRial === b.vatRial &&
    (a.note ?? '') === (b.note ?? '')
  )
}

function buildLine(form: LineForm): { ok: true; line: ReceiptLineInput } | { ok: false; message: string } {
  const drugId = form.drugId.trim()
  const batchNo = form.batchNo.trim()
  const expiry = form.expiry.trim()
  const quantity = parseNonNegativeInt(form.quantity)
  const buyPriceRial = parseNonNegativeInt(form.buyPrice)
  const consumerRaw = form.consumerPrice.trim()
  const consumerPriceRial = consumerRaw ? parseNonNegativeInt(consumerRaw) : undefined
  if (!drugId) return { ok: false, message: 'شناسه دارو الزامی است.' }
  if (!batchNo) return { ok: false, message: 'شماره سری ساخت الزامی است.' }
  if (!isIsoDate(expiry)) return { ok: false, message: 'تاریخ انقضا باید به‌صورت میلادی YYYY-MM-DD باشد.' }
  if (quantity === null || quantity <= 0) return { ok: false, message: 'تعداد باید عدد صحیح بزرگ‌تر از صفر باشد.' }
  if (buyPriceRial === null) return { ok: false, message: 'قیمت خرید باید عدد صحیح ریال باشد.' }
  if (consumerRaw && consumerPriceRial === null) {
    return { ok: false, message: 'قیمت مصرف‌کننده باید عدد صحیح ریال باشد.' }
  }
  return {
    ok: true,
    line: {
      drugId,
      batchNo,
      expiry,
      quantity,
      unitLabel: form.unitLabel.trim() || 'عدد',
      buyPriceRial,
      consumerPriceRial: consumerPriceRial ?? undefined,
      gtin: form.gtin.trim() || undefined,
      irc: form.irc.trim() || undefined,
    },
  }
}

function lineToForm(line: ReceiptLine): LineForm {
  return {
    drugId: line.drugId,
    nameFa: line.nameFa,
    gtin: line.gtin ?? '',
    irc: line.irc ?? '',
    batchNo: line.batchNo,
    expiry: line.expiry.slice(0, 10),
    quantity: String(line.quantity),
    unitLabel: line.unitLabel || 'عدد',
    buyPrice: String(line.buyPriceRial),
    consumerPrice:
      typeof line.consumerPriceRial === 'number' ? String(line.consumerPriceRial) : '',
  }
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function InvoiceReceiptsView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const receiptId = searchParams.get('receiptId')?.trim() ?? ''

  const [receipt, setReceipt] = React.useState<InvoiceReceipt | null>(null)
  const [step, setStep] = React.useState<WizardStep>(1)
  const [headerForm, setHeaderForm] = React.useState<HeaderForm>(EMPTY_HEADER)
  const [lineForm, setLineForm] = React.useState<LineForm>(EMPTY_LINE)
  const [editingLineId, setEditingLineId] = React.useState<string | null>(null)
  const [shelfDrafts, setShelfDrafts] = React.useState<Record<string, ShelfDraft>>({})
  const [drugQuery, setDrugQuery] = React.useState('')
  const [drugHits, setDrugHits] = React.useState<Drug[]>([])
  const [loadState, setLoadState] = React.useState<'loading' | 'ready' | 'error'>(
    receiptId ? 'loading' : 'ready',
  )
  const [loadError, setLoadError] = React.useState('')
  const [retry, setRetry] = React.useState(0)
  const [busy, setBusy] = React.useState(false)
  const [loadedReceiptId, setLoadedReceiptId] = React.useState('')
  const [trackedReceiptId, setTrackedReceiptId] = React.useState(receiptId)

  const shelfChain = React.useRef<Promise<void>>(Promise.resolve())
  const headerChain = React.useRef<Promise<void>>(Promise.resolve())
  const receiptRef = React.useRef<InvoiceReceipt | null>(receipt)
  const headerFormRef = React.useRef(headerForm)
  const shelfDraftsRef = React.useRef(shelfDrafts)
  /** True from pointerdown on Next/Confirm until click or a cancelled release. */
  const pointerFoldRef = React.useRef(false)
  /** In-flight Next/Confirm/header ops. Blur must not PATCH while this is positive. */
  const opHoldRef = React.useRef(0)
  const foldReleaseRef = React.useRef<((ev: PointerEvent) => void) | null>(null)
  const drugTimer = React.useRef<number | null>(null)

  React.useEffect(() => {
    receiptRef.current = receipt
    headerFormRef.current = headerForm
    shelfDraftsRef.current = shelfDrafts
  }, [receipt, headerForm, shelfDrafts])

  if (receiptId !== trackedReceiptId) {
    setTrackedReceiptId(receiptId)
    if (!receiptId) {
      setLoadedReceiptId('')
      setReceipt(null)
      setHeaderForm(EMPTY_HEADER)
      setShelfDrafts({})
      setStep(1)
      setLineForm(EMPTY_LINE)
      setEditingLineId(null)
      setDrugQuery('')
      setDrugHits([])
      setLoadState('ready')
      setLoadError('')
    } else if (loadedReceiptId !== receiptId) {
      setLoadState('loading')
      setLoadError('')
    }
  }

  const readOnly = receipt !== null && receipt.status !== 'draft'

  function remember(next: InvoiceReceipt, resetShelves = false) {
    receiptRef.current = next
    setLoadedReceiptId(next.id)
    setReceipt(next)
    setShelfDrafts((prev) => {
      if (resetShelves) return draftsFrom(next)
      const merged: Record<string, ShelfDraft> = {}
      for (const line of next.lines) {
        merged[line.id] = prev[line.id] ?? {
          locationLabel: line.locationLabel ?? '',
          binId: line.binId ?? '',
          zone: line.zone ?? '',
        }
      }
      return merged
    })
  }

  React.useEffect(() => {
    if (!receiptId || loadedReceiptId === receiptId) return
    let cancelled = false
    getReceipt(receiptId)
      .then((loaded) => {
        if (cancelled) return
        setLoadedReceiptId(loaded.id)
        setReceipt(loaded)
        setHeaderForm(headerFromReceipt(loaded.header))
        setShelfDrafts(draftsFrom(loaded))
        setStep(loaded.status === 'draft' ? loaded.currentStep : 3)
        setLoadState('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(errorMessage(err))
        setLoadState('error')
      })
    return () => {
      cancelled = true
    }
  }, [receiptId, loadedReceiptId, retry])

  React.useEffect(() => {
    return () => {
      if (drugTimer.current !== null) window.clearTimeout(drugTimer.current)
      if (foldReleaseRef.current) {
        window.removeEventListener('pointerup', foldReleaseRef.current, true)
        window.removeEventListener('pointercancel', foldReleaseRef.current, true)
      }
    }
  }, [])

  function onDrugQueryChange(value: string) {
    setDrugQuery(value)
    if (drugTimer.current !== null) window.clearTimeout(drugTimer.current)
    const query = value.trim()
    if (query.length < 2) {
      setDrugHits([])
      return
    }
    drugTimer.current = window.setTimeout(() => {
      fetchDrugs({ search: query, page: 1, pageSize: 8 })
        .then((result) => setDrugHits(result.items))
        .catch(() => setDrugHits([]))
    }, 300)
  }

  const discountRial = parseNonNegativeInt(headerForm.discountRial) ?? 0
  const vatRial = parseNonNegativeInt(headerForm.vatRial) ?? 0
  const totals = computeReceiptTotals(receipt?.lines ?? [], discountRial, vatRial)

  const preview = React.useMemo(() => {
    if (!receipt) return null
    return {
      ...receipt,
      lines: receipt.lines.map((line) => {
        const draft = shelfDrafts[line.id]
        if (!draft) return line
        return {
          ...line,
          locationLabel: draft.locationLabel.trim() || undefined,
          binId: draft.binId.trim() || undefined,
          zone: draft.zone.trim() || undefined,
        }
      }),
    }
  }, [receipt, shelfDrafts])

  const maxReached: WizardStep = receipt?.currentStep ?? 1

  function stepStatus(index: WizardStep): StepStatus {
    if (index === step) return 'current'
    if (readOnly || index <= maxReached || index < step) return 'completed'
    return 'upcoming'
  }

  const steps: StepperStep[] = ([1, 2, 3] as const).map((index) => {
    const status = stepStatus(index)
    let description = ''
    if (index === 1) {
      description = receipt
        ? `${receipt.header.distributor || '—'} • ${receipt.header.invoiceNo || '—'}`
        : 'شماره فاکتور، شرکت پخش و انبار'
    } else if (index === 2) {
      description = receipt
        ? `${toPersianDigits(receipt.lines.length)} قلم ثبت شده`
        : 'بارکد، سری ساخت و قیمت خرید'
    } else {
      description = readOnly ? 'ورود قطعی انجام شد' : 'تخصیص قفسه و تایید کاردکس'
    }
    return {
      id: String(index),
      label: STEP_LABELS[index],
      description,
      meta: `گام ${toPersianDigits(index)} • ${STEP_META[status]}`,
      status,
    }
  })

  function updateShelf(lineId: string, patch: Partial<ShelfDraft>) {
    setShelfDrafts((prev) => {
      const current = prev[lineId] ?? { locationLabel: '', binId: '', zone: '' }
      return { ...prev, [lineId]: { ...current, ...patch } }
    })
  }

  function syncHeaderForm(saved: InvoiceReceipt) {
    const form = headerFromReceipt(saved.header)
    headerFormRef.current = form
    setHeaderForm(form)
  }

  function enqueueHeader(run: () => Promise<void>): Promise<void> {
    const task = headerChain.current.then(run, run)
    headerChain.current = task.then(
      () => undefined,
      () => undefined,
    )
    return task
  }

  async function runHeaderOp(run: () => Promise<void>) {
    opHoldRef.current += 1
    pointerFoldRef.current = false
    try {
      await enqueueHeader(run)
    } finally {
      opHoldRef.current = Math.max(0, opHoldRef.current - 1)
    }
  }

  async function writeMoney() {
    const current = receiptRef.current
    if (!current || current.status !== 'draft') return
    const discount = parseNonNegativeInt(headerFormRef.current.discountRial)
    const vat = parseNonNegativeInt(headerFormRef.current.vatRial)
    if (discount === null || vat === null) {
      toast.error('تخفیف و مالیات باید عدد صحیح ریال باشند.')
      return
    }
    if (discount === current.header.discountRial && vat === current.header.vatRial) return
    await shelfChain.current
    const latest = receiptRef.current
    if (!latest || latest.status !== 'draft') return
    if (discount === latest.header.discountRial && vat === latest.header.vatRial) return
    setBusy(true)
    try {
      const saved = await patchReceipt(latest.id, { discountRial: discount, vatRial: vat })
      remember(saved)
      syncHeaderForm(saved)
    } finally {
      setBusy(false)
    }
  }

  async function saveHeader() {
    await enqueueHeader(async () => {
      const built = buildHeader(headerFormRef.current)
      if (!built.ok) {
        toast.error(built.message)
        return
      }
      setBusy(true)
      try {
        const current = receiptRef.current
        const persistedStep: 2 | 3 = current?.currentStep === 3 ? 3 : 2
        let saved: InvoiceReceipt
        if (!current) {
          saved = await createReceipt(built.header)
          receiptRef.current = saved
          setLoadedReceiptId(saved.id)
          setReceipt(saved)
          router.replace(`/invoice-receipts?receiptId=${encodeURIComponent(saved.id)}`)
          saved = await patchReceipt(saved.id, { currentStep: persistedStep })
        } else {
          saved = await patchReceipt(current.id, {
            ...built.header,
            currentStep: persistedStep,
          })
        }
        remember(saved)
        syncHeaderForm(saved)
        setStep(2)
        toast.success('پیش‌نویس فاکتور ذخیره شد.')
      } catch (err) {
        toast.error(errorMessage(err))
      } finally {
        setBusy(false)
      }
    })
  }

  async function lookupDrug() {
    const id = lineForm.drugId.trim()
    if (!id) {
      toast.error('شناسه دارو را وارد کنید.')
      return
    }
    setBusy(true)
    try {
      const drug = await apiFindDrugById(id)
      if (!drug) {
        toast.error('دارویی با این شناسه در کاتالوگ نیست.')
        return
      }
      setLineForm((form) => ({
        ...form,
        drugId: drug.id,
        nameFa: drug.nameFa,
        gtin: form.gtin || drug.gtin,
      }))
      setDrugQuery(drug.nameFa)
      setDrugHits([])
      toast.success(`دارو انتخاب شد: ${drug.nameFa}`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function pickDrug(drug: Drug) {
    setLineForm((form) => ({
      ...form,
      drugId: drug.id,
      nameFa: drug.nameFa,
      gtin: form.gtin || drug.gtin,
    }))
    setDrugQuery(drug.nameFa)
    setDrugHits([])
  }

  async function submitLine() {
    const current = receipt
    if (!current || current.status !== 'draft') {
      toast.error('ابتدا سربرگ فاکتور را ذخیره کنید.')
      return
    }
    const built = buildLine(lineForm)
    if (!built.ok) {
      toast.error(built.message)
      return
    }
    setBusy(true)
    try {
      const saved = editingLineId
        ? await patchReceiptLine(current.id, editingLineId, built.line)
        : await addReceiptLine(current.id, built.line)
      remember(saved)
      setLineForm(EMPTY_LINE)
      setEditingLineId(null)
      setDrugQuery('')
      setDrugHits([])
      toast.success(editingLineId ? 'قلم فاکتور به‌روز شد.' : 'قلم به فاکتور اضافه شد.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function removeLine(lineId: string) {
    const current = receipt
    if (!current || current.status !== 'draft') return
    setBusy(true)
    try {
      const saved = await deleteReceiptLine(current.id, lineId)
      remember(saved)
      if (editingLineId === lineId) {
        setEditingLineId(null)
        setLineForm(EMPTY_LINE)
      }
      toast.success('قلم از فاکتور حذف شد.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function saveShelfLine(lineId: string, draft: ShelfDraft) {
    const current = receipt
    if (!current || current.status !== 'draft') return
    const run = async () => {
      const line = current.lines.find((item) => item.id === lineId)
      if (!line) return
      const locationLabel = draft.locationLabel.trim()
      const binId = draft.binId.trim()
      const zone = draft.zone.trim()
      const unchanged =
        (line.locationLabel ?? '') === locationLabel &&
        (line.binId ?? '') === binId &&
        (line.zone ?? '') === zone
      if (unchanged) return
      const updated = await patchReceiptLine(current.id, lineId, {
        locationLabel,
        binId,
        zone,
      })
      remember(updated)
    }
    shelfChain.current = shelfChain.current.then(run, run).catch((err: unknown) => {
      toast.error(errorMessage(err))
    })
  }

  async function persistShelves(
    current: InvoiceReceipt,
    drafts: Record<string, ShelfDraft>,
  ): Promise<InvoiceReceipt> {
    let latest = current
    for (const line of current.lines) {
      const draft = drafts[line.id]
      if (!draft) continue
      const locationLabel = draft.locationLabel.trim()
      const binId = draft.binId.trim()
      const zone = draft.zone.trim()
      const unchanged =
        (line.locationLabel ?? '') === locationLabel &&
        (line.binId ?? '') === binId &&
        (line.zone ?? '') === zone
      if (unchanged) continue
      latest = await patchReceiptLine(latest.id, line.id, { locationLabel, binId, zone })
    }
    remember(latest)
    return latest
  }

  function persistMoney() {
    if (pointerFoldRef.current || opHoldRef.current > 0) return
    void enqueueHeader(async () => {
      try {
        await writeMoney()
      } catch (err) {
        toast.error(errorMessage(err))
      }
    })
  }

  function armMoneyFold(event: React.PointerEvent<HTMLButtonElement>) {
    pointerFoldRef.current = true
    if (foldReleaseRef.current) {
      window.removeEventListener('pointerup', foldReleaseRef.current, true)
      window.removeEventListener('pointercancel', foldReleaseRef.current, true)
    }
    const button = event.currentTarget
    const onRelease = (ev: PointerEvent) => {
      window.removeEventListener('pointerup', onRelease, true)
      window.removeEventListener('pointercancel', onRelease, true)
      if (foldReleaseRef.current === onRelease) foldReleaseRef.current = null
      const onButton = ev.target instanceof Node && button.contains(ev.target)
      if (!onButton) {
        pointerFoldRef.current = false
        if (opHoldRef.current === 0) persistMoney()
      }
    }
    foldReleaseRef.current = onRelease
    window.addEventListener('pointerup', onRelease, true)
    window.addEventListener('pointercancel', onRelease, true)
  }

  async function advanceToShelves() {
    await runHeaderOp(async () => {
      const current = receiptRef.current
      if (!current) {
        toast.error('ابتدا سربرگ فاکتور را ذخیره کنید.')
        return
      }
      if (!canAdvanceToStep3(current.lines)) {
        toast.error('برای ادامه، حداقل یک قلم کامل با دارو، سری ساخت، انقضا و تعداد لازم است.')
        try {
          await writeMoney()
        } catch (err) {
          toast.error(errorMessage(err))
        }
        return
      }
      const discount = parseNonNegativeInt(headerFormRef.current.discountRial)
      const vat = parseNonNegativeInt(headerFormRef.current.vatRial)
      if (discount === null || vat === null) {
        toast.error('تخفیف و مالیات باید عدد صحیح ریال باشند.')
        return
      }
      await shelfChain.current
      const latest = receiptRef.current ?? current
      if (
        discount === latest.header.discountRial &&
        vat === latest.header.vatRial &&
        latest.currentStep >= 3
      ) {
        setStep(3)
        return
      }
      setBusy(true)
      try {
        const saved = await patchReceipt(latest.id, {
          discountRial: discount,
          vatRial: vat,
          currentStep: 3,
        })
        remember(saved)
        syncHeaderForm(saved)
        setStep(3)
      } catch (err) {
        toast.error(errorMessage(err))
      } finally {
        setBusy(false)
      }
    })
  }

  async function confirmDraft() {
    await runHeaderOp(async () => {
      const current = receiptRef.current
      if (!current || current.status !== 'draft') return
      const built = buildHeader(headerFormRef.current)
      if (!built.ok) {
        toast.error(built.message)
        setStep(1)
        return
      }
      setBusy(true)
      try {
        await shelfChain.current
        let latest = receiptRef.current ?? current
        if (!sameHeader(built.header, latest.header)) {
          latest = await patchReceipt(latest.id, built.header)
          remember(latest)
          syncHeaderForm(latest)
        }
        latest = await persistShelves(latest, shelfDraftsRef.current)
        if (!canConfirmReceipt(latest)) {
          toast.error('برای تایید، هر قلم باید قفسه یا شناسه قفسه داشته باشد.')
          setStep(3)
          return
        }
        const confirmed = await confirmReceipt(latest.id)
        remember(confirmed, true)
        syncHeaderForm(confirmed)
        setStep(3)
        toast.success('رسید انبار تایید شد. موجودی، کاردکس و گزارش ممیزی به‌روز شد.')
      } catch (err) {
        toast.error(errorMessage(err))
      } finally {
        setBusy(false)
      }
    })
  }

  const columns: DenseColumn<ReceiptLine>[] = [
    {
      id: 'drug',
      header: 'دارو',
      cell: (row) => (
        <div>
          <div className="font-semibold text-text-primary">{row.nameFa || '—'}</div>
          <div className="text-label-sm text-text-secondary" dir="ltr">
            {row.drugId}
          </div>
        </div>
      ),
    },
    {
      id: 'batch',
      header: 'سری ساخت',
      cell: (row) => <span className="tabular-nums-data">{row.batchNo}</span>,
    },
    {
      id: 'expiry',
      header: 'انقضا',
      cell: (row) => <span className="tabular-nums-data">{displayDate(row.expiry)}</span>,
    },
    {
      id: 'quantity',
      header: 'تعداد',
      align: 'end',
      cell: (row) => (
        <span>
          <span className="tabular-nums-data font-semibold">
            {formatPersianNumber(row.quantity)}
          </span>{' '}
          <span className="text-text-secondary">{row.unitLabel}</span>
        </span>
      ),
    },
    {
      id: 'price',
      header: 'قیمت خرید',
      align: 'end',
      cell: (row) => (
        <span className="tabular-nums-data">{formatRial(row.buyPriceRial)}</span>
      ),
    },
    {
      id: 'gtin',
      header: 'GTIN',
      cell: (row) => (
        <span className="tabular-nums-data" dir="ltr">
          {row.gtin || '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'اقدام',
      cell: (row) =>
        readOnly ? (
          <span className="text-label-sm text-text-secondary">فقط مشاهده</span>
        ) : (
          <div className="flex items-center gap-1">
            <ActionTooltip title="ویرایش قلم رسید">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingLineId(row.id)
                  setLineForm(lineToForm(row))
                  setDrugQuery(row.nameFa)
                }}
              >
                ویرایش
              </Button>
            </ActionTooltip>
            <ActionTooltip title="حذف قلم از رسید">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="حذف قلم"
                onClick={() => void removeLine(row.id)}
              >
                <Icon name="delete" size={16} data-slot="icon" />
              </Button>
            </ActionTooltip>
          </div>
        ),
    },
  ]

  const shell = (children: React.ReactNode) => (
    <AppShell
      navItems={getReceiptNavItems('receipts')}
      sidebar={{
        brand: {
          title: 'انبار دارو',
          subtitle: 'سامانه جامع موجودی داروخانه',
        },
      }}
      header={{
        branchLabel: 'داروخانه دکتر حسینی (مرکزی)',
        searchPlaceholder: 'جستجوی نام دارو، کد ژنریک، بارکد یا شناسه IRC...',
      }}
      contentClassName="space-y-4"
    >
      <PageHeader
        title="ورود فاکتور و رسید انبار"
        description="ثبت فاکتور شرکت پخش، بارکد اسکن، تطبیق سری ساخت و قیمت‌گذاری مصوب سازمان غذا و دارو"
        breadcrumbs={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">مدیریت داروخانه</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>عملیات انبارداری</BreadcrumbPage>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>ورود فاکتور و رسید انبار</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
        actions={
          receipt ? (
            <Badge variant={receipt.status === 'confirmed' ? 'valid' : 'warning'}>
              {STATUS_LABEL[receipt.status]}
            </Badge>
          ) : (
            <Badge variant="neutral">فاکتور جدید</Badge>
          )
        }
      />
      {children}
    </AppShell>
  )

  if (loadState === 'loading') {
    return shell(
      <div
        data-slot="invoice-receipts-skeleton"
        className="space-y-6 py-2"
        aria-busy="true"
        aria-label="در حال بارگذاری پیش‌نویس فاکتور"
      >
        <div className="grid grid-cols-1 gap-4 rounded-default border border-border-default bg-card p-4 md:grid-cols-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-4 rounded-default border border-border-default bg-card p-6">
          <div className="flex items-center justify-between border-b border-border-subtle pb-4">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-8 w-28" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <div className="space-y-3 rounded-default border border-border-default bg-card p-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-9 w-32" />
          </div>
          <div className="space-y-2 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
        <p className="text-center text-body-sm text-text-secondary">
          در حال بارگذاری پیش‌نویس فاکتور…
        </p>
      </div>,
    )
  }

  if (loadState === 'error') {
    return shell(
      <AlertBanner
        tone="critical"
        title="بارگذاری فاکتور ناموفق بود"
        description={loadError}
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setLoadedReceiptId('')
              setLoadState('loading')
              setRetry((value) => value + 1)
            }}
          >
            تلاش دوباره
          </Button>
        }
      />,
    )
  }

  const firstDrugId = receipt?.lines[0]?.drugId

  return shell(
    <>
      {receipt?.status === 'confirmed' ? (
        <AlertBanner
          tone="valid"
          title="رسید تایید شد"
          description="موجودی، کاردکس و گزارش ممیزی به‌روز شد. ویرایش این فاکتور بسته است."
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href="/expiry-alerts-fefo">هشدارهای انقضا</Link>
              </Button>
              {firstDrugId ? (
                <Button variant="outline" asChild>
                  <Link href={`/drug-details-cardex?drugId=${encodeURIComponent(firstDrugId)}`}>
                    کاردکس دارو
                  </Link>
                </Button>
              ) : null}
            </div>
          }
        />
      ) : null}

      <div data-testid="receipt-stepper">
        <Stepper
          steps={steps}
          currentStepId={String(step)}
          onStepSelect={(id) => {
            const next = Number(id)
            if (next === 1 || next === 2 || next === 3) setStep(next)
          }}
        />
      </div>

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>خلاصه پرونده فاکتور و مجوز حمل</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid grid-cols-1 gap-4 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault()
                void saveHeader()
              }}
            >
              <Field label="شماره فاکتور توزیع‌کننده" htmlFor="receipt-invoice-no">
                <Input
                  id="receipt-invoice-no"
                  data-testid="receipt-invoice-no"
                  value={headerForm.invoiceNo}
                  disabled={readOnly}
                  onChange={(event) =>
                    setHeaderForm((form) => ({ ...form, invoiceNo: event.target.value }))
                  }
                />
              </Field>
              <Field label="شرکت پخش طرف قرارداد" htmlFor="receipt-distributor">
                <Input
                  id="receipt-distributor"
                  data-testid="receipt-distributor"
                  value={headerForm.distributor}
                  disabled={readOnly}
                  onChange={(event) =>
                    setHeaderForm((form) => ({ ...form, distributor: event.target.value }))
                  }
                />
              </Field>
              <Field label="تاریخ صدور" htmlFor="receipt-issued-at">
                <DatePicker
                  id="receipt-issued-at"
                  data-testid="receipt-issued-at"
                  value={headerForm.issuedAt}
                  disabled={readOnly}
                  placeholder="انتخاب تاریخ صدور"
                  onChange={(issuedAt) =>
                    setHeaderForm((form) => ({ ...form, issuedAt }))
                  }
                />
              </Field>
              <Field label="تاریخ دریافت" htmlFor="receipt-received-at">
                <DatePicker
                  id="receipt-received-at"
                  data-testid="receipt-received-at"
                  value={headerForm.receivedAt}
                  disabled={readOnly}
                  placeholder="انتخاب تاریخ دریافت"
                  onChange={(receivedAt) =>
                    setHeaderForm((form) => ({ ...form, receivedAt }))
                  }
                />
              </Field>
              <Field label="انبار مقصد" htmlFor="receipt-warehouse">
                <Input
                  id="receipt-warehouse"
                  data-testid="receipt-warehouse"
                  value={headerForm.warehouseLabel}
                  disabled={readOnly}
                  onChange={(event) =>
                    setHeaderForm((form) => ({
                      ...form,
                      warehouseLabel: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="نوع خرید" htmlFor="receipt-purchase-type">
                <Select
                  value={headerForm.purchaseType}
                  disabled={readOnly}
                  onValueChange={(value) =>
                    setHeaderForm((form) => ({
                      ...form,
                      purchaseType: value as PurchaseType,
                    }))
                  }
                >
                  <SelectTrigger id="receipt-purchase-type" data-testid="receipt-purchase-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {PURCHASE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="تخفیف نقدی (ریال)" htmlFor="receipt-discount">
                <Input
                  id="receipt-discount"
                  data-testid="receipt-discount"
                  inputMode="numeric"
                  value={headerForm.discountRial}
                  disabled={readOnly}
                  onChange={(event) =>
                    setHeaderForm((form) => ({ ...form, discountRial: event.target.value }))
                  }
                />
              </Field>
              <Field label="مالیات بر ارزش افزوده (ریال)" htmlFor="receipt-vat">
                <Input
                  id="receipt-vat"
                  data-testid="receipt-vat"
                  inputMode="numeric"
                  value={headerForm.vatRial}
                  disabled={readOnly}
                  onChange={(event) =>
                    setHeaderForm((form) => ({ ...form, vatRial: event.target.value }))
                  }
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="یادداشت" htmlFor="receipt-note">
                  <Textarea
                    id="receipt-note"
                    data-testid="receipt-note"
                    value={headerForm.note}
                    disabled={readOnly}
                    onChange={(event) =>
                      setHeaderForm((form) => ({ ...form, note: event.target.value }))
                    }
                  />
                </Field>
              </div>
              <div className="flex justify-end md:col-span-2">
                <Button
                  type="submit"
                  data-testid="receipt-save-header"
                  loading={busy}
                  disabled={readOnly}
                >
                  <Icon name="save" size={18} data-slot="icon" />
                  ذخیره پیش‌نویس و ادامه
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="barcode_scanner" size={20} data-slot="icon" />
                میز کار اسکن بارکد، ثبت سری ساخت و ورود سریع قلم دارو
              </CardTitle>
            </CardHeader>
            <CardContent>
              {receipt ? (
                <p className="mb-4 text-body-sm text-text-secondary">
                  فاکتور {receipt.header.invoiceNo} • {receipt.header.distributor} • صدور{' '}
                  {displayDate(receipt.header.issuedAt)} • دریافت{' '}
                  {displayDate(receipt.header.receivedAt)}
                </p>
              ) : (
                <p className="mb-4 text-body-sm text-text-secondary">
                  برای افزودن قلم، ابتدا سربرگ را در گام اول ذخیره کنید.
                </p>
              )}
              <form
                className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  void submitLine()
                }}
              >
                <div className="relative md:col-span-2">
                  <Field label="جستجوی دارو" htmlFor="receipt-drug-search">
                    <Input
                      id="receipt-drug-search"
                      data-testid="receipt-drug-search"
                      placeholder="نام، برند یا GTIN"
                      value={drugQuery}
                      disabled={readOnly || !receipt}
                      onChange={(event) => onDrugQueryChange(event.target.value)}
                    />
                  </Field>
                  {drugHits.length > 0 ? (
                    <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-default border border-border-default bg-surface shadow-none">
                      {drugHits.map((drug) => (
                        <li key={drug.id}>
                          <button
                            type="button"
                            className="flex w-full flex-col items-start px-3 py-2 text-start hover:bg-surface-hover"
                            onClick={() => pickDrug(drug)}
                          >
                            <span className="text-body-md text-text-primary">{drug.nameFa}</span>
                            <span className="text-label-sm text-text-secondary" dir="ltr">
                              {drug.id} • {drug.gtin}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <Field label="شناسه دارو" htmlFor="receipt-drug-id">
                  <div className="flex gap-2">
                    <Input
                      id="receipt-drug-id"
                      data-testid="receipt-drug-id"
                      value={lineForm.drugId}
                      disabled={readOnly || !receipt}
                      placeholder="drug-amox"
                      onChange={(event) =>
                        setLineForm((form) => ({ ...form, drugId: event.target.value }))
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={readOnly || !receipt || busy}
                      onClick={() => void lookupDrug()}
                    >
                      بازیابی
                    </Button>
                  </div>
                </Field>
                <Field label="نام دارو" htmlFor="receipt-drug-name">
                  <Input id="receipt-drug-name" value={lineForm.nameFa} readOnly placeholder="پس از انتخاب" />
                </Field>
                <Field label="GTIN / TTAC" htmlFor="receipt-gtin">
                  <Input
                    id="receipt-gtin"
                    data-testid="receipt-gtin"
                    value={lineForm.gtin}
                    disabled={readOnly || !receipt}
                    onChange={(event) =>
                      setLineForm((form) => ({ ...form, gtin: event.target.value }))
                    }
                  />
                </Field>
                <Field label="IRC" htmlFor="receipt-irc">
                  <Input
                    id="receipt-irc"
                    value={lineForm.irc}
                    disabled={readOnly || !receipt}
                    onChange={(event) =>
                      setLineForm((form) => ({ ...form, irc: event.target.value }))
                    }
                  />
                </Field>
                <Field label="سری ساخت" htmlFor="receipt-batch">
                  <Input
                    id="receipt-batch"
                    data-testid="receipt-batch"
                    value={lineForm.batchNo}
                    disabled={readOnly || !receipt}
                    placeholder="M9041"
                    onChange={(event) =>
                      setLineForm((form) => ({ ...form, batchNo: event.target.value }))
                    }
                  />
                </Field>
                <Field label="تاریخ انقضا" htmlFor="receipt-expiry">
                  <DatePicker
                    id="receipt-expiry"
                    data-testid="receipt-expiry"
                    value={lineForm.expiry}
                    disabled={readOnly || !receipt}
                    placeholder="انتخاب تاریخ انقضا"
                    onChange={(expiry) =>
                      setLineForm((form) => ({ ...form, expiry }))
                    }
                  />
                </Field>
                <Field label="تعداد" htmlFor="receipt-qty">
                  <Input
                    id="receipt-qty"
                    data-testid="receipt-qty"
                    inputMode="numeric"
                    value={lineForm.quantity}
                    disabled={readOnly || !receipt}
                    onChange={(event) =>
                      setLineForm((form) => ({ ...form, quantity: event.target.value }))
                    }
                  />
                </Field>
                <Field label="واحد" htmlFor="receipt-unit">
                  <Input
                    id="receipt-unit"
                    value={lineForm.unitLabel}
                    disabled={readOnly || !receipt}
                    onChange={(event) =>
                      setLineForm((form) => ({ ...form, unitLabel: event.target.value }))
                    }
                  />
                </Field>
                <Field label="قیمت خرید (ریال)" htmlFor="receipt-buy-price">
                  <Input
                    id="receipt-buy-price"
                    data-testid="receipt-buy-price"
                    inputMode="numeric"
                    value={lineForm.buyPrice}
                    disabled={readOnly || !receipt}
                    onChange={(event) =>
                      setLineForm((form) => ({ ...form, buyPrice: event.target.value }))
                    }
                  />
                </Field>
                <Field label="قیمت مصرف‌کننده (ریال)" htmlFor="receipt-consumer-price">
                  <Input
                    id="receipt-consumer-price"
                    inputMode="numeric"
                    value={lineForm.consumerPrice}
                    disabled={readOnly || !receipt}
                    onChange={(event) =>
                      setLineForm((form) => ({ ...form, consumerPrice: event.target.value }))
                    }
                  />
                </Field>
                <div className="flex items-end gap-2 md:col-span-2 xl:col-span-4">
                  {editingLineId ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingLineId(null)
                        setLineForm(EMPTY_LINE)
                        setDrugQuery('')
                      }}
                    >
                      انصراف از ویرایش
                    </Button>
                  ) : null}
                  <Button
                    type="submit"
                    data-testid="receipt-add-line"
                    loading={busy}
                    disabled={readOnly || !receipt}
                  >
                    <Icon name="add_circle" size={18} data-slot="icon" />
                    {editingLineId ? 'به‌روزرسانی قلم' : 'افزودن به لیست فاکتور'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div data-testid="receipt-lines">
            <DenseDataTable
              columns={columns}
              data={receipt?.lines ?? []}
              getRowId={(row) => row.id}
              emptyMessage="هنوز قلمی به فاکتور اضافه نشده است."
              caption="اقلام فاکتور"
            />
          </div>
          <TotalsStrip
            gross={totals.grossRial}
            net={totals.netRial}
            discount={headerForm.discountRial}
            vat={headerForm.vatRial}
            disabled={readOnly || !receipt}
            onDiscount={(value) => setHeaderForm((form) => ({ ...form, discountRial: value }))}
            onVat={(value) => setHeaderForm((form) => ({ ...form, vatRial: value }))}
            onBlur={() => void persistMoney()}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-4">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              بازگشت به سربرگ
            </Button>
            <Button
              type="button"
              data-testid="receipt-next"
              loading={busy}
              disabled={!receipt || !canAdvanceToStep3(receipt.lines)}
              onPointerDown={armMoneyFold}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void advanceToShelves()}
            >
              تایید و ورود به مرحله بعد (تخصیص قفسه و انبارش)
            </Button>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>تخصیص قفسه و ورود قطعی</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {receipt?.lines.length ? (
                receipt.lines.map((line) => {
                  const draft = shelfDrafts[line.id] ?? {
                    locationLabel: '',
                    binId: '',
                    zone: '',
                  }
                  return (
                    <div
                      key={line.id}
                      className="grid grid-cols-1 gap-3 rounded-default border border-border-default p-3 md:grid-cols-4"
                      data-testid={`receipt-shelf-${line.id}`}
                    >
                      <div>
                        <div className="font-semibold text-text-primary">{line.nameFa}</div>
                        <div className="text-label-sm text-text-secondary">
                          سری {line.batchNo} • انقضا {displayDate(line.expiry)} •{' '}
                          {formatPersianNumber(line.quantity)} {line.unitLabel}
                        </div>
                      </div>
                      <Field label="قفسه انبار" htmlFor={`receipt-location-${line.id}`}>
                        <Input
                          id={`receipt-location-${line.id}`}
                          data-testid={`receipt-location-${line.id}`}
                          aria-label="قفسه انبار"
                          placeholder="B-12"
                          value={draft.locationLabel}
                          disabled={readOnly}
                          onChange={(event) =>
                            updateShelf(line.id, { locationLabel: event.target.value })
                          }
                          onBlur={(event) =>
                            saveShelfLine(line.id, {
                              ...draft,
                              locationLabel: event.currentTarget.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="شناسه قفسه" htmlFor={`receipt-bin-${line.id}`}>
                        <Input
                          id={`receipt-bin-${line.id}`}
                          data-testid={`receipt-bin-${line.id}`}
                          aria-label="شناسه قفسه"
                          value={draft.binId}
                          disabled={readOnly}
                          onChange={(event) => updateShelf(line.id, { binId: event.target.value })}
                          onBlur={(event) =>
                            saveShelfLine(line.id, {
                              ...draft,
                              binId: event.currentTarget.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="ناحیه" htmlFor={`receipt-zone-${line.id}`}>
                        <Select
                          value={draft.zone || 'none'}
                          disabled={readOnly}
                          onValueChange={(value) => {
                            const zone = value === 'none' ? '' : value
                            updateShelf(line.id, { zone })
                            saveShelfLine(line.id, { ...draft, zone })
                          }}
                        >
                          <SelectTrigger id={`receipt-zone-${line.id}`} aria-label="ناحیه نگهداری">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="none">بدون ناحیه</SelectItem>
                              {SHELF_ZONES.map((zone) => (
                                <SelectItem key={zone.id} value={zone.id}>
                                  {zone.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  )
                })
              ) : (
                <p className="text-body-sm text-text-secondary">قلمی برای انبارش ثبت نشده است.</p>
              )}
            </CardContent>
          </Card>
          <TotalsStrip
            gross={totals.grossRial}
            net={totals.netRial}
            discount={headerForm.discountRial}
            vat={headerForm.vatRial}
            disabled={readOnly || !receipt}
            onDiscount={(value) => setHeaderForm((form) => ({ ...form, discountRial: value }))}
            onVat={(value) => setHeaderForm((form) => ({ ...form, vatRial: value }))}
            onBlur={() => void persistMoney()}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-4">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>
              بازگشت به اقلام
            </Button>
            <Button
              type="button"
              data-testid="receipt-confirm"
              loading={busy}
              disabled={readOnly || !preview || !canConfirmReceipt(preview)}
              onPointerDown={armMoneyFold}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void confirmDraft()}
            >
              <Icon name="check_circle" size={18} data-slot="icon" />
              تایید و ورود قطعی به انبار
            </Button>
          </div>
        </>
      ) : null}
    </>,
  )
}

function TotalsStrip({
  gross,
  net,
  discount,
  vat,
  disabled,
  onDiscount,
  onVat,
  onBlur,
}: {
  gross: number
  net: number
  discount: string
  vat: string
  disabled: boolean
  onDiscount: (value: string) => void
  onVat: (value: string) => void
  onBlur: () => void
}) {
  return (
    <Card>
      <CardContent className="grid grid-cols-1 gap-3 pt-4 md:grid-cols-4">
        <div>
          <div className="text-label-sm text-text-secondary">جمع ناخالص</div>
          <div className="tabular-nums-data font-semibold">{formatRial(gross)}</div>
        </div>
        <Field label="تخفیف نقدی فاکتور" htmlFor="receipt-discount-strip">
          <Input
            id="receipt-discount-strip"
            inputMode="numeric"
            value={discount}
            disabled={disabled}
            onChange={(event) => onDiscount(event.target.value)}
            onBlur={onBlur}
          />
        </Field>
        <Field label="مالیات بر ارزش افزوده" htmlFor="receipt-vat-strip">
          <Input
            id="receipt-vat-strip"
            inputMode="numeric"
            value={vat}
            disabled={disabled}
            onChange={(event) => onVat(event.target.value)}
            onBlur={onBlur}
          />
        </Field>
        <div>
          <div className="text-label-sm text-text-secondary">مبلغ قابل پرداخت فاکتور</div>
          <div className="tabular-nums-data text-title-md font-bold text-primary">
            {formatRial(net)}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export { InvoiceReceiptsView }
