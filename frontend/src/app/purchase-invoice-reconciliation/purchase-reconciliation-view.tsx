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
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@/components/ui'
import { AppShell } from '@/components/layout'
import {
  ActionTooltip,
  AlertBanner,
  ConfirmDialog,
  DenseDataTable,
  KpiMetricCard,
  PageHeader,
  Pagination,
  type DenseColumn,
} from '@/components/shared'
import {
  FileDropzone,
  Stepper,
  type StepperStep,
  type StepStatus,
} from '@/components/domain'
import {
  DrugFormDrawer,
  type DrugFormValues,
} from '@/app/drug-catalog/drug-form-drawer'
import { ApiError } from '@/lib/api/http'
import { saveDrug } from '@/lib/drugs/data-access'
import {
  formatPersianNumber,
  formatRial,
  toPersianDigits,
} from '@/lib/persian'
import {
  confirmReconciliation,
  deleteReconciliationRow,
  downloadReconciliationTemplate,
  getReconciliation,
  listReconciliations,
  patchReconciliation,
  patchReconciliationRow,
  rematchReconciliation,
  updateReconciliationMapping,
  uploadReconciliationFile,
  type RowPatchBody,
} from '@/lib/reconciliation/data-access'
import {
  canConfirmReconciliation,
  countMappedFields,
  DISTRIBUTOR_TEMPLATES,
  filterReconciledRows,
  formatFileSizeFa,
  formatPriceVarianceFa,
  formatRowExpiryFa,
  getTemplateLabel,
  MAPPING_FIELDS,
  rowNeedsAction,
} from '@/lib/reconciliation/helpers'
import type {
  ColumnMapping,
  PurchaseReconciliation,
  ReconciledRow,
  ReconciliationHistoryItem,
  ReconciliationRowFilter,
} from '@/lib/types/reconciliation'
import { cn } from '@/lib/utils'
import { getPurchaseReconciliationNavItems } from './nav'
import {
  ReconcileRowEditDrawer,
  ReconciliationHistoryDrawer,
} from './reconciliation-dialogs'

type WizardStep = 1 | 2 | 3

const PAGE_SIZE = 10

