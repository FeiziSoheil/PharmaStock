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
  Checkbox,
  Icon,
  Input,
  Label,
  Skeleton,
  Textarea,
} from '@/components/ui'
import { AppShell } from '@/components/layout'
import { AlertBanner, ConfirmDialog } from '@/components/shared'
import { ApiError } from '@/lib/api/http'
import { fetchDrugs } from '@/lib/drugs/data-access'
import {
  addDispenseLine,
  clearDispenseLines,
  confirmDispense,
  createDispense,
  deleteDispenseLine,
  patchDispense,
  patchDispenseLine,
  getDispense,
  type DispenseLineInput,
  type DispensePatch,
} from '@/lib/dispenses/data-access'
import { keepDraftFields } from '@/lib/dispenses/draft-merge'
import { canConfirmDispense, computeDispenseTotals } from '@/lib/dispenses/gating'
import {
  daysUntil,
  formatJalaliDate,
  formatPersianNumber,
  formatRial,
  normalizePersianText,
  toPersianDigits,
} from '@/lib/persian'
import { remainingDaysLabel } from '@/lib/expiry/expiry-query'
import type { Drug } from '@/lib/types/drugs'
import type {
  DispenseControlled,
  DispenseLine,
  DispenseOrder,
  DispensePatient,
  DispenseStatus,
} from '@/lib/types/dispenses'
import { cn } from '@/lib/utils'
import { getDispensingNavItems } from './nav'

type PatientForm = {
  nameFa: string
  nationalId: string
  insuranceLabel: string
  rxTrackingId: string
}

type FeeForm = {
  technicalFee: string
  insuranceCover: string
}

type ControlledForm = {
  physicianName: string
  physicianLicense: string
  recipientNationalId: string
  eRxTrackingId: string
  technicalAck: boolean
}

type ManualDraft = {
  batchId: string
  reason: string
}

const EMPTY_PATIENT: PatientForm = {
  nameFa: '',
  nationalId: '',
  insuranceLabel: '',
  rxTrackingId: '',
}

const EMPTY_FEES: FeeForm = {
  technicalFee: '0',
  insuranceCover: '0',
}

const STATUS_LABEL: Record<DispenseStatus, string> = {
  draft: 'پیش‌نویس',
  confirmed: 'تاییدشده',
  cancelled: 'لغوشده',
}

const PRINT_TOAST = 'در این نسخه فعال نیست.'

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

function displayDate(iso: string): string {
  if (!iso) return '—'
  const value = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso
  return formatJalaliDate(value)
}

function expiryLabel(iso: string): string {
  const shown = displayDate(iso)
  const days = daysUntil(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso)
  if (!Number.isFinite(days)) return shown
  return `${shown} (${toPersianDigits(remainingDaysLabel(days))})`
}

function patientFrom(order: DispenseOrder): PatientForm {
  return {
    nameFa: order.patient.nameFa,
    nationalId: order.patient.nationalId ?? '',
    insuranceLabel: order.patient.insuranceLabel ?? '',
    rxTrackingId: order.patient.rxTrackingId ?? '',
  }
}

function feesFrom(order: DispenseOrder): FeeForm {
  return {
    technicalFee: String(order.fees.technicalFee),
    insuranceCover: String(order.fees.insuranceCover),
  }
}

function controlledFrom(line: DispenseLine): ControlledForm {
  return {
    physicianName: line.controlled?.physicianName ?? '',
    physicianLicense: line.controlled?.physicianLicense ?? '',
    recipientNationalId: line.controlled?.recipientNationalId ?? '',
    eRxTrackingId: line.controlled?.eRxTrackingId ?? '',
    technicalAck: line.controlled?.technicalAck === true,
  }
}

function toControlled(form: ControlledForm): DispenseControlled {
  const license = form.physicianLicense.trim()
  return {
    physicianName: form.physicianName.trim(),
    physicianLicense: license || undefined,
    recipientNationalId: form.recipientNationalId.trim(),
    eRxTrackingId: form.eRxTrackingId.trim(),
    technicalAck: form.technicalAck,
  }
}

function controlledChanged(line: DispenseLine, form: ControlledForm): boolean {
  const current = controlledFrom(line)
  const next = toControlled(form)
  return (
    current.physicianName.trim() !== next.physicianName ||
    (current.physicianLicense ?? '').trim() !== (next.physicianLicense ?? '') ||
    current.recipientNationalId.trim() !== next.recipientNationalId ||
    current.eRxTrackingId.trim() !== next.eRxTrackingId ||
    current.technicalAck !== next.technicalAck
  )
}

function patientDiff(order: DispenseOrder, form: PatientForm): Partial<DispensePatient> | null {
  const next = {
    nameFa: form.nameFa.trim(),
    nationalId: form.nationalId.trim(),
    insuranceLabel: form.insuranceLabel.trim(),
    rxTrackingId: form.rxTrackingId.trim(),
  }
  const patch: Partial<DispensePatient> = {}
  if (next.nameFa !== order.patient.nameFa) patch.nameFa = next.nameFa
  if (next.nationalId !== (order.patient.nationalId ?? '')) patch.nationalId = next.nationalId
  if (next.insuranceLabel !== (order.patient.insuranceLabel ?? '')) {
    patch.insuranceLabel = next.insuranceLabel
  }
  if (next.rxTrackingId !== (order.patient.rxTrackingId ?? '')) {
    patch.rxTrackingId = next.rxTrackingId
  }
  return Object.keys(patch).length > 0 ? patch : null
}

