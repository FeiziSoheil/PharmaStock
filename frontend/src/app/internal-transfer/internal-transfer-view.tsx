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
  Checkbox,
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
  ConfirmDialog,
  DenseDataTable,
  KpiMetricCard,
  PageHeader,
  TriageStatusBadge,
  type DenseColumn,
  type TriageStatus,
} from '@/components/shared'
import { Stepper, type StepperStep, type StepStatus } from '@/components/domain'
import { ApiError } from '@/lib/api/http'
import { getAuditRoleLabel } from '@/lib/domain/auditEvents'
import { fetchDrugs } from '@/lib/drugs/data-access'
import { fetchExpiryBatches } from '@/lib/expiry/data-access'
import {
  daysUntilExpiry,
  getExpiryBucket,
  remainingDaysLabel,
} from '@/lib/expiry/expiry-query'
import { fetchShelves } from '@/lib/shelves/data-access'
import {
  formatJalaliDate,
  formatPersianNumber,
  normalizePersianText,
  toPersianDigits,
} from '@/lib/persian'
import type { Drug } from '@/lib/types/drugs'
import type { ExpiryBatch } from '@/lib/types/expiry'
import type { ShelfBin } from '@/lib/types/shelves'
import {
  addTransferLine,
  clearTransferLines,
  confirmTransfer,
  createTransfer,
  deleteTransferLine,
  getTransfer,
  listTransfers,
  patchTransfer,
  patchTransferLine,
} from '@/lib/transfers/data-access'
import {
  canAdvanceToStep2,
  canConfirmTransfer,
  remainingBatchQuantity,
  stagedQuantityForBatch,
  sumTransferUnits,
} from '@/lib/transfers/gating'
import type {
  InternalTransfer,
  MatchStatus,
  TransferHeader,
  TransferLine,
  TransferReason,
  TransferStatus,
} from '@/lib/types/transfers'
import { TRANSFER_REASON_LABELS } from '@/lib/types/transfers'
import { getInternalTransferNavItems } from './nav'

type WizardStep = 1 | 2

const PAGE_TITLE =
  'فرم حواله انتقال داخلی کالا (انبار اصلی به پیشخوان تحویل نسخه)'

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'انتخاب اقلام و تخصیص بَچ',
  2: 'بازبینی، اعتبارسنجی و تایید',
}

const STEP_META: Record<StepStatus, string> = {
  completed: 'پایان‌یافته',
  current: 'در حال پردازش',
  upcoming: 'مرحله آتی',
}

const DEFAULT_HEADER: TransferHeader = {
  reason: 'routine_front',
  sourceZone: 'main',
  destZone: 'dispensing',
  sourceLabel: 'انبار مرکزی - سالن نگهداری دارویی',
  destLabel: 'پیشخوان نسخه‌پیچی و تحویل فوری',
}

const CHECKLIST_ITEMS = [
  'بررسی سلامت فیزیکی بلیسترها و جعبه‌ها',
  'انطباق کد IRC با سامانه TTAC سازمان غذا و دارو',
  'رعایت پروتکل دمایی در مسیر جابجایی',
] as const

const STATUS_LABEL: Record<TransferStatus, string> = {
  draft: 'پیش‌نویس',
  confirmed: 'تاییدشده',
  cancelled: 'لغوشده',
}

const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  barcode: 'تطبیق کامل بارکد',
  physical: 'تطبیق فیزیکی',
}

const REASON_OPTIONS = (
  Object.entries(TRANSFER_REASON_LABELS) as [TransferReason, string][]
).map(([value, label]) => ({ value, label }))

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

function parsePositiveInt(raw: string): number | null {
  const normalized = normalizePersianText(raw).replace(/[,،\s]/g, '')
  if (!/^\d+$/.test(normalized)) return null
  const value = Number(normalized)
  if (!Number.isSafeInteger(value) || value <= 0) return null
  return value
}

function fefoSort(batches: ExpiryBatch[]): ExpiryBatch[] {
  return [...batches].sort((a, b) => a.expiry.localeCompare(b.expiry))
}