function errorMessage(err: unknown, fallback = 'عملیات با خطا مواجه شد.'): string {
  if (err instanceof ApiError) {
    if (err.fields && typeof err.fields === 'object') {
      const first = Object.values(err.fields as Record<string, string>)[0]
      if (first) return first
    }
    return err.message || fallback
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}

function stepStatus(
  target: WizardStep,
  active: WizardStep,
  hasFile: boolean,
  isConfirmed: boolean,
): StepStatus {
  if (isConfirmed) return 'completed'
  if (target === active) return 'current'
  if (target === 1 && hasFile) return 'completed'
  if (target < active) return 'completed'
  return 'upcoming'
}

export function PurchaseReconciliationView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reconcileId = searchParams.get('reconcileId')?.trim() ?? ''

  const [active, setActive] = React.useState<PurchaseReconciliation | null>(null)
  const [step, setStep] = React.useState<WizardStep>(1)
  const [loading, setLoading] = React.useState<boolean>(Boolean(reconcileId))
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  // Step 1 upload form state
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([])
  const [invoiceNo, setInvoiceNo] = React.useState('')
  const [distributor, setDistributor] = React.useState('پخش هجرت')
  const [templateId, setTemplateId] = React.useState('hijrat')
  const [discountRial, setDiscountRial] = React.useState('0')

  // Step 2 mapping draft
  const [mappingDraft, setMappingDraft] = React.useState<ColumnMapping | null>(null)

  // Step 3 table & panel state
  const [mappingPanelOpen, setMappingPanelOpen] = React.useState(true)
  const [rowFilter, setRowFilter] = React.useState<ReconciliationRowFilter>('all')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [page, setPage] = React.useState(1)

  // Drawers & dialogs
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [historyLoading, setHistoryLoading] = React.useState(false)
  const [historyItems, setHistoryItems] = React.useState<ReconciliationHistoryItem[]>([])

  const [editingRow, setEditingRow] = React.useState<ReconciledRow | null>(null)
  const [quickDrugRow, setQuickDrugRow] = React.useState<ReconciledRow | null>(null)
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  const [trackedReconcileId, setTrackedReconcileId] = React.useState(reconcileId)
  const [loadedReconcileId, setLoadedReconcileId] = React.useState('')

  if (reconcileId !== trackedReconcileId) {
    setTrackedReconcileId(reconcileId)
    if (!reconcileId) {
      setLoadedReconcileId('')
      setActive(null)
      setStep(1)
      setLoading(false)
      setLoadError(null)
    } else if (loadedReconcileId !== reconcileId) {
      setLoading(true)
      setLoadError(null)
    }
  }

  const refreshHistory = React.useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await listReconciliations({ pageSize: 20 })
      setHistoryItems(res.items)
    } catch {
      // Non-blocking for initial page load
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  const loadById = React.useCallback(async (id: string) => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await getReconciliation(id)
      setLoadedReconcileId(data.id)
      setActive(data)
      setMappingDraft(data.mapping)
      setInvoiceNo(data.invoiceNo)
      setDistributor(data.distributor)
      setTemplateId(data.templateId)
      setDiscountRial(String(data.discountRial))
      setStep(data.status === 'confirmed' ? 3 : data.currentStep)
      setPage(1)
    } catch (err) {
      setLoadError(errorMessage(err, 'بارگذاری اطلاعات فاکتور با خطا مواجه شد.'))
      setActive(null)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    void listReconciliations({ pageSize: 20 })
      .then((res) => {
        if (!cancelled) setHistoryItems(res.items)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (!reconcileId || loadedReconcileId === reconcileId) return
    let cancelled = false
    void getReconciliation(reconcileId)
      .then((data) => {
        if (cancelled) return
        setLoadedReconcileId(data.id)
        setActive(data)
        setMappingDraft(data.mapping)
        setInvoiceNo(data.invoiceNo)
        setDistributor(data.distributor)
        setTemplateId(data.templateId)
        setDiscountRial(String(data.discountRial))
        setStep(data.status === 'confirmed' ? 3 : data.currentStep)
        setPage(1)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(errorMessage(err, 'بارگذاری اطلاعات فاکتور با خطا مواجه شد.'))
        setActive(null)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reconcileId, loadedReconcileId])

  const readOnly = active?.status === 'confirmed' || active?.status === 'cancelled'
  const mappedCount = active ? countMappedFields(active.mapping) : 0

  const steps: StepperStep[] = React.useMemo(
    () => [
      {
        id: '1',
        label: 'بارگذاری فایل فاکتور',
        meta:
          stepStatus(1, step, Boolean(active), Boolean(readOnly)) === 'completed'
            ? 'مرحله ۱: تکمیل شده'
            : 'مرحله ۱: در انتظار فایل',
        description: active
          ? `${active.fileName} (${formatFileSizeFa(active.fileSizeBytes)})`
          : 'فایل اکسل (.xlsx) یا CSV فاکتور پخش',
        status: stepStatus(1, step, Boolean(active), Boolean(readOnly)),
        icon: active ? 'check' : 'post_add',
      },
      {
        id: '2',
        label: 'نگاشت و تطبیق ستون‌ها',
        meta:
          stepStatus(2, step, Boolean(active), Boolean(readOnly)) === 'completed'
            ? `مرحله ۲: تکمیل شده (${toPersianDigits(mappedCount)} فیلد منطبق)`
            : 'مرحله ۲: تطبیق ستون‌ها',
        description: 'تطبیق خودکار شناسه GTIN، بچ و قیمت‌ها',
        status: stepStatus(2, step, Boolean(active), Boolean(readOnly)),
        icon: step > 2 || readOnly ? 'check' : 'swap_horizontal_circle',
      },
      {
        id: '3',
        label: 'پیش‌نمایش، اعتبارسنجی و تایید',
        meta: readOnly ? 'مرحله ۳: تایید نهایی شده' : 'مرحله ۳: در حال بررسی',
        description: 'بررسی مغایرت اقلام و قیمت مصوب تی‌تک',
        status: stepStatus(3, step, Boolean(active), Boolean(readOnly)),
        icon: readOnly ? 'check' : 'fact_check',
      },
    ],
    [active, mappedCount, readOnly, step],
  )

  async function handleDownloadTemplate() {
    try {
      const blob = await downloadReconciliationTemplate()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'pharmastock-invoice-template.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success('فایل نمونه استاندارد اکسل دانلود شد.')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function handleUploadSubmit(event: React.FormEvent) {
    event.preventDefault()
    const file = selectedFiles[0]
    if (!file) {
      toast.error('لطفاً ابتدا یک فایل اکسل (.xlsx) یا CSV انتخاب کنید.')
      return
    }
    setBusy(true)
    try {
      const created = await uploadReconciliationFile({
        file,
        invoiceNo: invoiceNo.trim() || undefined,
        distributor: distributor.trim() || undefined,
        templateId,
        discountRial: Number(discountRial) || 0,
      })
      setActive(created)
      setMappingDraft(created.mapping)
      setSelectedFiles([])
      setStep(2)
      setPage(1)
      router.replace(`/purchase-invoice-reconciliation?reconcileId=${created.id}`)
      void refreshHistory()
      toast.success('فایل فاکتور پردازش و نگاشت اولیه ستون‌ها انجام شد.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleApplyMapping(goToStep3: boolean) {
    if (!active || !mappingDraft) return
    setBusy(true)
    try {
      const updated = await updateReconciliationMapping(active.id, {
        templateId,
        mapping: mappingDraft,
        goToStep3,
      })
      setActive(updated)
      setMappingDraft(updated.mapping)
      if (goToStep3) {
        setStep(3)
        setPage(1)
      }
      toast.success('نگاشت ستون‌ها اعمال و تطبیق مجدد انجام شد.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveDraft() {
    if (!active) return
    setBusy(true)
    try {
      const updated = await patchReconciliation(active.id, {
        invoiceNo: invoiceNo.trim() || active.invoiceNo,
        distributor: distributor.trim() || active.distributor,
        discountRial: Math.max(0, Number(discountRial) || 0),
        quarantineOnIntake: active.quarantineOnIntake,
        currentStep: step,
      })
      setActive(updated)
      void refreshHistory()
      toast.success('پیش‌نویس فاکتور با موفقیت ذخیره شد.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleQuarantine(checked: boolean) {
    if (!active || readOnly) return
    setActive((prev) => (prev ? { ...prev, quarantineOnIntake: checked } : prev))
    try {
      const updated = await patchReconciliation(active.id, {
        quarantineOnIntake: checked,
      })
      setActive(updated)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const handleApprovePrice = React.useCallback(
    async (row: ReconciledRow) => {
      if (!active || readOnly) return
      setBusy(true)
      try {
        const updated = await patchReconciliationRow(active.id, row.id, {
          priceApproved: true,
        })
        setActive(updated)
        toast.success(
          `اضافه‌قیمت ردیف ${toPersianDigits(row.rowNumber)} توسط مسئول فنی تایید شد.`,
        )
      } catch (err) {
        toast.error(errorMessage(err))
      } finally {
        setBusy(false)
      }
    },
    [active, readOnly],
  )

  const handleDeleteRow = React.useCallback(
    async (row: ReconciledRow) => {
      if (!active || readOnly) return
      setBusy(true)
      try {
        const updated = await deleteReconciliationRow(active.id, row.id)
        setActive(updated)
        toast.success(`ردیف «${row.excelName}» از پیش‌نویس حذف شد.`)
      } catch (err) {
        toast.error(errorMessage(err))
      } finally {
        setBusy(false)
      }
    },
    [active, readOnly],
  )

  async function handleSaveRowEdit(rowId: string, patch: RowPatchBody) {
    if (!active) return
    setBusy(true)
    try {
      const updated = await patchReconciliationRow(active.id, rowId, patch)
      setActive(updated)
      setEditingRow(null)
      toast.success('مشخصات ردیف به‌روزرسانی و دوباره تطبیق داده شد.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleQuickDrugSaved(values: DrugFormValues) {
    if (!active || !quickDrugRow) return
    setBusy(true)
    try {
      const createdDrug = await saveDrug(
        {
          nameFa: values.nameFa.trim(),
          brandName: values.brandName.trim(),
          dosageForm: values.dosageForm,
          strength: values.strength.trim(),
          gtin: values.gtin.trim(),
          genericCode: values.genericCode.trim(),
          manufacturer: values.manufacturer.trim(),
          category: values.category,
          isControlled: values.isControlled,
          atcCode: values.atcCode.trim() || undefined,
          storageTemp: values.storageTemp,
          reorderLevel: Number(values.reorderLevel) || 0,
        },
        null,
      )
      const updated = await rematchReconciliation(active.id, {
        rowId: quickDrugRow.id,
        drugId: createdDrug.id,
      })
      setActive(updated)
      setQuickDrugRow(null)
      toast.success(`داروی «${createdDrug.nameFa}» در کاتالوگ ثبت و با ردیف فاکتور تطبیق داده شد.`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirmFinal() {
    if (!active) return
    setBusy(true)
    try {
      const confirmed = await confirmReconciliation(active.id)
      setActive(confirmed)
      setConfirmOpen(false)
      void refreshHistory()
      toast.success('فاکتور تایید نهایی شد؛ رسید انبار، سری‌ساخت‌ها و گردش کاردکس ایجاد شدند.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function handleStepSelect(stepId: string) {
    if (stepId === '1') {
      setStep(1)
      return
    }
    if (stepId === '2' && active) {
      setStep(2)
      return
    }
    if (stepId === '3' && active) {
      setStep(3)
    }
  }

  const filteredRows = React.useMemo(() => {
    if (!active) return []
    return filterReconciledRows(active.rows, rowFilter, searchQuery)
  }, [active, rowFilter, searchQuery])

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const paginatedRows = React.useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filteredRows.slice(start, start + PAGE_SIZE)
  }, [filteredRows, safePage])

  const actionNeededCount = React.useMemo(() => {
    if (!active) return 0
    return active.rows.filter(rowNeedsAction).length
  }, [active])

  const matchedChipCount = React.useMemo(() => {
    if (!active) return 0
    return active.rows.length - actionNeededCount
  }, [active, actionNeededCount])

  const columns: DenseColumn<ReconciledRow>[] = React.useMemo(
    () => [
      {
        id: 'rowNumber',
        header: '#',
        className: 'w-12 text-center text-text-secondary',
        headerClassName: 'w-12 text-center',
        cell: (row) => toPersianDigits(row.rowNumber),
      },
      {
        id: 'matchStatus',
        header: 'وضعیت انطباق با کاتالوگ',
        cell: (row) => {
          if (row.matchStatus === 'new_item') {
            return (
              <Badge variant="warning" className="gap-1">
                <Icon name="fiber_new" size={14} data-slot="icon" />
                قلم دارویی جدید
              </Badge>
            )
          }
          if (row.matchStatus === 'price_mismatch') {
            return row.priceApproved ? (
              <Badge variant="valid" className="gap-1">
                <Icon name="verified_user" size={14} data-slot="icon" />
                تایید فنی ({formatPriceVarianceFa(row.priceDiffPct)})
              </Badge>
            ) : (
              <Badge variant="critical" className="gap-1">
                <Icon name="error" size={14} data-slot="icon" />
                مغایرت قیمت مصوب ({formatPriceVarianceFa(row.priceDiffPct)})
              </Badge>
            )
          }
          return (
            <Badge variant="valid" className="gap-1">
              <Icon name="check_circle" size={14} data-slot="icon" />
              منطبق با کاتالوگ
            </Badge>
          )
        },
      },
      {
        id: 'excelName',
        header: 'نام در اکسل فاکتور',
        cell: (row) => (
          <span
            className={cn(
              'font-medium',
              row.matchStatus === 'new_item'
                ? 'font-bold text-status-warning-fg'
                : 'text-text-primary',
            )}
          >
            {row.excelName}
          </span>
        ),
      },
      {
        id: 'catalogNameFa',
        header: 'کالای شناسایی‌شده در سامانه',
        cell: (row) =>
          row.catalogNameFa ? (
            <span className="text-text-primary">{row.catalogNameFa}</span>
          ) : (
            <span className="italic text-status-warning-fg">
              یافت نشد - نیازمند کدگذاری کاتالوگ
            </span>
          ),
      },
      {
        id: 'codes',
        header: 'شناسه بارکد / IRC',
        dir: 'ltr',
        cell: (row) => (
          <span className="text-text-secondary">
            {row.gtin || row.irc || '—'}
          </span>
        ),
      },
      {
        id: 'batchNo',
        header: 'سری ساخت (بچ)',
        dir: 'ltr',
        cell: (row) => <span className="font-medium">{row.batchNo || '—'}</span>,
      },
      {
        id: 'expiry',
        header: 'انقضا (شمسی)',
        cell: (row) => formatRowExpiryFa(row),
      },
      {
        id: 'quantity',
        header: 'تعداد',
        align: 'end',
        cell: (row) => (
          <span className="font-bold text-text-primary">
            {formatPersianNumber(row.quantity)}{' '}
            <span className="text-label-sm font-normal text-text-secondary">
              {row.unitLabel}
            </span>
          </span>
        ),
      },
      {
        id: 'buyPrice',
        header: 'قیمت خرید (ریال)',
        align: 'end',
        cell: (row) => (
          <span
            className={cn(
              row.matchStatus === 'price_mismatch' && !row.priceApproved
                ? 'font-bold text-status-critical-fg'
                : 'text-text-primary',
            )}
          >
            {formatPersianNumber(row.buyPriceRial)}
          </span>
        ),
      },
      {
        id: 'approvedPrice',
        header: 'مصوب تی‌تک (ریال)',
        align: 'end',
        cell: (row) =>
          row.approvedPriceRial ? (
            <span
              className={cn(
                'text-text-secondary',
                row.matchStatus === 'price_mismatch' &&
                  !row.priceApproved &&
                  'line-through',
              )}
            >
              {formatPersianNumber(row.approvedPriceRial)}
            </span>
          ) : (
            <span className="text-text-muted">—</span>
          ),
      },
      {
        id: 'actions',
        header: 'عملیات',
        cell: (row) => {
          if (readOnly) {
            return <span className="text-label-sm text-text-muted">ثبت‌شده</span>
          }
          if (row.matchStatus === 'new_item') {
            return (
              <div className="flex flex-wrap items-center gap-1">
                <ActionTooltip title="تعریف سریع در کاتالوگ">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setQuickDrugRow(row)}
                  >
                    <Icon name="add_circle" size={14} data-slot="icon" />
                    تعریف سریع در کاتالوگ
                  </Button>
                </ActionTooltip>
                <ActionTooltip title="ویرایش جزئیات ردیف">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="ویرایش جزئیات"
                    onClick={() => setEditingRow(row)}
                  >
                    <Icon name="edit" size={16} data-slot="icon" />
                  </Button>
                </ActionTooltip>
                <ActionTooltip title="حذف ردیف از فاکتور">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="حذف ردیف"
                    onClick={() => void handleDeleteRow(row)}
                  >
                    <Icon name="delete" size={16} data-slot="icon" />
                  </Button>
                </ActionTooltip>
              </div>
            )
          }
          if (row.matchStatus === 'price_mismatch' && !row.priceApproved) {
            return (
              <div className="flex flex-wrap items-center gap-1">
                <ActionTooltip title="تایید فنی مغایرت قیمت">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void handleApprovePrice(row)}
                  >
                    <Icon name="verified_user" size={14} data-slot="icon" />
                    تایید فنی
                  </Button>
                </ActionTooltip>
                <ActionTooltip title="ویرایش جزئیات ردیف">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="ویرایش جزئیات"
                    onClick={() => setEditingRow(row)}
                  >
                    <Icon name="edit" size={16} data-slot="icon" />
                  </Button>
                </ActionTooltip>
                <ActionTooltip title="حذف ردیف از فاکتور">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="حذف ردیف"
                    onClick={() => void handleDeleteRow(row)}
                  >
                    <Icon name="delete" size={16} data-slot="icon" />
                  </Button>
                </ActionTooltip>
              </div>
            )
          }
          return (
            <div className="flex items-center gap-1">
              <ActionTooltip title="ویرایش جزئیات ردیف">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="ویرایش جزئیات"
                  onClick={() => setEditingRow(row)}
                >
                  <Icon name="edit" size={16} data-slot="icon" />
                </Button>
              </ActionTooltip>
              <ActionTooltip title="حذف ردیف از فاکتور">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="حذف ردیف"
                  onClick={() => void handleDeleteRow(row)}
                >
                  <Icon name="delete" size={16} data-slot="icon" />
                </Button>
              </ActionTooltip>
            </div>
          )
        },
      },
    ],
    [busy, readOnly, handleApprovePrice, handleDeleteRow],
  )

  const canConfirm = canConfirmReconciliation(active)

  const headerBreadcrumbs = (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/dashboard">داشبورد</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>فاکتور خرید (اکسل و تطبیق)</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )

  return (
    <AppShell
      navItems={getPurchaseReconciliationNavItems('purchase-reconciliation')}
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
    >
      <div className="flex flex-col gap-space-lg">
        <PageHeader
          title="ثبت و بارگذاری فاکتور خرید دارو (اکسل و انطباق سیستمی)"
          description="ورود فاکتورهای صادره از شرکت‌های پخش، تطبیق خودکار ستون‌ها و اعتبارسنجی کاتالوگ دارو با پایگاه داده سازمان غذا و دارو (تی‌تک)"
          breadcrumbs={headerBreadcrumbs}
          actions={
            <>
              <Badge variant="info" className="gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                سامانه فعال TTAC
              </Badge>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleDownloadTemplate()}
              >
                <Icon name="download" size={18} data-slot="icon" />
                دانلود نمونه استاندارد اکسل
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setHistoryOpen(true)
                  void refreshHistory()
                }}
              >
                <Icon name="history" size={18} data-slot="icon" />
                سوابق فاکتورهای واردشده
              </Button>
            </>
          }
        />

        <Stepper
          steps={steps}
          currentStepId={String(step)}
          onStepSelect={handleStepSelect}
          data-testid="reconciliation-stepper"
        />

        {loading ? (
          <div
            data-slot="purchase-reconciliation-skeleton"
            className="space-y-6"
            aria-busy="true"
            aria-label="در حال بارگذاری سند تطبیق فاکتور"
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
              <Skeleton className="h-36 w-full" />
            </div>
            <div className="space-y-3 rounded-default border border-border-default bg-card p-6">
              <Skeleton className="h-6 w-48" />
              <div className="space-y-2 pt-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
            <p className="text-center text-body-sm text-text-secondary">
              در حال بارگذاری سند تطبیق فاکتور…
            </p>
          </div>
        ) : loadError ? (
          <AlertBanner
            tone="critical"
            title="خطا در دریافت اطلاعات فاکتور"
            description={loadError}
            action={
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => (reconcileId ? void loadById(reconcileId) : undefined)}
              >
                تلاش مجدد
              </Button>
            }
          />
        ) : null}

        {!loading && active?.status === 'confirmed' ? (
          <AlertBanner
            tone="valid"
            title="تطبیق فاکتور تایید نهایی و در انبار ثبت شد"
            description={`فاکتور ${active.invoiceNo} با ${formatPersianNumber(active.rows.length)} ردیف به صورت ${active.quarantineOnIntake ? 'قرنطینه ورودی' : 'موجودی فعال'} در کاردکس ثبت گردید.`}
            action={
              <div className="flex flex-wrap gap-2">
                {active.createdReceiptId ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/invoice-receipts?receiptId=${active.createdReceiptId}`}>
                      مشاهده رسید انبار
                    </Link>
                  </Button>
                ) : null}
                <Button asChild size="sm" variant="outline">
                  <Link href="/expiry-alerts-fefo">مشاهده سری‌ساخت‌ها</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/audit-log">گزارش ممیزی</Link>
                </Button>
              </div>
            }
          />
        ) : null}

        {/* STEP 1: Upload Excel / CSV or resume saved draft */}
        {!loading && step === 1 ? (
          <div className="grid grid-cols-1 gap-space-lg lg:grid-cols-12">
            <Card className="lg:col-span-8">
              <CardHeader>
                <CardTitle>بارگذاری فایل اکسل فاکتور خرید</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="flex flex-col gap-5" onSubmit={handleUploadSubmit}>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="rec-invoice-no">شماره فاکتور شرکت پخش</Label>
                      <Input
                        id="rec-invoice-no"
                        dir="ltr"
                        className="font-latin"
                        placeholder="مثلاً HJR-1405-8824 (اختیاری)"
                        value={invoiceNo}
                        onChange={(e) => setInvoiceNo(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="rec-template">الگوی نگاشت شرکت پخش</Label>
                      <Select
                        value={templateId}
                        onValueChange={(val) => {
                          setTemplateId(val)
                          const preset = DISTRIBUTOR_TEMPLATES.find((t) => t.id === val)
                          if (preset && preset.id !== 'custom') {
                            setDistributor(preset.distributor)
                          }
                        }}
                      >
                        <SelectTrigger id="rec-template">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DISTRIBUTOR_TEMPLATES.map((tpl) => (
                            <SelectItem key={tpl.id} value={tpl.id}>
                              {tpl.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="rec-distributor">نام شرکت پخش</Label>
                      <Input
                        id="rec-distributor"
                        value={distributor}
                        onChange={(e) => setDistributor(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="rec-discount">تخفیف کل فاکتور (ریال)</Label>
                      <Input
                        id="rec-discount"
                        type="number"
                        min={0}
                        dir="ltr"
                        className="font-latin"
                        value={discountRial}
                        onChange={(e) => setDiscountRial(e.target.value)}
                      />
                    </div>
                  </div>

                  <FileDropzone
                    accept=".xlsx,.csv"
                    maxSizeBytes={10 * 1024 * 1024}
                    busy={busy}
                    title="فایل اکسل (.xlsx) یا CSV فاکتور خرید را بارگذاری کنید"
                    hint="فایل نمونه را می‌توانید از دکمه بالای صفحه دانلود و مستقیماً بارگذاری نمایید (حداکثر ۱۰ مگابایت)"
                    files={selectedFiles}
                    onFilesSelected={(files) => setSelectedFiles(files)}
                    onFileRemove={() => setSelectedFiles([])}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleDownloadTemplate()}
                    >
                      <Icon name="download" size={18} data-slot="icon" />
                      دریافت نمونه استاندارد اکسل
                    </Button>
                    <Button
                      type="submit"
                      loading={busy}
                      disabled={selectedFiles.length === 0}
                      data-testid="upload-reconcile-submit"
                    >
                      <Icon name="fact_check" size={18} data-slot="icon" />
                      پردازش فایل و ورود به مرحله نگاشت
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>ادامه پیش‌نویس‌های آماده</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {historyLoading ? (
                  <p className="text-body-sm text-text-secondary">
                    در حال بررسی پیش‌نویس‌ها…
                  </p>
                ) : historyItems.length === 0 ? (
                  <p className="text-body-sm text-text-secondary">
                    پیش‌نویس آماده‌ای وجود ندارد. یک فایل جدید بارگذاری کنید.
                  </p>
                ) : (
                  historyItems.slice(0, 4).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        router.push(
                          `/purchase-invoice-reconciliation?reconcileId=${item.id}`,
                        )
                      }
                      className="flex flex-col gap-1.5 rounded-default border border-border-default bg-surface-subtle p-3 text-start transition-colors hover:bg-surface-hover"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold text-text-primary">
                          {item.invoiceNo}
                        </span>
                        <Badge
                          variant={item.status === 'confirmed' ? 'valid' : 'warning'}
                        >
                          {item.status === 'confirmed' ? 'تاییدشده' : 'پیش‌نویس'}
                        </Badge>
                      </div>
                      <span className="truncate text-label-sm text-text-secondary">
                        {item.distributor} · {formatPersianNumber(item.summary.totalRows)}{' '}
                        ردیف
                      </span>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* STEP 2: Column Mapping */}
        {!loading && active && mappingDraft && step === 2 ? (
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>تطبیق و نگاشت ستون‌های فایل اکسل به فیلدهای سامانه</CardTitle>
                <p className="mt-1 text-body-sm text-text-secondary">
                  ستون‌های شناسایی‌شده از فایل{' '}
                  <span dir="ltr" className="font-latin font-medium">
                    {active.fileName}
                  </span>{' '}
                  را بررسی و در صورت نیاز اصلاح کنید.
                </p>
              </div>
              <Badge variant="valid">
                {toPersianDigits(countMappedFields(mappingDraft))} از{' '}
                {toPersianDigits(MAPPING_FIELDS.length)} فیلد نگاشت شده
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {MAPPING_FIELDS.map((field) => {
                  const colIdx = mappingDraft[field.key]
                  const isMapped = colIdx >= 0
                  return (
                    <div
                      key={field.key}
                      className="flex flex-col gap-2 rounded-default border border-border-default bg-surface-subtle p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-label-md font-semibold">
                          {field.label}
                          {field.required ? ' *' : ''}
                        </Label>
                        {isMapped ? (
                          <Icon
                            name="check_circle"
                            size={16}
                            className="text-status-valid-fg"
                            data-slot="icon"
                          />
                        ) : null}
                      </div>
                      <Select
                        disabled={readOnly}
                        value={String(colIdx)}
                        onValueChange={(val) =>
                          setMappingDraft((prev) =>
                            prev ? { ...prev, [field.key]: Number(val) } : prev,
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="-1">نگاشت‌نشده</SelectItem>
                          {active.headers.map((header, idx) => (
                            <SelectItem key={idx} value={String(idx)}>
                              ستون {active.columnLabels[idx] ?? idx + 1} — {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                >
                  بازگشت به بارگذاری فایل
                </Button>
                <Button
                  type="button"
                  loading={busy}
                  disabled={readOnly}
                  onClick={() => void handleApplyMapping(true)}
                  data-testid="apply-mapping-next"
                >
                  <Icon name="fact_check" size={18} data-slot="icon" />
                  اعمال نگاشت و ورود به پیش‌نمایش و انطباق
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* STEP 3: KPIs, Mapping Sheet, Reconciled Table & Final Confirmation */}
        {!loading && active && step === 3 ? (
          <>
            {/* 5 KPI Summary Cards */}
            <section
              aria-label="شاخص‌های تطبیق فاکتور"
              className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-5"
            >
              <KpiMetricCard
                title="کل ردیف‌های فاکتور"
                value={
                  <>
                    {formatPersianNumber(active.summary.totalRows)}{' '}
                    <span className="text-body-sm font-normal text-text-secondary">
                      قلم
                    </span>
                  </>
                }
                icon="receipt_long"
                tone="neutral"
                delta={{
                  label: 'شامل تمام سطرهای فایل اکسل',
                  direction: 'flat',
                }}
              />
              <KpiMetricCard
                title="منطبق با کاتالوگ دارو"
                value={
                  <>
                    {formatPersianNumber(active.summary.matchedCount)}{' '}
                    <span className="text-body-sm font-normal text-text-secondary">
                      قلم ({toPersianDigits(active.summary.matchedPercent)}٪)
                    </span>
                  </>
                }
                icon="verified"
                tone="valid"
                delta={{
                  label: 'انطباق کامل کد IRC و بارکد',
                  direction: 'up',
                }}
              />
              <KpiMetricCard
                title="اقلام جدید (بدون سابقه)"
                value={
                  <>
                    {formatPersianNumber(active.summary.newItemCount)}{' '}
                    <span className="text-body-sm font-normal text-text-secondary">
                      قلم دارویی
                    </span>
                  </>
                }
                icon="new_releases"
                tone={active.summary.newItemCount > 0 ? 'warning' : 'valid'}
                delta={{
                  label:
                    active.summary.newItemCount > 0
                      ? 'نیازمند ثبت سریع در کاتالوگ'
                      : 'همه اقلام در کاتالوگ شناسایی شدند',
                  direction: 'flat',
                }}
              />
              <KpiMetricCard
                title="مغایرت قیمت مصوب"
                value={
                  <>
                    {formatPersianNumber(active.summary.unapprovedMismatchCount)}{' '}
                    <span className="text-body-sm font-normal text-text-secondary">
                      ردیف خطا
                    </span>
                  </>
                }
                icon="price_change"
                tone={
                  active.summary.unapprovedMismatchCount > 0 ? 'critical' : 'valid'
                }
                delta={{
                  label:
                    active.summary.unapprovedMismatchCount > 0
                      ? 'نیازمند تایید مسئول فنی'
                      : 'مغایرت تاییدنشده وجود ندارد',
                  direction: 'flat',
                }}
              />
              <KpiMetricCard
                title="مبلغ خالص پرداختی"
                value={formatRial(active.summary.netRial)}
                icon="payments"
                tone="primary"
                delta={{
                  label: `ناخالص: ${formatPersianNumber(active.summary.grossRial)} · تخفیف: ${formatPersianNumber(active.summary.discountRial)}`,
                  direction: 'flat',
                }}
              />
            </section>

            {/* Collapsible Column Mapping Specification Panel */}
            <Card className="overflow-hidden p-0">
              <button
                type="button"
                aria-expanded={mappingPanelOpen}
                onClick={() => setMappingPanelOpen((open) => !open)}
                className="flex w-full items-center justify-between bg-surface-subtle px-space-lg py-space-md text-start"
              >
                <div className="flex flex-wrap items-center gap-space-sm">
                  <Icon
                    name="swap_horizontal_circle"
                    size={22}
                    className="text-primary"
                    data-slot="icon"
                  />
                  <span className="text-title-md font-semibold text-text-primary">
                    برگه مشخصات نگاشت ستون‌های اکسل به فیلدهای دارویی سامانه
                  </span>
                  <Badge variant="valid">{getTemplateLabel(active.templateId)}</Badge>
                </div>
                <div className="flex items-center gap-1 text-label-sm text-text-secondary">
                  <span>مشاهده تنظیمات نگاشت</span>
                  <Icon
                    name="expand_more"
                    size={20}
                    className={cn(
                      'transition-transform',
                      mappingPanelOpen && 'rotate-180',
                    )}
                    data-slot="icon"
                  />
                </div>
              </button>
              {mappingPanelOpen ? (
                <div className="grid grid-cols-2 gap-space-sm border-t border-border-subtle p-space-lg sm:grid-cols-4 lg:grid-cols-8">
                  {MAPPING_FIELDS.map((field) => {
                    const colIdx = active.mapping[field.key]
                    const letter =
                      colIdx >= 0
                        ? `ستون ${active.columnLabels[colIdx] ?? colIdx + 1}`
                        : 'نگاشت‌نشده'
                    return (
                      <div
                        key={field.key}
                        className="flex flex-col rounded-default bg-surface-subtle p-2.5"
                      >
                        <span className="text-label-sm text-text-secondary">
                          {field.label}
                        </span>
                        <div className="mt-1.5 flex items-center justify-between border-t border-border-subtle pt-1.5">
                          <span className="text-body-sm font-bold text-primary">
                            {letter}
                          </span>
                          <Icon
                            name={colIdx >= 0 ? 'check_circle' : 'warning'}
                            size={14}
                            className={
                              colIdx >= 0
                                ? 'text-status-valid-fg'
                                : 'text-status-warning-fg'
                            }
                            data-slot="icon"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </Card>

            {/* Detailed Data Preview & TTAC Validation Table */}
            <Card className="overflow-hidden p-0">
              <div className="flex flex-col justify-between gap-space-sm border-b border-border-subtle bg-surface-subtle p-space-md lg:flex-row lg:items-center">
                <div className="flex flex-wrap items-center gap-space-sm">
                  <h2 className="text-title-md font-semibold text-text-primary">
                    ردیف‌های استخراج‌شده از اکسل
                  </h2>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={rowFilter === 'all' ? 'default' : 'outline'}
                      onClick={() => {
                        setRowFilter('all')
                        setPage(1)
                      }}
                    >
                      همه ({formatPersianNumber(active.rows.length)})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={rowFilter === 'action_needed' ? 'default' : 'outline'}
                      onClick={() => {
                        setRowFilter('action_needed')
                        setPage(1)
                      }}
                    >
                      نیاز به اقدام ({formatPersianNumber(actionNeededCount)})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={rowFilter === 'matched' ? 'default' : 'outline'}
                      onClick={() => {
                        setRowFilter('matched')
                        setPage(1)
                      }}
                    >
                      منطبق‌ها ({formatPersianNumber(matchedChipCount)})
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-space-sm">
                  <div className="relative w-56">
                    <Icon
                      name="search"
                      size={16}
                      className="pointer-events-none absolute top-1/2 start-2.5 -translate-y-1/2 text-text-muted"
                      data-slot="icon"
                    />
                    <Input
                      className="h-8 ps-8 text-body-sm"
                      placeholder="جستجو نام دارو، بارکد یا بچ..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value)
                        setPage(1)
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 text-label-sm text-text-secondary">
                    <Icon name="tune" size={16} data-slot="icon" />
                    <span>فیلتر وضعیت:</span>
                  </div>
                  <Select
                    value={rowFilter}
                    onValueChange={(val) => {
                      setRowFilter(val as ReconciliationRowFilter)
                      setPage(1)
                    }}
                  >
                    <SelectTrigger className="h-8 w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">نمایش همه سطرها</SelectItem>
                      <SelectItem value="price_mismatch">فقط مغایرت قیمت</SelectItem>
                      <SelectItem value="new_item">فقط اقلام دارویی جدید</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DenseDataTable
                columns={columns}
                data={paginatedRows}
                getRowId={(row) => row.id}
                stickyHeader={false}
                emptyMessage="ردیفی مطابق فیلتر انتخاب‌شده یافت نشد."
                caption="جدول انطباق اقلام فاکتور خرید با کاتالوگ و تی‌تک"
              />

              <Pagination
                page={safePage}
                pageCount={pageCount}
                totalItems={filteredRows.length}
                onPageChange={setPage}
              />
            </Card>

            {/* Technical Disclaimer & Final Confirmation Footer */}
            <Card className="p-space-lg">
              <div className="flex flex-col justify-between gap-space-md lg:flex-row lg:items-center">
                <div className="flex items-start gap-space-sm">
                  <Checkbox
                    id="quarantine-on-intake"
                    checked={active.quarantineOnIntake}
                    disabled={readOnly}
                    onCheckedChange={(checked) =>
                      void handleToggleQuarantine(checked === true)
                    }
                  />
                  <label
                    htmlFor="quarantine-on-intake"
                    className="cursor-pointer select-none text-body-md text-text-primary"
                  >
                    <span className="font-semibold">
                      ایجاد خودکار کدهای کاردکس و ثبت بچ‌ها در انبار موقت قرنطینه ورودی
                    </span>
                    <span className="mt-0.5 block text-body-sm text-text-secondary">
                      انتقال اتوماتیک به قفسه‌های اصلی پس از تایید فیزیکی و امضای الکترونیک مسئول فنی داروخانه
                    </span>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-space-sm">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setStep(1)
                      router.push('/purchase-invoice-reconciliation')
                    }}
                  >
                    <Icon name="replay" size={18} data-slot="icon" />
                    انصراف و بارگذاری مجدد
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={readOnly || busy}
                    onClick={() => void handleSaveDraft()}
                  >
                    <Icon name="save" size={18} data-slot="icon" />
                    ذخیره به عنوان پیش‌نویس
                  </Button>
                  <Button
                    type="button"
                    disabled={!canConfirm || busy}
                    loading={busy}
                    onClick={() => setConfirmOpen(true)}
                    data-testid="confirm-reconciliation-btn"
                  >
                    <Icon name="check_circle" size={18} data-slot="icon" />
                    تایید نهایی، ایجاد رسید انبار و درج در کاردکس
                  </Button>
                </div>
              </div>
              {!readOnly && !canConfirm ? (
                <p className="mt-3 text-body-sm text-status-warning-fg">
                  برای تایید نهایی، تمام اقلام جدید باید در کاتالوگ ثبت یا حذف شوند و ردیف‌های دارای مغایرت قیمت به تایید فنی برسند.
                </p>
              ) : null}
            </Card>
          </>
        ) : null}
      </div>

      {/* History Drawer */}
      <ReconciliationHistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        items={historyItems}
        loading={historyLoading}
        activeId={active?.id}
        onRefresh={() => void refreshHistory()}
        onSelect={(id) =>
          router.push(`/purchase-invoice-reconciliation?reconcileId=${id}`)
        }
      />

      {/* Row Edit / Manual Drug Link Drawer */}
      <ReconcileRowEditDrawer
        open={Boolean(editingRow)}
        onOpenChange={(open) => {
          if (!open) setEditingRow(null)
        }}
        row={editingRow}
        saving={busy}
        onSave={handleSaveRowEdit}
      />

      {/* Quick Catalog Creation Drawer (with TTAC Autofill) */}
      <DrugFormDrawer
        open={Boolean(quickDrugRow)}
        onOpenChange={(open) => {
          if (!open) setQuickDrugRow(null)
        }}
        editing={null}
        prefill={
          quickDrugRow
            ? {
                nameFa: quickDrugRow.excelName,
                gtin: quickDrugRow.gtin ?? '',
                genericCode: quickDrugRow.irc ?? '',
              }
            : undefined
        }
        onSaved={handleQuickDrugSaved}
      />

      {/* Final Confirmation Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        tone="info"
        title="تایید نهایی فاکتور و ثبت در کاردکس انبار"
        description={
          active
            ? `فاکتور شماره ${active.invoiceNo} شامل ${formatPersianNumber(active.rows.length)} ردیف به مبلغ خالص ${formatRial(active.summary.netRial)} در وضعیت «${active.quarantineOnIntake ? 'قرنطینه ورودی' : 'موجودی فعال'}» ثبت و رسید انبار صادر می‌شود.`
            : undefined
        }
        confirmLabel="تایید و ثبت نهایی"
        cancelLabel="بازگشت"
        loading={busy}
        onConfirm={() => void handleConfirmFinal()}
      />
    </AppShell>
  )
}