function feesDiff(
  order: DispenseOrder,
  form: FeeForm,
): { ok: true; fees: DispensePatch['fees'] } | { ok: false } | { ok: true; fees: undefined } {
  const technicalFee = parseNonNegativeInt(form.technicalFee)
  const insuranceCover = parseNonNegativeInt(form.insuranceCover)
  if (technicalFee === null || insuranceCover === null) return { ok: false }
  const fees: NonNullable<DispensePatch['fees']> = {}
  if (technicalFee !== order.fees.technicalFee) fees.technicalFee = technicalFee
  if (insuranceCover !== order.fees.insuranceCover) fees.insuranceCover = insuranceCover
  if (Object.keys(fees).length === 0) return { ok: true, fees: undefined }
  return { ok: true, fees }
}

function metaMatches(order: DispenseOrder, patient: PatientForm, fees: FeeForm): boolean {
  if (patientDiff(order, patient)) return false
  const feePatch = feesDiff(order, fees)
  return feePatch.ok && feePatch.fees === undefined
}

function controlledMatches(
  order: DispenseOrder,
  forms: Record<string, ControlledForm>,
): boolean {
  for (const line of order.lines) {
    if (!line.isControlled) continue
    const form = forms[line.id]
    if (form && controlledChanged(line, form)) return false
  }
  return true
}

type MetaSnapshots = {
  patient: PatientForm
  fees: FeeForm
}

function buildPreview(
  order: DispenseOrder,
  patient: PatientForm,
  fees: FeeForm,
  controlled: Record<string, ControlledForm>,
): DispenseOrder {
  const technicalFee = parseNonNegativeInt(fees.technicalFee)
  const insuranceCover = parseNonNegativeInt(fees.insuranceCover)
  return {
    ...order,
    patient: {
      nameFa: patient.nameFa.trim(),
      nationalId: patient.nationalId.trim() || undefined,
      insuranceLabel: patient.insuranceLabel.trim() || undefined,
      rxTrackingId: patient.rxTrackingId.trim() || undefined,
    },
    fees: {
      technicalFee: technicalFee ?? order.fees.technicalFee,
      insuranceCover: insuranceCover ?? order.fees.insuranceCover,
    },
    lines: order.lines.map((line) => {
      if (!line.isControlled) return line
      const form = controlled[line.id]
      if (!form) return line
      return { ...line, controlled: toControlled(form) }
    }),
  }
}

function orderChip(order: DispenseOrder | null): string {
  if (!order) return 'حواله جدید'
  if (order.orderNo) return `حواله #${toPersianDigits(order.orderNo)}`
  const short = order.id.slice(-6)
  return `پیش‌نویس #${toPersianDigits(short)}`
}