function expiryTriage(expiryISO: string): { status: TriageStatus; label: string } {
  const today = new Date()
  const days = daysUntilExpiry(expiryISO, today)
  const bucket = getExpiryBucket(expiryISO, today)
  const text = days === null ? 'نامشخص' : toPersianDigits(remainingDaysLabel(days))
  if (bucket === 'expired' || bucket === 'critical') {
    return { status: 'critical', label: text }
  }
  if (bucket === 'warning') {
    return { status: 'warning', label: text }
  }
  if (bucket === 'watch') {
    return { status: 'expiring', label: text }
  }
  return { status: 'valid', label: text }
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

export function InternalTransferView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const transferId = searchParams.get('transferId')?.trim() ?? ''

  const [transfer, setTransfer] = React.useState<InternalTransfer | null>(null)
  const [openDrafts, setOpenDrafts] = React.useState<InternalTransfer[]>([])
  const [step, setStep] = React.useState<WizardStep>(1)
  const [reason, setReason] = React.useState<TransferReason>(DEFAULT_HEADER.reason)
  const [receiverName, setReceiverName] = React.useState('')
  const [note, setNote] = React.useState('')

  const [drugQuery, setDrugQuery] = React.useState('')
  const [drugHits, setDrugHits] = React.useState<Drug[]>([])
  const [drugSearchState, setDrugSearchState] = React.useState<
    'idle' | 'searching' | 'empty' | 'ready'
  >('idle')
  const [selectedDrug, setSelectedDrug] = React.useState<Drug | null>(null)
  const [sourceBatches, setSourceBatches] = React.useState<ExpiryBatch[]>([])
  const [selectedBatchId, setSelectedBatchId] = React.useState('')
  const [qtyRaw, setQtyRaw] = React.useState('')
  const [matchMode, setMatchMode] = React.useState<MatchStatus>('barcode')

  const [destBinId, setDestBinId] = React.useState('')
  const [allBins, setAllBins] = React.useState<ShelfBin[]>([])
  const [showAllBins, setShowAllBins] = React.useState(false)

  const [checklist, setChecklist] = React.useState<boolean[]>(
    CHECKLIST_ITEMS.map(() => false),
  )
  const [clearConfirmOpen, setClearConfirmOpen] = React.useState(false)
  const [loadState, setLoadState] = React.useState<'loading' | 'ready' | 'error'>(
    transferId ? 'loading' : 'ready',
  )
  const [loadError, setLoadError] = React.useState('')
  const [retry, setRetry] = React.useState(0)
  const [busy, setBusy] = React.useState(false)
  const [loadedTransferId, setLoadedTransferId] = React.useState('')
  const [trackedTransferId, setTrackedTransferId] = React.useState(transferId)

  const drugTimer = React.useRef<number | null>(null)
  const searchBoxRef = React.useRef<HTMLDivElement | null>(null)

  const readOnly = transfer?.status === 'confirmed' || transfer?.status === 'cancelled'

  if (transferId !== trackedTransferId) {
    setTrackedTransferId(transferId)
    if (!transferId) {
      setLoadedTransferId('')
      setTransfer(null)
      setStep(1)
      setReason(DEFAULT_HEADER.reason)
      setReceiverName('')
      setNote('')
      setChecklist(CHECKLIST_ITEMS.map(() => false))
      setLoadState('ready')
    } else if (transferId !== loadedTransferId) {
      setLoadState('loading')
      setLoadError('')
    }
  }

  const refreshDraftList = React.useCallback(() => {
    void listTransfers({ status: 'draft', pageSize: 10 })
      .then((res) => setOpenDrafts(res.items))
      .catch(() => setOpenDrafts([]))
  }, [])

  React.useEffect(() => {
    refreshDraftList()
  }, [refreshDraftList])

  React.useEffect(() => {
    if (!transferId || transferId === loadedTransferId) return
    let cancelled = false
    getTransfer(transferId)
      .then((doc) => {
        if (cancelled) return
        setTransfer(doc)
        setLoadedTransferId(doc.id)
        setStep(doc.currentStep === 2 ? 2 : 1)
        setReason(doc.header.reason)
        setReceiverName(doc.header.receiverName ?? '')
        setNote(doc.header.note ?? '')
        if (doc.status === 'confirmed') {
          setChecklist(CHECKLIST_ITEMS.map(() => true))
        }
        setLoadState('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(errorMessage(err))
        setLoadState('error')
      })
    return () => {
      cancelled = true
    }
  }, [transferId, loadedTransferId, retry])

  React.useEffect(() => {
    void fetchShelves({ pageSize: 100 })
      .then((res) => setAllBins(res.items))
      .catch(() => setAllBins([]))
  }, [])

  React.useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        searchBoxRef.current &&
        !searchBoxRef.current.contains(event.target as Node)
      ) {
        setDrugHits([])
        setDrugSearchState('idle')
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const dispensingBins = React.useMemo(
    () => allBins.filter((b) => b.macroLocation === 'dispensing'),
    [allBins],
  )

  const visibleDestBins = React.useMemo(() => {
    if (showAllBins || dispensingBins.length === 0) return allBins
    return dispensingBins
  }, [allBins, dispensingBins, showAllBins])

  const lines = transfer?.lines ?? []

  function onDrugQuery(value: string) {
    setDrugQuery(value)
    if (drugTimer.current !== null) window.clearTimeout(drugTimer.current)
    const query = value.trim()
    if (query.length < 2) {
      setDrugHits([])
      setDrugSearchState('idle')
      return
    }
    setDrugSearchState('searching')
    drugTimer.current = window.setTimeout(() => {
      fetchDrugs({ search: query, page: 1, pageSize: 8 })
        .then((result) => {
          setDrugHits(result.items)
          setDrugSearchState(result.items.length === 0 ? 'empty' : 'ready')
        })
        .catch(() => {
          setDrugHits([])
          setDrugSearchState('empty')
        })
    }, 250)
  }

  function pickDrug(drug: Drug) {
    setSelectedDrug(drug)
    setDrugQuery(drug.nameFa)
    setDrugHits([])
    setDrugSearchState('idle')
    setSelectedBatchId('')
    setQtyRaw('')
    void loadBatchesForDrug(drug)
  }

  async function loadBatchesForDrug(drug: Drug) {
    setBusy(true)
    try {
      const res = await fetchExpiryBatches({
        search: drug.nameFa,
        status: 'active',
        sortBy: 'expiry',
        sortDir: 'asc',
        pageSize: 80,
      })
      const filtered = fefoSort(
        res.items.filter(
          (b) => b.drugId === drug.id && b.quantity > 0 && b.status === 'active',
        ),
      )
      setSourceBatches(filtered)
      const firstAvailable =
        filtered.find(
          (b) => remainingBatchQuantity(b.quantity, lines, b.batchId) > 0,
        ) ?? filtered[0]
      if (firstAvailable) setSelectedBatchId(firstAvailable.batchId)
    } catch (err) {
      toast.error(errorMessage(err))
      setSourceBatches([])
    } finally {
      setBusy(false)
    }
  }

  async function ensureDraft(): Promise<InternalTransfer | null> {
    if (transfer) return transfer
    setBusy(true)
    try {
      const header: TransferHeader = {
        ...DEFAULT_HEADER,
        reason,
        receiverName: receiverName.trim() || undefined,
        note: note.trim() || undefined,
      }
      const saved = await createTransfer(header)
      setTransfer(saved)
      setLoadedTransferId(saved.id)
      setTrackedTransferId(saved.id)
      setLoadState('ready')
      refreshDraftList()
      router.replace(`/internal-transfer?transferId=${encodeURIComponent(saved.id)}`)
      return saved
    } catch (err) {
      toast.error(errorMessage(err))
      return null
    } finally {
      setBusy(false)
    }
  }

  function hasDirtyHeader(doc: InternalTransfer): boolean {
    return (
      doc.header.reason !== reason ||
      (doc.header.receiverName ?? '') !== receiverName.trim() ||
      (doc.header.note ?? '') !== note.trim()
    )
  }

  async function saveHeader() {
    const current = transfer ?? (await ensureDraft())
    if (!current || readOnly) return
    setBusy(true)
    try {
      const saved = await patchTransfer(current.id, {
        reason,
        sourceZone: DEFAULT_HEADER.sourceZone,
        destZone: DEFAULT_HEADER.destZone,
        sourceLabel: DEFAULT_HEADER.sourceLabel,
        destLabel: DEFAULT_HEADER.destLabel,
        receiverName: receiverName.trim(),
        note: note.trim(),
      })
      setTransfer(saved)
      setReason(saved.header.reason)
      setReceiverName(saved.header.receiverName ?? '')
      setNote(saved.header.note ?? '')
      refreshDraftList()
      toast.success('سربرگ حواله ذخیره شد.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function onReasonChange(nextReason: TransferReason) {
    setReason(nextReason)
    if (transfer && !readOnly) {
      try {
        const saved = await patchTransfer(transfer.id, { reason: nextReason })
        setTransfer(saved)
      } catch (err) {
        toast.error(errorMessage(err))
      }
    }
  }

  async function submitLine() {
    let current = transfer
    if (!current) {
      current = await ensureDraft()
      if (!current) return
    }
    if (readOnly) return
    if (!selectedBatchId) {
      toast.error('یک بچ مبدا انتخاب کنید.')
      return
    }
    const quantity = parsePositiveInt(qtyRaw)
    if (quantity === null) {
      toast.error('تعداد انتقال باید عدد صحیح بزرگ‌تر از صفر باشد.')
      return
    }
    const batch = sourceBatches.find((b) => b.batchId === selectedBatchId)
    if (!batch) {
      toast.error('بچ انتخاب‌شده یافت نشد.')
      return
    }
    const available = remainingBatchQuantity(
      batch.quantity,
      current.lines,
      batch.batchId,
    )
    if (quantity > available) {
      toast.error(
        `تعداد درخواستی بیشتر از موجودی آزاد باقیمانده (${formatPersianNumber(available)}) است.`,
      )
      return
    }
    const bin = allBins.find((b) => b.id === destBinId)
    if (!destBinId || !bin) {
      toast.error('قفسه مقصد را انتخاب کنید.')
      return
    }
    const destLocationLabel = `${bin.zoneLabel} › ${bin.address}`
    if (
      batch.locationLabel &&
      (batch.locationLabel === bin.address ||
        batch.locationLabel === destLocationLabel)
    ) {
      toast.error('قفسه مقصد نمی‌تواند با قفسه مبدا یکسان باشد.')
      return
    }
    setBusy(true)
    try {
      const saved = await addTransferLine(current.id, {
        sourceBatchId: selectedBatchId,
        quantity,
        destBinId: bin.id,
        destLocationLabel,
        matchStatus: matchMode,
      })
      setTransfer(saved)
      setQtyRaw('')
      refreshDraftList()
      toast.success('قلم به حواله اضافه شد.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function updateLineQuantity(line: TransferLine, nextQty: number) {
    if (!transfer || readOnly) return
    if (!Number.isSafeInteger(nextQty) || nextQty <= 0) {
      toast.error('تعداد انتقال باید حداقل ۱ باشد.')
      return
    }
    setBusy(true)
    try {
      const saved = await patchTransferLine(transfer.id, line.id, {
        quantity: nextQty,
      })
      setTransfer(saved)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function toggleLineMatchStatus(line: TransferLine) {
    if (!transfer || readOnly) return
    const nextMatch: MatchStatus =
      line.matchStatus === 'barcode' ? 'physical' : 'barcode'
    setBusy(true)
    try {
      const saved = await patchTransferLine(transfer.id, line.id, {
        matchStatus: nextMatch,
      })
      setTransfer(saved)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function removeLine(lineId: string) {
    if (!transfer || readOnly) return
    setBusy(true)
    try {
      const saved = await deleteTransferLine(transfer.id, lineId)
      setTransfer(saved)
      refreshDraftList()
      toast.success('قلم حذف شد.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleClearLines() {
    if (!transfer || readOnly) return
    setBusy(true)
    try {
      const saved = await clearTransferLines(transfer.id)
      setTransfer(saved)
      setClearConfirmOpen(false)
      refreshDraftList()
      toast.success('همه اقلام پیش‌نویس پاکسازی شد.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function goToStep(next: WizardStep) {
    if (next === step) return
    if (next === 2 && !canAdvanceToStep2(lines) && !readOnly) {
      toast.error('حداقل یک قلم کامل با بچ و تعداد معتبر لازم است.')
      return
    }
    if (!transfer || readOnly) {
      setStep(next)
      return
    }
    setBusy(true)
    try {
      const saved = await patchTransfer(transfer.id, { currentStep: next })
      setTransfer(saved)
      setStep(next)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function saveDraft() {
    if (!transfer || readOnly) return
    setBusy(true)
    try {
      const saved = await patchTransfer(transfer.id, {
        reason,
        receiverName: receiverName.trim(),
        note: note.trim(),
        currentStep: step,
      })
      setTransfer(saved)
      refreshDraftList()
      toast.success('پیش‌نویس ذخیره شد.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function finalizeTransfer() {
    if (!transfer || readOnly) return
    if (!canConfirmTransfer(transfer)) {
      toast.error(
        'همه اقلام باید مقصد داشته باشند و حواله در وضعیت پیش‌نویس باشد.',
      )
      return
    }
    if (!checklist.every(Boolean)) {
      toast.error('چک‌لیست تطابق را کامل کنید.')
      return
    }
    setBusy(true)
    try {
      if (hasDirtyHeader(transfer)) {
        const synced = await patchTransfer(transfer.id, {
          reason,
          receiverName: receiverName.trim(),
          note: note.trim(),
        })
        setTransfer(synced)
      }
      const saved = await confirmTransfer(transfer.id)
      setTransfer(saved)
      setStep(2)
      refreshDraftList()
      toast.success('حواله تایید شد و موجودی به‌روز شد.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function startNewTransfer() {
    setSelectedDrug(null)
    setDrugQuery('')
    setSourceBatches([])
    setSelectedBatchId('')
    setQtyRaw('')
    setDestBinId('')
    router.push('/internal-transfer')
  }

  const maxReached: WizardStep = transfer?.currentStep ?? 1

  function stepStatus(index: WizardStep): StepStatus {
    if (index === step) return 'current'
    if (readOnly || index <= maxReached || index < step) return 'completed'
    return 'upcoming'
  }

  const steps: StepperStep[] = ([1, 2] as const).map((index) => {
    const status = stepStatus(index)
    const lineCount = lines.length
    let description = ''
    if (index === 1) {
      description = transfer
        ? `${toPersianDigits(lineCount)} قلم ثبت شده`
        : 'جستجوی دارو و انتخاب بچ FEFO'
    } else {
      description = readOnly ? 'انتقال قطعی شد' : 'بازبینی و تایید نهایی'
    }
    return {
      id: String(index),
      label: STEP_LABELS[index],
      description,
      meta: `گام ${toPersianDigits(index)} • ${STEP_META[status]}`,
      status,
    }
  })

  const lineColumns: DenseColumn<TransferLine>[] = [
    {
      id: 'drug',
      header: 'دارو',
      cell: (row) => <span className="font-semibold">{row.nameFa}</span>,
    },
    {
      id: 'batch',
      header: 'سری ساخت',
      cell: (row) => row.batchNo,
      dir: 'ltr',
    },
    {
      id: 'expiry',
      header: 'انقضا',
      cell: (row) => formatJalaliDate(row.expiry),
    },
    {
      id: 'source',
      header: 'آدرس مبدا',
      cell: (row) => (
        <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
          <Icon name="location_on" size={14} className="text-primary" data-slot="icon" />
          {row.sourceLocationLabel || '—'}
        </span>
      ),
    },
    {
      id: 'dest',
      header: 'آدرس مقصد',
      cell: (row) => (
        <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
          <Icon name="near_me" size={14} className="text-secondary" data-slot="icon" />
          {row.destLocationLabel ?? row.destBinId ?? '—'}
        </span>
      ),
    },
    {
      id: 'qty',
      header: 'تعداد',
      cell: (row) =>
        readOnly ? (
          `${formatPersianNumber(row.quantity)} ${row.unitLabel}`
        ) : (
          <div className="inline-flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={busy || row.quantity <= 1}
              aria-label={`کاهش تعداد ${row.nameFa}`}
              onClick={() => void updateLineQuantity(row, row.quantity - 1)}
            >
              <Icon name="remove" size={14} data-slot="icon" />
            </Button>
            <span className="min-w-12 text-center font-semibold tabular-nums-data">
              {formatPersianNumber(row.quantity)} {row.unitLabel}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={busy}
              aria-label={`افزایش تعداد ${row.nameFa}`}
              onClick={() => void updateLineQuantity(row, row.quantity + 1)}
            >
              <Icon name="add" size={14} data-slot="icon" />
            </Button>
          </div>
        ),
      align: 'end',
    },
    {
      id: 'matchStatus',
      header: 'وضعیت تطابق',
      cell: (row) => {
        const badge = (
          <Badge
            variant={row.matchStatus === 'barcode' ? 'valid' : 'info'}
            className={!readOnly ? 'cursor-pointer' : undefined}
          >
            <Icon
              name={row.matchStatus === 'barcode' ? 'check_circle' : 'task_alt'}
              size={14}
              data-slot="icon"
            />
            {MATCH_STATUS_LABEL[row.matchStatus]}
          </Badge>
        )
        if (readOnly) return badge
        return (
          <button
            type="button"
            disabled={busy}
            title="تغییر وضعیت تطابق"
            onClick={() => void toggleLineMatchStatus(row)}
          >
            {badge}
          </button>
        )
      },
    },
    {
      id: 'actions',
      header: 'عملیات',
      cell: (row) =>
        readOnly ? (
          '—'
        ) : (
          <ActionTooltip title="حذف قلم جابجایی">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={busy}
              aria-label="حذف قلم"
              onClick={() => void removeLine(row.id)}
            >
              <Icon name="delete" size={16} data-slot="icon" />
            </Button>
          </ActionTooltip>
        ),
      align: 'end',
    },
  ]

  const batchColumns: DenseColumn<ExpiryBatch>[] = [
    {
      id: 'pick',
      header: 'انتخاب',
      cell: (row) => {
        const remaining = remainingBatchQuantity(row.quantity, lines, row.batchId)
        return (
          <input
            type="radio"
            name="source-batch"
            checked={selectedBatchId === row.batchId}
            disabled={readOnly || remaining <= 0}
            onChange={() => setSelectedBatchId(row.batchId)}
            aria-label={`بچ ${row.batchNo}`}
          />
        )
      },
    },
    {
      id: 'batchNo',
      header: 'سری ساخت',
      cell: (row) => <span className="font-semibold text-primary">{row.batchNo}</span>,
      dir: 'ltr',
    },
    {
      id: 'expiry',
      header: 'انقضا',
      cell: (row) => formatJalaliDate(row.expiry),
    },
    {
      id: 'remainingDays',
      header: 'مانده تا انقضا',
      cell: (row) => {
        const triage = expiryTriage(row.expiry)
        return <TriageStatusBadge status={triage.status}>{triage.label}</TriageStatusBadge>
      },
    },
    {
      id: 'qty',
      header: 'موجودی آزاد مبدا',
      cell: (row) => {
        const staged = stagedQuantityForBatch(lines, row.batchId)
        const remaining = remainingBatchQuantity(row.quantity, lines, row.batchId)
        return (
          <div className="flex flex-col items-end">
            <span className="font-semibold">
              {formatPersianNumber(remaining)} {row.unitLabel || 'عدد'}
            </span>
            {staged > 0 ? (
              <span className="text-label-sm text-text-muted">
                ({formatPersianNumber(staged)} در پیش‌نویس)
              </span>
            ) : null}
          </div>
        )
      },
      align: 'end',
    },
    {
      id: 'loc',
      header: 'موقعیت مبدا',
      cell: (row) => row.locationLabel,
    },
  ]

  const units = sumTransferUnits(lines)
  const confirmReady = transfer ? canConfirmTransfer(transfer) : false
  const checklistDone = checklist.every(Boolean)

  const shell = (children: React.ReactNode) => (
    <AppShell
      navItems={getInternalTransferNavItems('internal-transfer')}
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
      <div data-slot="internal-transfer" className="flex flex-col gap-4">
        <PageHeader
          title={PAGE_TITLE}
          description="جابجایی کنترل‌شده داروهای حساس و پرمصرف، ثبت بچ و به‌روزرسانی برخط مکان فیزیکی اقلام"
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
                  <BreadcrumbPage>انتقال داخلی</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {transfer ? (
                <Badge variant={transfer.status === 'confirmed' ? 'valid' : 'warning'}>
                  {STATUS_LABEL[transfer.status]}
                  {transfer.transferNo ? ` • ${transfer.transferNo}` : ''}
                </Badge>
              ) : null}
              {transfer ? (
                <Button type="button" variant="outline" size="sm" onClick={startNewTransfer}>
                  <Icon name="add_circle" size={16} data-slot="icon" />
                  ثبت حواله جدید
                </Button>
              ) : null}
            </div>
          }
        />
        {children}
      </div>
    </AppShell>
  )

  if (loadState === 'loading') {
    return shell(
      <div
        data-slot="internal-transfer-skeleton"
        className="space-y-6 py-2"
        aria-busy="true"
        aria-label="در حال بارگذاری حواله انتقال داخلی"
      >
        <div className="space-y-4 rounded-default border border-border-default bg-card p-6">
          <div className="flex items-center justify-between border-b border-border-subtle pb-4">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-8 w-28" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <div className="space-y-3 rounded-default border border-border-default bg-card p-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-9 w-32" />
          </div>
          <div className="space-y-2 pt-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
        <p className="text-center text-body-sm text-text-secondary">
          در حال بارگذاری حواله انتقال…
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
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLoadedTransferId('')
                setLoadError('')
                setLoadState('loading')
                setRetry((v) => v + 1)
              }}
            >
              تلاش دوباره
            </Button>
            <Button type="button" variant="outline" onClick={startNewTransfer}>
              حواله جدید
            </Button>
          </div>
        }
      />,
    )
  }

  const firstDrugId = lines[0]?.drugId
  const otherDrafts = openDrafts.filter((d) => d.id !== transfer?.id)

  return shell(
    <>
      {transfer?.status === 'confirmed' ? (
        <AlertBanner
          tone="valid"
          title="حواله تایید شد"
          description={`شماره حواله: ${transfer.transferNo ?? '—'} • ${transfer.confirmedAt ? `زمان تایید: ${formatJalaliDate(transfer.confirmedAt.slice(0, 10))} • ` : ''}موجودی، کاردکس و گزارش ممیزی به‌روز شد. ویرایش این حواله بسته است.`}
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href="/shelf-inventory">موجودی قفسه‌ها</Link>
              </Button>
              {firstDrugId ? (
                <Button variant="outline" asChild>
                  <Link href={`/drug-details-cardex?drugId=${encodeURIComponent(firstDrugId)}`}>
                    کاردکس دارو
                  </Link>
                </Button>
              ) : null}
              <Button variant="outline" asChild>
                <Link href="/audit-log">لاگ ممیزی</Link>
              </Button>
            </div>
          }
        />
      ) : null}

      {otherDrafts.length > 0 && !readOnly ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Icon name="drafts" size={18} className="text-primary" data-slot="icon" />
              <span>پیش‌نویس‌های باز ({toPersianDigits(otherDrafts.length)}):</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {otherDrafts.slice(0, 5).map((d) => (
                <Button key={d.id} type="button" variant="outline" size="sm" asChild>
                  <Link href={`/internal-transfer?transferId=${encodeURIComponent(d.id)}`}>
                    {TRANSFER_REASON_LABELS[d.header.reason]} ({toPersianDigits(d.lines.length)} قلم)
                  </Link>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Stepper
        steps={steps}
        currentStepId={String(step)}
        onStepSelect={(id) => {
          const next = Number(id)
          if (next !== 1 && next !== 2) return
          void goToStep(next)
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>مسیر مبدا و مقصد</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 items-center gap-4 md:grid-cols-12">
          <div className="rounded-xl border border-border-default bg-surface-subtle p-4 md:col-span-4">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-label-sm text-text-muted">انبار مبدا (تحویل‌دهنده)</p>
              <Badge variant="info" dir="ltr">
                W-01
              </Badge>
            </div>
            <p className="font-semibold text-text-primary">{DEFAULT_HEADER.sourceLabel}</p>
          </div>

          <div className="flex flex-col gap-2 md:col-span-4">
            <div className="flex items-center justify-center gap-2 text-primary">
              <div className="h-px flex-1 bg-border-default" />
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Icon name="sync_alt" size={18} data-slot="icon" />
              </span>
              <div className="h-px flex-1 bg-border-default" />
            </div>
            <Field label="علت انتقال داخلی" htmlFor="transfer-reason">
              <Select
                value={reason}
                disabled={readOnly}
                onValueChange={(value) => void onReasonChange(value as TransferReason)}
              >
                <SelectTrigger id="transfer-reason">
                  <SelectValue placeholder="علت را انتخاب کنید" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {REASON_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="rounded-xl border border-border-default bg-surface-subtle p-4 md:col-span-4">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-label-sm text-text-muted">محل مقصد (تحویل‌گیرنده)</p>
              <Badge variant="valid" dir="ltr">
                D-FRONT-02
              </Badge>
            </div>
            <p className="font-semibold text-text-primary">{DEFAULT_HEADER.destLabel}</p>
          </div>

          {!readOnly ? (
            <div className="flex flex-wrap items-center justify-between gap-2 md:col-span-12">
              <Button type="button" disabled={busy} onClick={() => void saveHeader()}>
                ذخیره سربرگ حواله
              </Button>
              {transfer ? (
                <span className="text-xs text-text-muted">
                  شناسه پیش‌نویس:{' '}
                  <span dir="ltr" className="font-mono">
                    {transfer.id}
                  </span>
                </span>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {step === 1 ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>جستجوی دارو و بچ FEFO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Field
                  label="نام دارو، کد ژنریک یا بارکد GTIN"
                  htmlFor="transfer-drug-search"
                >
                  <div className="relative" ref={searchBoxRef}>
                    <Input
                      id="transfer-drug-search"
                      value={drugQuery}
                      disabled={readOnly}
                      onChange={(e) => onDrugQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setDrugHits([])
                          setDrugSearchState('idle')
                        }
                      }}
                      placeholder="حداقل دو حرف از نام دارو یا کد GTIN..."
                    />
                    {drugSearchState === 'searching' ? (
                      <div className="bg-surface-container-lowest absolute z-20 mt-1 w-full rounded-lg border px-3 py-2 text-xs text-text-muted shadow-sm">
                        در حال جستجو…
                      </div>
                    ) : null}
                    {drugSearchState === 'empty' ? (
                      <div className="bg-surface-container-lowest absolute z-20 mt-1 w-full rounded-lg border px-3 py-2 text-xs text-text-muted shadow-sm">
                        دارویی با این مشخصات یافت نشد.
                      </div>
                    ) : null}
                    {drugHits.length > 0 ? (
                      <ul className="bg-surface-container-lowest absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border shadow-md">
                        {drugHits.map((drug) => (
                          <li key={drug.id}>
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-right text-sm hover:bg-surface-subtle"
                              onClick={() => pickDrug(drug)}
                            >
                              <span className="font-medium">{drug.nameFa}</span>
                              <span className="text-xs text-text-muted" dir="ltr">
                                {drug.gtin || drug.genericCode}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </Field>

                <Field label="تعداد انتقال" htmlFor="transfer-qty">
                  <Input
                    id="transfer-qty"
                    value={qtyRaw}
                    disabled={readOnly}
                    onChange={(e) => setQtyRaw(e.target.value)}
                    placeholder="مثلاً ۱۰"
                  />
                </Field>

                <Field label="قفسه مقصد" htmlFor="transfer-dest-bin">
                  <div className="space-y-1.5">
                    <Select
                      value={destBinId}
                      disabled={readOnly}
                      onValueChange={setDestBinId}
                    >
                      <SelectTrigger id="transfer-dest-bin">
                        <SelectValue placeholder="انتخاب قفسه مقصد" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {visibleDestBins.map((bin) => (
                            <SelectItem key={bin.id} value={bin.id}>
                              {bin.address} — {bin.zoneLabel}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {dispensingBins.length > 0 && allBins.length > dispensingBins.length ? (
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-secondary">
                        <Checkbox
                          checked={showAllBins}
                          disabled={readOnly}
                          onCheckedChange={(checked) => setShowAllBins(checked === true)}
                        />
                        <span>نمایش همه قفسه‌های انبار</span>
                      </label>
                    ) : null}
                  </div>
                </Field>

                <Field label="وضعیت تطابق اسکن" htmlFor="transfer-match-mode">
                  <Select
                    value={matchMode}
                    disabled={readOnly}
                    onValueChange={(value) => setMatchMode(value as MatchStatus)}
                  >
                    <SelectTrigger id="transfer-match-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="barcode">تطبیق کامل بارکد</SelectItem>
                        <SelectItem value="physical">تطبیق فیزیکی</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              {selectedDrug ? (
                <DenseDataTable
                  columns={batchColumns}
                  data={sourceBatches}
                  getRowId={(row) => row.batchId}
                  caption="بچ‌های موجود در مبدا (مرتب‌سازی FEFO بر اساس نزدیک‌ترین انقضا)"
                  emptyMessage="بچ فعالی برای این دارو در مبدا یافت نشد."
                />
              ) : (
                <p className="text-sm text-text-secondary">
                  ابتدا دارو را از کادر جستجو انتخاب کنید تا بچ‌های فعال به ترتیب FEFO نمایش داده شوند.
                </p>
              )}

              {!readOnly ? (
                <Button type="button" disabled={busy} onClick={() => void submitLine()}>
                  <Icon name="playlist_add" size={18} data-slot="icon" />
                  افزودن قلم به حواله
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CardTitle>اقلام ثبت‌شده در پیش‌نویس</CardTitle>
                <Badge variant="info">{toPersianDigits(lines.length)} قلم کالا</Badge>
              </div>
              {!readOnly && lines.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => setClearConfirmOpen(true)}
                >
                  <Icon name="clear_all" size={16} data-slot="icon" />
                  پاکسازی کل پیش‌نویس
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              <DenseDataTable
                columns={lineColumns}
                data={lines}
                getRowId={(row) => row.id}
                emptyMessage="هنوز قلمی ثبت نشده است."
              />

              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-surface-subtle px-4 py-3">
                <div className="flex flex-wrap items-center gap-6 text-sm">
                  <span>
                    مجموع اقلام ردیف‌ها:{' '}
                    <strong className="text-text-primary">
                      {toPersianDigits(lines.length)} قلم
                    </strong>
                  </span>
                  <span>
                    مجموع تعداد واحد:{' '}
                    <strong className="text-primary">
                      {formatPersianNumber(units)} عدد/بسته
                    </strong>
                  </span>
                </div>
                {!readOnly ? (
                  <Button
                    type="button"
                    disabled={busy || !canAdvanceToStep2(lines)}
                    onClick={() => void goToStep(2)}
                  >
                    ادامه به بازبینی
                    <Icon name="arrow_back" size={18} data-slot="icon" />
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <KpiMetricCard
              title="تعداد اقلام"
              value={toPersianDigits(lines.length)}
              icon="inventory_2"
              tone="primary"
            />
            <KpiMetricCard
              title="مجموع واحد"
              value={formatPersianNumber(units)}
              icon="pin"
              tone="info"
            />
            <KpiMetricCard
              title="وضعیت اعتبارسنجی"
              value={confirmReady ? 'آماده تایید' : 'ناقص'}
              icon="rule"
              tone={confirmReady ? 'valid' : 'warning'}
            />
            <KpiMetricCard
              title="وضعیت سند"
              value={transfer ? STATUS_LABEL[transfer.status] : '—'}
              icon="verified"
              tone={transfer?.status === 'confirmed' ? 'valid' : 'neutral'}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>چک‌لیست تطابق زنجیره تحویل</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {CHECKLIST_ITEMS.map((label, index) => (
                <label key={label} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={checklist[index]}
                    disabled={readOnly}
                    onCheckedChange={(checked) => {
                      setChecklist((prev) => {
                        const next = [...prev]
                        next[index] = checked === true
                        return next
                      })
                    }}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>تایید تحویل‌دهنده و تحویل‌گیرنده</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border-default bg-surface-subtle p-4">
                <p className="text-label-sm text-text-muted">
                  تحویل‌دهنده (ثبت‌کننده در انبار)
                </p>
                <p className="mt-1 font-semibold text-text-primary">
                  {transfer?.createdBy.name || 'اپراتور انبار'}
                </p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {getAuditRoleLabel(transfer?.createdBy.role || 'warehouse_operator')}
                </p>
              </div>
              <Field label="نام تحویل‌گیرنده (پیشخوان)" htmlFor="transfer-receiver-name">
                <Input
                  id="transfer-receiver-name"
                  value={receiverName}
                  disabled={readOnly}
                  onChange={(e) => setReceiverName(e.target.value)}
                  placeholder="مثلاً الهام یزدانی (تکنسین پیشخوان)"
                />
              </Field>
              <Field label="یادداشت / توضیحات حواله" htmlFor="transfer-note">
                <Textarea
                  id="transfer-note"
                  rows={2}
                  value={note}
                  disabled={readOnly}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="توضیحات تکمیلی مسیر یا شرایط نگهداری..."
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>پیش‌نمایش اقلام</CardTitle>
            </CardHeader>
            <CardContent>
              <DenseDataTable
                columns={lineColumns.filter((c) => c.id !== 'actions')}
                data={lines}
                getRowId={(row) => row.id}
                emptyMessage="قلمی برای نمایش نیست."
              />
              {!readOnly ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void goToStep(1)}
                  >
                    <Icon name="arrow_forward" size={18} data-slot="icon" />
                    بازگشت و اصلاح اقلام
                  </Button>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void saveDraft()}
                    >
                      <Icon name="save" size={18} data-slot="icon" />
                      ذخیره به عنوان پیش‌نویس
                    </Button>
                    <Button
                      type="button"
                      disabled={busy || !confirmReady || !checklistDone}
                      onClick={() => void finalizeTransfer()}
                    >
                      <Icon name="check_circle" size={18} data-slot="icon" />
                      تایید نهایی حواله
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={clearConfirmOpen}
        onOpenChange={setClearConfirmOpen}
        tone="critical"
        title="پاکسازی کل اقلام پیش‌نویس"
        description="آیا از حذف همه اقلام ثبت‌شده در این پیش‌نویس اطمینان دارید؟"
        confirmLabel="پاکسازی همه اقلام"
        cancelLabel="انصراف"
        loading={busy}
        onConfirm={() => void handleClearLines()}
      />
    </>,
  )
}