function confirmHint(order: DispenseOrder): string | null {
  if (order.status !== 'draft') return null
  if (order.patient.nameFa.trim() === '') return 'نام بیمار را وارد کنید.'
  if (order.lines.length === 0) return 'حداقل یک قلم به حواله اضافه کنید.'
  for (const line of order.lines) {
    if (line.quantity <= 0) return 'تعداد هر قلم باید بزرگ‌تر از صفر باشد.'
    if (line.allocation === 'manual' && !line.manualReason?.trim()) {
      return 'برای بچ دستی، دلیل فنی را ثبت کنید.'
    }
    if (line.isControlled) {
      const controlled = line.controlled
      if (
        !controlled ||
        controlled.physicianName.trim() === '' ||
        controlled.recipientNationalId.trim() === '' ||
        controlled.eRxTrackingId.trim() === '' ||
        controlled.technicalAck !== true
      ) {
        return 'فرم داروی تحت کنترل و تایید مسئول فنی را کامل کنید.'
      }
    }
  }
  return null
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

function DispensingDispatchView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get('orderId')?.trim() ?? ''

  const [order, setOrder] = React.useState<DispenseOrder | null>(null)
  const [patient, setPatient] = React.useState<PatientForm>(EMPTY_PATIENT)
  const [fees, setFees] = React.useState<FeeForm>(EMPTY_FEES)
  const [controlled, setControlled] = React.useState<Record<string, ControlledForm>>({})
  const [barcode, setBarcode] = React.useState('')
  const [drugQuery, setDrugQuery] = React.useState('')
  const [drugHits, setDrugHits] = React.useState<Drug[]>([])
  const [sortByLocation, setSortByLocation] = React.useState(false)
  const [manualOpen, setManualOpen] = React.useState<Record<string, boolean>>({})
  const [manualDraft, setManualDraft] = React.useState<Record<string, ManualDraft>>({})
  const [clearOpen, setClearOpen] = React.useState(false)
  const [loadState, setLoadState] = React.useState<'loading' | 'ready' | 'error'>(
    orderId ? 'loading' : 'ready',
  )
  const [loadError, setLoadError] = React.useState('')
  const [retry, setRetry] = React.useState(0)
  const [busy, setBusy] = React.useState(false)

  const orderRef = React.useRef<DispenseOrder | null>(null)
  const patientRef = React.useRef(EMPTY_PATIENT)
  const feeRef = React.useRef(EMPTY_FEES)
  const controlledRef = React.useRef<Record<string, ControlledForm>>({})
  const feesTouchedRef = React.useRef(false)
  const creatingRef = React.useRef<Promise<DispenseOrder> | null>(null)
  const opChain = React.useRef<Promise<void>>(Promise.resolve())
  const drugTimer = React.useRef<number | null>(null)

  const resetWorkspace = React.useCallback(() => {
    orderRef.current = null
    patientRef.current = EMPTY_PATIENT
    feeRef.current = EMPTY_FEES
    controlledRef.current = {}
    feesTouchedRef.current = false
    setOrder(null)
    setPatient(EMPTY_PATIENT)
    setFees(EMPTY_FEES)
    setControlled({})
    setBarcode('')
    setDrugQuery('')
    setDrugHits([])
    setManualOpen({})
    setManualDraft({})
    setLoadState('ready')
    setLoadError('')
  }, [])

  const mergeControlled = React.useCallback((next: DispenseOrder) => {
    const prev = controlledRef.current
    const merged: Record<string, ControlledForm> = {}
    for (const line of next.lines) {
      if (!line.isControlled) continue
      merged[line.id] = prev[line.id] ?? controlledFrom(line)
    }
    controlledRef.current = merged
    setControlled(merged)
  }, [])

  const remember = React.useCallback(
    (next: DispenseOrder, syncMeta: boolean | MetaSnapshots = false) => {
      const prevId = orderRef.current?.id
      orderRef.current = next
      setOrder(next)
      mergeControlled(next)
      if (typeof syncMeta === 'object') {
        const nextPatient = keepDraftFields(patientFrom(next), syncMeta.patient, patientRef.current)
        const nextFees = keepDraftFields(feesFrom(next), syncMeta.fees, feeRef.current)
        patientRef.current = nextPatient
        feeRef.current = nextFees
        setPatient(nextPatient)
        setFees(nextFees)
        return
      }
      if (syncMeta || prevId !== next.id) {
        const nextPatient = patientFrom(next)
        const nextFees = feesFrom(next)
        patientRef.current = nextPatient
        feeRef.current = nextFees
        setPatient(nextPatient)
        setFees(nextFees)
      }
    },
    [mergeControlled],
  )

  React.useEffect(() => {
    if (!orderId) {
      if (orderRef.current) resetWorkspace()
      return
    }
    if (orderRef.current?.id === orderId) return
    let cancelled = false
    setLoadState('loading')
    setLoadError('')
    getDispense(orderId)
      .then((loaded) => {
        if (cancelled) return
        remember(loaded, true)
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
  }, [orderId, retry, remember, resetWorkspace])

  React.useEffect(() => {
    return () => {
      if (drugTimer.current !== null) window.clearTimeout(drugTimer.current)
    }
  }, [])

  function enqueue(run: () => Promise<void>): Promise<void> {
    const task = opChain.current.then(run, run)
    opChain.current = task.then(
      () => undefined,
      () => undefined,
    )
    return task
  }

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

  async function ensureOrder(): Promise<DispenseOrder> {
    if (orderRef.current) return orderRef.current
    if (creatingRef.current) return creatingRef.current
    const form = { ...patientRef.current }
    const feeForm = { ...feeRef.current }
    const technicalFee = parseNonNegativeInt(feeForm.technicalFee)
    const insuranceCover = parseNonNegativeInt(feeForm.insuranceCover)
    const task = createDispense({
      patient: {
        nameFa: form.nameFa.trim(),
        nationalId: form.nationalId.trim() || undefined,
        insuranceLabel: form.insuranceLabel.trim() || undefined,
        rxTrackingId: form.rxTrackingId.trim() || undefined,
      },
      fees:
        feesTouchedRef.current && technicalFee !== null && insuranceCover !== null
          ? { technicalFee, insuranceCover }
          : undefined,
    }).then((created) => {
      remember(created, { patient: form, fees: feeForm })
      router.replace(`/dispensing-dispatch?orderId=${encodeURIComponent(created.id)}`)
      return created
    })
    creatingRef.current = task
    try {
      return await task
    } finally {
      if (creatingRef.current === task) creatingRef.current = null
    }
  }

  async function persistMeta(): Promise<DispenseOrder | null> {
    const current = orderRef.current
    if (!current || current.status !== 'draft') return current
    const patientSnapshot = { ...patientRef.current }
    const feeSnapshot = { ...feeRef.current }
    const patientPatch = patientDiff(current, patientSnapshot)
    const feePatch = feesDiff(current, feeSnapshot)
    if (!feePatch.ok) {
      toast.error('حق فنی و پوشش بیمه باید عدد صحیح ریال باشند.')
      return null
    }
    if (!patientPatch && !feePatch.fees) return current
    const saved = await patchDispense(current.id, {
      ...(patientPatch ? { patient: patientPatch } : {}),
      ...(feePatch.fees ? { fees: feePatch.fees } : {}),
    })
    remember(saved, { patient: patientSnapshot, fees: feeSnapshot })
    return saved
  }

  async function persistControlled(lineId: string): Promise<void> {
    const current = orderRef.current
    if (!current || current.status !== 'draft') return
    const line = current.lines.find((item) => item.id === lineId)
    const form = controlledRef.current[lineId]
    if (!line || !form || !controlledChanged(line, form)) return
    const snapshot = { ...form }
    const saved = await patchDispenseLine(current.id, lineId, {
      controlled: toControlled(snapshot),
    })
    remember(saved)
    const updated = saved.lines.find((item) => item.id === lineId)
    if (!updated?.isControlled) return
    const local = controlledRef.current[lineId] ?? snapshot
    const merged = keepDraftFields(controlledFrom(updated), snapshot, local)
    controlledRef.current = { ...controlledRef.current, [lineId]: merged }
    setControlled({ ...controlledRef.current })
  }

  function run(task: () => Promise<void>) {
    void enqueue(async () => {
      setBusy(true)
      try {
        await task()
      } catch (err) {
        toast.error(errorMessage(err))
      } finally {
        setBusy(false)
      }
    })
  }

  function addLine(input: DispenseLineInput) {
    run(async () => {
      const current = orderRef.current
      if (current && current.status !== 'draft') return
      const draft = await ensureOrder()
      const saved = await addDispenseLine(draft.id, { quantity: 1, ...input })
      remember(saved)
      toast.success('قلم به حواله اضافه شد.')
    })
  }

  function submitBarcode(event: React.FormEvent) {
    event.preventDefault()
    const value = barcode.trim()
    if (!value) {
      toast.error('بارکد یا GTIN را وارد کنید.')
      return
    }
    setBarcode('')
    addLine({ barcode: value })
  }

  function pickDrug(drug: Drug) {
    setDrugQuery('')
    setDrugHits([])
    addLine({ drugId: drug.id })
  }

  function addFromSearch() {
    const only = drugHits.length === 1 ? drugHits[0] : undefined
    if (only) {
      pickDrug(only)
      return
    }
    if (drugHits.length > 1) {
      toast.info('یک دارو را از فهرست انتخاب کنید.')
      return
    }
    toast.error('دارویی با این عبارت یافت نشد.')
  }

  const readOnly = order !== null && order.status !== 'draft'
  const preview = order ? buildPreview(order, patient, fees, controlled) : null
  const totals = preview ? computeDispenseTotals(preview) : null
  const confirmable = preview ? canConfirmDispense(preview) : false
  const hint = preview ? confirmHint(preview) : 'برای شروع، بارکد را اسکن کنید یا دارو را جستجو کنید.'

  const visibleLines = React.useMemo(() => {
    const lines = order?.lines ?? []
    if (!sortByLocation) return lines
    return [...lines].sort((a, b) => a.locationLabel.localeCompare(b.locationLabel, 'fa'))
  }, [order, sortByLocation])

  const drugIds = React.useMemo(() => {
    const ids: string[] = []
    for (const line of order?.lines ?? []) {
      if (line.drugId && !ids.includes(line.drugId)) ids.push(line.drugId)
    }
    return ids
  }, [order])

  function changeQty(lineId: string, delta: number) {
    run(async () => {
      const current = orderRef.current
      if (!current || current.status !== 'draft') return
      const latest = current.lines.find((item) => item.id === lineId)
      if (!latest) return
      const quantity = latest.quantity + delta
      if (quantity <= 0) return
      const saved = await patchDispenseLine(current.id, lineId, { quantity })
      remember(saved)
    })
  }

  function removeLine(lineId: string) {
    run(async () => {
      const current = orderRef.current
      if (!current || current.status !== 'draft') return
      const saved = await deleteDispenseLine(current.id, lineId)
      remember(saved)
      toast.success('قلم از حواله حذف شد.')
    })
  }

  function clearLines() {
    run(async () => {
      const current = orderRef.current
      if (!current || current.status !== 'draft') return
      const saved = await clearDispenseLines(current.id)
      remember(saved)
      setClearOpen(false)
      toast.success('همه اقلام حواله پاک شد.')
    })
  }

  function applyManual(line: DispenseLine) {
    const draft = manualDraft[line.id] ?? { batchId: line.batchId, reason: line.manualReason ?? '' }
    const batchId = draft.batchId.trim()
    const reason = draft.reason.trim()
    if (!batchId || !reason) {
      toast.error('شناسه سری ساخت و دلیل انتخاب دستی الزامی است.')
      return
    }
    run(async () => {
      const current = orderRef.current
      if (!current || current.status !== 'draft') return
      const saved = await patchDispenseLine(current.id, line.id, {
        batchId,
        manualReason: reason,
      })
      remember(saved)
      setManualOpen((prev) => ({ ...prev, [line.id]: false }))
      toast.success('سری ساخت به‌صورت دستی تغییر کرد.')
    })
  }

  function saveControlled(lineId: string) {
    run(async () => {
      await persistControlled(lineId)
    })
  }

  function confirmOrder() {
    run(async () => {
      let next = await persistMeta()
      if (!next || next.status !== 'draft') return
      for (let pass = 0; pass < 2; pass++) {
        for (const line of [...next.lines]) {
          await persistControlled(line.id)
        }
        if (orderRef.current) next = orderRef.current
        if (!metaMatches(next, patientRef.current, feeRef.current)) {
          const saved = await persistMeta()
          if (!saved || saved.status !== 'draft') return
          next = saved
        }
        if (
          metaMatches(next, patientRef.current, feeRef.current) &&
          controlledMatches(next, controlledRef.current)
        ) {
          break
        }
      }
      if (
        !metaMatches(next, patientRef.current, feeRef.current) ||
        !controlledMatches(next, controlledRef.current)
      ) {
        toast.error('آخرین تغییرات هنوز ذخیره نشده‌اند. دوباره تایید کنید.')
        return
      }
      if (!canConfirmDispense(next)) {
        toast.error(confirmHint(next) ?? 'حواله هنوز شرایط تایید را ندارد.')
        return
      }
      const confirmed = await confirmDispense(next.id)
      remember(confirmed, true)
      toast.success('حواله خروج صادر شد و کاردکس انبار به‌روز شد.')
    })
  }

  const shell = (children: React.ReactNode) => (
    <AppShell
      navItems={getDispensingNavItems('dispensing')}
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
            <BreadcrumbPage>حواله خروج و فروش</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      {children}
    </AppShell>
  )

  if (loadState === 'loading') {
    return shell(
      <div
        data-slot="dispensing-dispatch-skeleton"
        className="space-y-6 py-2"
        aria-busy="true"
        aria-label="در حال بارگذاری حواله خروج"
      >
        <div className="space-y-4 rounded-default border border-border-default bg-card p-6">
          <div className="flex items-center justify-between border-b border-border-subtle pb-4">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-8 w-24" />
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
          در حال بارگذاری حواله خروج…
        </p>
      </div>,
    )
  }

  if (loadState === 'error') {
    return shell(
      <AlertBanner
        tone="critical"
        title="بارگذاری حواله ناموفق بود"
        description={loadError}
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              orderRef.current = null
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

  return shell(
    <div data-testid="dispensing-dispatch" className="flex flex-col gap-4">
      <section className="flex flex-col justify-between gap-4 rounded-xl border border-border-default bg-surface p-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-primary">
            <Icon name="output_circle" size={28} data-slot="icon" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-headline-lg font-extrabold leading-tight text-text-primary">
                میز کار نسخه‌پیچی و صدور حواله خروج کالا
              </h1>
              <Badge variant={order?.status === 'confirmed' ? 'valid' : 'neutral'}>
                {orderChip(order)}
              </Badge>
              {order ? (
                <Badge variant={order.status === 'confirmed' ? 'valid' : 'warning'}>
                  {STATUS_LABEL[order.status]}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-body-md text-text-secondary">
              پردازش اقلام تجویزی، تایید هوشمند انبارکاردکس و پایش پروتکل‌های خاص دارویی
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-secondary/15 px-3 py-2">
          <span className="size-2.5 animate-pulse rounded-full bg-primary" aria-hidden />
          <div>
            <p className="flex items-center gap-1 text-label-md font-semibold text-text-primary">
              <Icon name="verified" size={18} data-slot="icon" />
              پروتکل تخصیص خودکار FEFO فعال است
            </p>
            <p className="text-label-sm text-text-secondary">
              نخستین انقضا، نخستین خروج (First Expiry, First Out)
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-primary">
              <Icon name="qr_code_scanner" size={24} data-slot="icon" />
            </div>
            <form className="min-w-0 flex-1" onSubmit={submitBarcode}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <Label htmlFor="dispense-barcode">اسکن بارکد دوبعدی / UID / GTIN</Label>
                <span className="text-label-sm text-primary">اسکنر آماده‌به‌کار</span>
              </div>
              <div className="flex gap-2">
                <Input
                  id="dispense-barcode"
                  data-testid="dispensing-barcode"
                  value={barcode}
                  disabled={readOnly || busy}
                  placeholder="بارکد رهگیری اصالت دارو را وارد کنید"
                  onChange={(event) => setBarcode(event.target.value)}
                />
                <Button type="submit" variant="outline" disabled={readOnly || busy}>
                  <Icon name="barcode" size={16} data-slot="icon" />
                  ورود
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-7">
          <CardContent className="flex items-start gap-3 pt-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-secondary">
              <Icon name="medication" size={24} data-slot="icon" />
            </div>
            <div className="relative min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-2">
                <Label htmlFor="dispense-drug-search">
                  جستجوی سریع دارو بر اساس نام ژنریک یا تجاری
                </Label>
              </div>
              <div className="flex gap-2">
                <Input
                  id="dispense-drug-search"
                  data-testid="dispensing-drug-search"
                  value={drugQuery}
                  disabled={readOnly || busy}
                  placeholder="مثال: متفورمین، آتورواستاتین، آموکسی‌سیلین"
                  onChange={(event) => onDrugQueryChange(event.target.value)}
                />
                <Button
                  type="button"
                  disabled={readOnly || busy}
                  onClick={addFromSearch}
                >
                  <Icon name="add" size={16} data-slot="icon" />
                  افزودن به نسخه
                </Button>
              </div>
              {drugHits.length > 0 ? (
                <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-default border border-border-default bg-surface">
                  {drugHits.map((drug) => (
                    <li key={drug.id}>
                      <button
                        type="button"
                        className="flex w-full flex-col items-start px-3 py-2 text-start hover:bg-surface-hover"
                        onClick={() => pickDrug(drug)}
                      >
                        <span className="text-body-md text-text-primary">{drug.nameFa}</span>
                        <span className="text-label-sm text-text-secondary">
                          {drug.brandName || drug.manufacturer} •{' '}
                          <span dir="ltr">{drug.gtin || drug.id}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertBanner
        tone="info"
        title="قانون مدیریت زنجیره انبارش دارویی (FEFO Enforcement)"
        description="سامانه به صورت هوشمند و خودکار، سری ساختی با نزدیک‌ترین تاریخ انقضا (FEFO) را جهت کسر از موجودی انبار تخصیص می‌دهد تا از هدررفت و منقضی شدن فرآورده‌ها در قفسه‌ها پیشگیری شود. تغییر دستی بچ فقط با ثبت گزارش دلیل فنی مجاز است."
        action={<Badge variant="info">الزام استاندارد GSP</Badge>}
      />

      {order?.status === 'confirmed' ? (
        <AlertBanner
          tone="valid"
          title="حواله خروج صادر شد"
          description="موجودی، کاردکس و گزارش ممیزی به‌روز شد. این حواله فقط خواندنی است."
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href="/shelf-inventory">موجودی قفسه‌ها</Link>
              </Button>
              {drugIds.map((drugId) => (
                <Button key={drugId} variant="outline" asChild>
                  <Link href={`/drug-details-cardex?drugId=${encodeURIComponent(drugId)}`}>
                    کاردکس دارو
                  </Link>
                </Button>
              ))}
            </div>
          }
        />
      ) : null}

      {order?.status === 'cancelled' ? (
        <AlertBanner
          tone="warning"
          title="این حواله لغو شده است"
          description="ویرایش و تایید برای حواله لغوشده بسته است."
        />
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        <section className="flex flex-col gap-3 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-headline-sm text-text-primary">اقلام ثبت شده در این حواله</h2>
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-label-sm text-primary-foreground">
                {formatPersianNumber(order?.lines.length ?? 0)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-pressed={sortByLocation}
                onClick={() => setSortByLocation((value) => !value)}
              >
                <Icon name="sort" size={18} data-slot="icon" />
                مرتب‌سازی بر اساس موقعیت قفسه
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-status-critical-fg"
                disabled={readOnly || busy || (order?.lines.length ?? 0) === 0}
                onClick={() => setClearOpen(true)}
              >
                <Icon name="delete_sweep" size={18} data-slot="icon" />
                پاک‌سازی همه
              </Button>
            </div>
          </div>

          {visibleLines.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-body-md text-text-secondary">
                هنوز قلمی ثبت نشده است. بارکد را اسکن کنید یا دارو را جستجو کنید.
              </CardContent>
            </Card>
          ) : (
            visibleLines.map((line) => (
              <LineCard
                key={line.id}
                line={line}
                readOnly={readOnly}
                busy={busy}
                controlledForm={controlled[line.id] ?? controlledFrom(line)}
                manualOpen={manualOpen[line.id] === true}
                manualDraft={
                  manualDraft[line.id] ?? {
                    batchId: line.batchId,
                    reason: line.manualReason ?? '',
                  }
                }
                onQty={(delta) => changeQty(line.id, delta)}
                onDelete={() => removeLine(line.id)}
                onControlledChange={(patch) => {
                  const current = controlledRef.current[line.id] ?? controlledFrom(line)
                  const next = { ...current, ...patch }
                  controlledRef.current = { ...controlledRef.current, [line.id]: next }
                  setControlled({ ...controlledRef.current })
                }}
                onControlledBlur={() => saveControlled(line.id)}
                onToggleManual={() => {
                  setManualDraft((prev) => ({
                    ...prev,
                    [line.id]: prev[line.id] ?? {
                      batchId: line.batchId,
                      reason: line.manualReason ?? '',
                    },
                  }))
                  setManualOpen((prev) => ({ ...prev, [line.id]: !prev[line.id] }))
                }}
                onManualChange={(patch) =>
                  setManualDraft((prev) => ({
                    ...prev,
                    [line.id]: {
                      batchId: line.batchId,
                      reason: line.manualReason ?? '',
                      ...prev[line.id],
                      ...patch,
                    },
                  }))
                }
                onApplyManual={() => applyManual(line)}
              />
            ))
          )}

          <div className="flex items-center gap-2 rounded-xl bg-surface-subtle px-4 py-3 text-body-sm text-text-secondary">
            <Icon name="sync_alt" size={20} className="text-primary" data-slot="icon" />
            <span>
              با ثبت نهایی این حواله، کاردکس انبار به میزان اقلام فوق به‌روز می‌شود و یک رویداد ممیزی ثبت می‌گردد.
            </span>
          </div>
        </section>

        <aside className="flex flex-col gap-3 lg:sticky lg:top-20 lg:col-span-4">
          <Card>
            <CardContent className="flex flex-col gap-3 pt-5">
              <div className="flex items-center justify-between">
                <h2 className="text-title-md font-semibold text-text-primary">اطلاعات بیمار و نسخه</h2>
                <Icon name="badge" size={20} className="text-primary" data-slot="icon" />
              </div>
              <Field label="نام بیمار" htmlFor="dispense-patient-name">
                <Input
                  id="dispense-patient-name"
                  data-testid="dispensing-patient-name"
                  value={patient.nameFa}
                  disabled={readOnly}
                  onChange={(event) => {
                    const nameFa = event.target.value
                    patientRef.current = { ...patientRef.current, nameFa }
                    setPatient(patientRef.current)
                  }}
                  onBlur={() => {
                    if (!orderRef.current) return
                    run(() => persistMeta().then(() => undefined))
                  }}
                />
              </Field>
              <Field label="شناسه ملی بیمار" htmlFor="dispense-national-id">
                <Input
                  id="dispense-national-id"
                  dir="ltr"
                  value={patient.nationalId}
                  disabled={readOnly}
                  onChange={(event) => {
                    const nationalId = event.target.value
                    patientRef.current = { ...patientRef.current, nationalId }
                    setPatient(patientRef.current)
                  }}
                  onBlur={() => {
                    if (!orderRef.current) return
                    run(() => persistMeta().then(() => undefined))
                  }}
                />
              </Field>
              <Field label="سازمان بیمه‌گر" htmlFor="dispense-insurance">
                <Input
                  id="dispense-insurance"
                  value={patient.insuranceLabel}
                  disabled={readOnly}
                  onChange={(event) => {
                    const insuranceLabel = event.target.value
                    patientRef.current = { ...patientRef.current, insuranceLabel }
                    setPatient(patientRef.current)
                  }}
                  onBlur={() => {
                    if (!orderRef.current) return
                    run(() => persistMeta().then(() => undefined))
                  }}
                />
              </Field>
              <Field label="شناسه رهگیری نسخه" htmlFor="dispense-rx">
                <Input
                  id="dispense-rx"
                  dir="ltr"
                  value={patient.rxTrackingId}
                  disabled={readOnly}
                  onChange={(event) => {
                    const rxTrackingId = event.target.value
                    patientRef.current = { ...patientRef.current, rxTrackingId }
                    setPatient(patientRef.current)
                  }}
                  onBlur={() => {
                    if (!orderRef.current) return
                    run(() => persistMeta().then(() => undefined))
                  }}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3 pt-5">
              <div className="flex items-center justify-between">
                <h2 className="text-title-md font-semibold text-text-primary">خلاصه حواله خروج</h2>
                <span className="text-label-sm text-text-secondary">
                  {formatPersianNumber(totals?.lineCount ?? 0)} قلم کالا
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-surface-subtle p-2">
                  <span className="block text-label-sm text-text-secondary">کل اقلام</span>
                  <span className="tabular-nums-data text-headline-sm font-bold">
                    {formatPersianNumber(totals?.lineCount ?? 0)}
                  </span>
                </div>
                <div className="rounded-lg bg-surface-subtle p-2">
                  <span className="block text-label-sm text-text-secondary">زنجیره سرد</span>
                  <span className="tabular-nums-data text-headline-sm font-bold text-primary">
                    {formatPersianNumber(totals?.coldCount ?? 0)}
                  </span>
                </div>
                <div className="rounded-lg bg-status-critical-bg p-2">
                  <span className="block text-label-sm text-status-critical-fg">تحت کنترل</span>
                  <span className="tabular-nums-data text-headline-sm font-bold text-status-critical-fg">
                    {formatPersianNumber(totals?.controlledCount ?? 0)}
                  </span>
                </div>
              </div>
              <div className="space-y-2 text-body-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-text-secondary">جمع بهای مصوب داروها</span>
                  <span className="tabular-nums-data">{formatRial(totals?.goodsTotal ?? 0)}</span>
                </div>
                <Field label="تعهد سازمان بیمه‌گر (ریال)" htmlFor="dispense-cover">
                  <Input
                    id="dispense-cover"
                    inputMode="numeric"
                    dir="ltr"
                    value={fees.insuranceCover}
                    disabled={readOnly}
                    onChange={(event) => {
                      const insuranceCover = event.target.value
                      feeRef.current = { ...feeRef.current, insuranceCover }
                      feesTouchedRef.current = true
                      setFees(feeRef.current)
                    }}
                    onBlur={() => {
                      if (!orderRef.current) return
                      run(() => persistMeta().then(() => undefined))
                    }}
                  />
                </Field>
                <Field label="حق فنی و نسخه‌پیچی (ریال)" htmlFor="dispense-fee">
                  <Input
                    id="dispense-fee"
                    inputMode="numeric"
                    dir="ltr"
                    value={fees.technicalFee}
                    disabled={readOnly}
                    onChange={(event) => {
                      const technicalFee = event.target.value
                      feeRef.current = { ...feeRef.current, technicalFee }
                      feesTouchedRef.current = true
                      setFees(feeRef.current)
                    }}
                    onBlur={() => {
                      if (!orderRef.current) return
                      run(() => persistMeta().then(() => undefined))
                    }}
                  />
                </Field>
                <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-subtle p-3">
                  <span className="text-label-md font-semibold text-text-primary">
                    سهم پرداختی بیمار
                  </span>
                  <span className="tabular-nums-data text-headline-sm font-bold text-primary">
                    {formatRial(totals?.patientPayable ?? 0)}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                data-testid="dispensing-confirm"
                className="h-auto whitespace-normal py-3"
                disabled={readOnly || busy || !confirmable}
                onClick={confirmOrder}
              >
                <Icon name="assignment_turned_in" size={22} data-slot="icon" />
                تایید و صدور حواله خروج قطعی از انبار و کسر کاردکس
              </Button>
              {readOnly ? (
                <p className="text-label-sm text-text-secondary">این حواله فقط خواندنی است.</p>
              ) : hint ? (
                <p className="text-label-sm text-text-secondary">{hint}</p>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  data-testid="dispensing-print-patient"
                  onClick={() => toast.info(PRINT_TOAST)}
                >
                  <Icon name="print" size={18} data-slot="icon" />
                  چاپ فیش بیمار
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  data-testid="dispensing-print-slip"
                  onClick={() => toast.info(PRINT_TOAST)}
                >
                  <Icon name="receipt_long" size={18} data-slot="icon" />
                  حواله انبارداری
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        tone="critical"
        title="پاک‌سازی همه اقلام"
        description="همه قلم‌های این پیش‌نویس حذف می‌شوند. اطلاعات بیمار باقی می‌ماند."
        confirmLabel="پاک‌سازی"
        loading={busy}
        onConfirm={clearLines}
      />
    </div>,
  )
}

function LineCard({
  line,
  readOnly,
  busy,
  controlledForm,
  manualOpen,
  manualDraft,
  onQty,
  onDelete,
  onControlledChange,
  onControlledBlur,
  onToggleManual,
  onManualChange,
  onApplyManual,
}: {
  line: DispenseLine
  readOnly: boolean
  busy: boolean
  controlledForm: ControlledForm
  manualOpen: boolean
  manualDraft: ManualDraft
  onQty: (delta: number) => void
  onDelete: () => void
  onControlledChange: (patch: Partial<ControlledForm>) => void
  onControlledBlur: () => void
  onToggleManual: () => void
  onManualChange: (patch: Partial<ManualDraft>) => void
  onApplyManual: () => void
}) {
  const tone = line.isControlled ? 'controlled' : line.isColdChain ? 'cold' : 'normal'
  const lineTotal = line.quantity * line.consumerPrice
  return (
    <Card
      className={cn(
        'gap-3 p-4',
        tone === 'controlled' && 'border-status-critical-border',
        tone === 'cold' && 'border-primary/40',
      )}
    >
      {line.isControlled ? (
        <div className="-mx-4 -mt-4 flex flex-wrap items-center justify-between gap-2 rounded-t-default bg-status-critical-bg px-4 py-2 text-status-critical-fg">
          <div className="flex items-center gap-2">
            <Icon name="gavel" size={22} data-slot="icon" />
            <span className="text-title-sm font-semibold">داروی تحت کنترل قانونی</span>
            <Badge variant="critical">پروتکل ویژه نظارت دارویی</Badge>
          </div>
          <span className="text-label-sm">الزام تایید مسئول فنی</span>
        </div>
      ) : null}

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-xl',
              tone === 'controlled' && 'bg-status-critical-bg text-status-critical-fg',
              tone === 'cold' && 'bg-primary-tint text-primary',
              tone === 'normal' && 'bg-surface-subtle text-text-secondary',
            )}
          >
            <Icon
              name={tone === 'controlled' ? 'vaccines' : tone === 'cold' ? 'ac_unit' : 'pill'}
              size={24}
              data-slot="icon"
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-title-md font-semibold text-text-primary">{line.nameFa}</span>
              {line.nameEn ? (
                <span className="text-label-sm text-text-secondary" dir="ltr">
                  {line.nameEn}
                </span>
              ) : null}
              {line.irc ? (
                <Badge variant="secondary">
                  <span dir="ltr">IRC: {line.irc}</span>
                </Badge>
              ) : null}
              {line.isColdChain ? (
                <Badge variant="info">
                  <Icon name="ac_unit" size={14} data-slot="icon" />
                  زنجیره سرد
                </Badge>
              ) : null}
            </div>
            <p className="text-body-sm text-text-secondary">
              {[line.manufacturer, line.unitLabel].filter(Boolean).join(' • ') || line.unitLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={line.allocation === 'manual' ? 'warning' : 'valid'}>
            <Icon name="verified" size={14} data-slot="icon" />
            {line.allocation === 'manual' ? 'انتخاب دستی بچ' : 'تخصیص هوشمند بر مبنای FEFO'}
          </Badge>
          {readOnly ? null : (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="حذف قلم"
              disabled={busy}
              onClick={onDelete}
            >
              <Icon name="delete" size={16} data-slot="icon" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-lg bg-surface-subtle p-3 text-body-sm md:grid-cols-4">
        <div>
          <span className="block text-label-sm text-text-secondary">بچ تخصیص‌یافته</span>
          <span className="tabular-nums-data font-semibold" dir="ltr">
            {line.batchNo || '—'}
          </span>
          <span className="mt-0.5 block text-label-sm text-text-secondary" dir="ltr">
            {line.batchId}
          </span>
        </div>
        <div>
          <span className="block text-label-sm text-text-secondary">تاریخ انقضا</span>
          <span
            className={cn(
              'font-semibold',
              line.isColdChain ? 'text-status-critical-fg' : 'text-text-primary',
            )}
          >
            {expiryLabel(line.expiry)}
          </span>
        </div>
        <div>
          <span className="block text-label-sm text-text-secondary">موقعیت انبارش</span>
          <span className="flex items-center gap-1 font-medium text-text-primary">
            <Icon name={line.isColdChain ? 'ac_unit' : 'warehouse'} size={16} data-slot="icon" />
            {line.locationLabel || '—'}
          </span>
        </div>
        <div>
          <span className="block text-label-sm text-text-secondary">تعداد درخواستی</span>
          <div className="mt-1 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="کاهش تعداد"
              disabled={readOnly || line.quantity <= 1}
              onClick={() => onQty(-1)}
            >
              −
            </Button>
            <span className="tabular-nums-data text-headline-sm font-bold text-primary">
              {formatPersianNumber(line.quantity)}
            </span>
            <span className="text-label-sm text-text-secondary">{line.unitLabel}</span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="افزایش تعداد"
              disabled={readOnly}
              onClick={() => onQty(1)}
            >
              +
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-body-sm text-text-secondary">
        <div className="flex flex-wrap gap-3">
          <span>
            قیمت مصرف‌کننده:{' '}
            <strong className="tabular-nums-data text-text-primary">
              {formatRial(line.consumerPrice)}
            </strong>
          </span>
          <span>
            مبلغ قلم:{' '}
            <strong className="tabular-nums-data text-text-primary">{formatRial(lineTotal)}</strong>
          </span>
        </div>
        {readOnly ? null : (
          <Button type="button" variant="link" size="sm" onClick={onToggleManual}>
            <Icon name="tune" size={14} data-slot="icon" />
            تغییر دستی بچ
          </Button>
        )}
      </div>

      {manualOpen && !readOnly ? (
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-border-default p-3 md:grid-cols-2">
          <Field label="شناسه سری ساخت" htmlFor={`batch-${line.id}`}>
            <Input
              id={`batch-${line.id}`}
              dir="ltr"
              value={manualDraft.batchId}
              disabled={busy}
              onChange={(event) => onManualChange({ batchId: event.target.value })}
            />
          </Field>
          <Field label="دلیل فنی انتخاب دستی" htmlFor={`reason-${line.id}`}>
            <Textarea
              id={`reason-${line.id}`}
              value={manualDraft.reason}
              disabled={busy}
              onChange={(event) => onManualChange({ reason: event.target.value })}
            />
          </Field>
          <div className="md:col-span-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={onApplyManual}>
              ثبت تغییر بچ
            </Button>
          </div>
        </div>
      ) : null}

      {line.isControlled ? (
        <div className="flex flex-col gap-3 rounded-xl bg-surface-subtle p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1 text-title-sm font-semibold text-text-primary">
              <Icon name="assignment_late" size={20} className="text-status-critical-fg" data-slot="icon" />
              فرم ثبت الزامات قانونی و بالینی تحویل داروی تحت کنترل
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="نام پزشک معالج" htmlFor={`physician-${line.id}`}>
              <Input
                id={`physician-${line.id}`}
                value={controlledForm.physicianName}
                disabled={readOnly || busy}
                onChange={(event) => onControlledChange({ physicianName: event.target.value })}
                onBlur={onControlledBlur}
              />
            </Field>
            <Field label="شماره نظام پزشکی" htmlFor={`license-${line.id}`}>
              <Input
                id={`license-${line.id}`}
                dir="ltr"
                value={controlledForm.physicianLicense}
                disabled={readOnly || busy}
                onChange={(event) => onControlledChange({ physicianLicense: event.target.value })}
                onBlur={onControlledBlur}
              />
            </Field>
            <Field label="کد ملی دریافت‌کننده" htmlFor={`recipient-${line.id}`}>
              <Input
                id={`recipient-${line.id}`}
                dir="ltr"
                value={controlledForm.recipientNationalId}
                disabled={readOnly || busy}
                onChange={(event) =>
                  onControlledChange({ recipientNationalId: event.target.value })
                }
                onBlur={onControlledBlur}
              />
            </Field>
            <Field label="شماره پیگیری نسخه الکترونیک" htmlFor={`erx-${line.id}`}>
              <Input
                id={`erx-${line.id}`}
                dir="ltr"
                value={controlledForm.eRxTrackingId}
                disabled={readOnly || busy}
                onChange={(event) => onControlledChange({ eRxTrackingId: event.target.value })}
                onBlur={onControlledBlur}
              />
            </Field>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2">
            <Checkbox
              id={`ack-${line.id}`}
              checked={controlledForm.technicalAck}
              disabled={readOnly || busy}
              onCheckedChange={(checked) => {
                onControlledChange({ technicalAck: checked === true })
                onControlledBlur()
              }}
            />
            <Label htmlFor={`ack-${line.id}`} className="text-body-sm">
              مسئول فنی اصالت نسخه و ضرورت بالینی را احراز نموده و تحویل را تایید می‌کند.
            </Label>
          </div>
        </div>
      ) : null}
    </Card>
  )
}

export { DispensingDispatchView }
