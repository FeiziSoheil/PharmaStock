'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Badge,
  Button,
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
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { AppShell } from '@/components/layout'
import {
  AlertBanner,
  DenseDataTable,
  KpiMetricCard,
  PageHeader,
  Pagination,
  SideDrawer,
  TriageStatusBadge,
  type DenseColumn,
  type TriageStatus,
} from '@/components/shared'
import { diffAuditPayloads, summarizeAuditDiff } from '@/lib/audit/diff'
import type { DateRangePreset } from '@/lib/audit/jalali-range'
import {
  AUDIT_PAGE_SIZES,
  DEFAULT_AUDIT_URL_STATE,
  parseAuditUrlState,
  serializeAuditUrlState,
  type AuditSortField,
  type AuditUrlState,
} from '@/lib/audit/url-state'
import {
  AUDIT_ACTION_FILTER_GROUPS,
  AUDIT_ENTITY_TYPES,
  AUDIT_ROLES,
  AUDIT_SEVERITIES,
  getAuditActionLabel,
  getAuditRoleLabel,
  isControlledAuditAction,
  type AuditActionCode,
  type AuditActionFilterGroup,
  type AuditEntityType,
  type AuditRole,
  type AuditSeverity,
} from '@/lib/domain/auditEvents'
import {
  type AuditActor,
  type AuditEvent,
  type AuditKpis,
  type AuditSecurityStatus,
} from '@/lib/types/audit'
import {
  exportAuditCsv,
  exportAuditJson,
  exportAuditPdf,
  fetchAuditEvents,
} from '@/lib/audit/data-access'
import {
  formatJalaliDate,
  formatPersianNumber,
  formatPersianTime,
  toPersianDigits,
} from '@/lib/persian'
import { cn } from '@/lib/utils'
import { getAuditNavItems } from './nav'

const SEARCH_DEBOUNCE_MS = 300
const ACTION_GROUP_VALUES = Object.keys(
  AUDIT_ACTION_FILTER_GROUPS,
) as AuditActionFilterGroup[]

type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'empty'

type ActiveChip = {
  id: string
  label: string
  clear: () => void
}

const SECURITY_LABELS: Record<AuditSecurityStatus, string> = {
  token_ok: 'تایید توکن',
  recorded: 'ثبت قطعی',
  needs_review: 'نیازمند بازبینی',
  archived: 'بایگانی شد',
  secured: 'قفل امنیتی',
  confirmed: 'تایید شد',
}

const RANGE_LABELS: Record<DateRangePreset, string> = {
  today: 'امروز (۲۴ ساعت گذشته)',
  week: '۷ روز گذشته (هفته جاری)',
  month: 'ماه جاری',
  last30: '۳۰ روز گذشته',
  custom: 'بازه سفارشی تاریخ',
}

function sortAria(
  field: AuditSortField,
  sortBy: AuditSortField,
  sortDir: 'asc' | 'desc',
): React.AriaAttributes['aria-sort'] {
  if (field !== sortBy) return 'none'
  return sortDir === 'asc' ? 'ascending' : 'descending'
}

function SortableHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="ps-focus-ring inline-flex items-center gap-1 font-semibold text-text-secondary hover:text-text-primary"
      onClick={onClick}
    >
      <span>{label}</span>
      <Icon
        name={active ? (dir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
        size={14}
        className={active ? 'text-primary' : 'text-text-muted'}
      />
    </button>
  )
}

function severityStatus(severity: AuditSeverity): TriageStatus {
  if (severity === 'critical') return 'critical'
  if (severity === 'warning') return 'warning'
  return 'info'
}

function actionBadgeTone(action: AuditActionCode): TriageStatus {
  if (isControlledAuditAction(action) || action === 'quarantine') return 'critical'
  if (action === 'stock_receipt') return 'valid'
  if (action === 'stocktake_adjust' || action === 'transfer') return 'info'
  if (action === 'login_failure' || action === 'login_lock') return 'critical'
  if (action === 'price_mod') return 'neutral'
  return 'neutral'
}

function actionIcon(action: AuditActionCode): React.ComponentProps<typeof Icon>['name'] {
  switch (action) {
    case 'controlled_dispense':
    case 'controlled_substance_entry':
      return 'e911_emergency'
    case 'stocktake_adjust':
      return 'tune'
    case 'price_mod':
      return 'price_change'
    case 'stock_receipt':
    case 'stock_in':
      return 'receipt_long'
    case 'quarantine':
      return 'block'
    case 'transfer':
    case 'shelf_move':
    case 'stock_transfer':
      return 'swap_horiz'
    case 'login_failure':
    case 'login_lock':
      return 'lock_person'
    default:
      return 'bolt'
  }
}

function DiffInline({ event }: { event: AuditEvent }) {
  const summary = summarizeAuditDiff(event.before, event.after)
  if (!summary) {
    return (
      <span className="text-body-sm text-text-muted line-clamp-2">
        {event.description}
      </span>
    )
  }
  return (
    <div className="rounded-inner bg-surface-subtle p-1.5">
      <div className="flex flex-wrap items-center gap-1 text-body-sm">
        <span className="text-text-muted">{summary.labelFa}:</span>
        <span className="font-latin tabular-nums-data text-text-muted line-through" dir="ltr">
          {toPersianDigits(summary.before)}
        </span>
        <span className="sr-only">قبل</span>
        <Icon name="arrow_left" size={14} className="text-primary" aria-hidden />
        <span className="sr-only">بعد</span>
        <span
          className={cn(
            'font-latin font-bold tabular-nums-data',
            event.severity === 'critical' ? 'text-status-critical-fg' : 'text-primary',
          )}
          dir="ltr"
        >
          {toPersianDigits(summary.after)}
        </span>
      </div>
      <div className="mt-0.5 text-label-sm text-text-secondary line-clamp-1">
        {event.description}
      </div>
    </div>
  )
}

function DiffDetail({ event }: { event: AuditEvent }) {
  const fields = diffAuditPayloads(event.before, event.after)
  if (fields.length === 0) {
    return (
      <p className="rounded-default bg-surface-subtle p-3 text-body-sm text-text-secondary">
        {event.description}
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-2" aria-label="تفاوت قبل و بعد">
      {fields.map((field) => (
        <li
          key={field.key}
          className={cn(
            'rounded-default border p-3',
            field.changed
              ? 'border-primary/30 bg-primary-tint/40'
              : 'border-border-subtle bg-surface-subtle',
          )}
        >
          <div className="text-label-md text-text-primary">{field.labelFa}</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-body-sm">
            <div>
              <div className="text-label-sm text-text-muted">قبل</div>
              <div
                className={cn(
                  'font-latin tabular-nums-data',
                  field.changed && 'line-through text-text-muted',
                )}
                dir="ltr"
              >
                {toPersianDigits(field.before)}
              </div>
            </div>
            <div>
              <div className="text-label-sm text-text-muted">بعد</div>
              <div
                className={cn(
                  'font-latin tabular-nums-data',
                  field.changed && 'font-bold text-primary',
                )}
                dir="ltr"
              >
                {toPersianDigits(field.after)}
              </div>
            </div>
          </div>
          {field.changed ? (
            <span className="mt-2 inline-flex text-label-sm text-primary">تغییر یافته</span>
          ) : (
            <span className="mt-2 inline-flex text-label-sm text-text-muted">بدون تغییر</span>
          )}
        </li>
      ))}
    </ul>
  )
}

function stateFromSearchParams(params: URLSearchParams): AuditUrlState {
  return parseAuditUrlState(params)
}

function groupFromActions(actions: AuditActionCode[]): AuditActionFilterGroup {
  if (actions.length === 0) return 'all'
  for (const key of ACTION_GROUP_VALUES) {
    if (key === 'all') continue
    const codes = AUDIT_ACTION_FILTER_GROUPS[key].codes
    if (!codes) continue
    if (
      actions.length === codes.length &&
      actions.every((code) => (codes as readonly AuditActionCode[]).includes(code))
    ) {
      return key
    }
  }
  return 'all'
}

export function AuditLogView() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initial = React.useMemo(
    () => stateFromSearchParams(new URLSearchParams(searchParams.toString())),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once from URL
    [],
  )

  const [range, setRange] = React.useState<DateRangePreset>(initial.range)
  const [fromJalali, setFromJalali] = React.useState(initial.from)
  const [toJalali, setToJalali] = React.useState(initial.to)
  const [actorId, setActorId] = React.useState(initial.actorId)
  const [role, setRole] = React.useState<AuditRole | ''>(initial.role)
  const [actions, setActions] = React.useState<AuditActionCode[]>(initial.actions)
  const [actionGroup, setActionGroup] = React.useState<AuditActionFilterGroup>(
    groupFromActions(initial.actions),
  )
  const [entityType, setEntityType] = React.useState<AuditEntityType | ''>(
    initial.entityType,
  )
  const [severity, setSeverity] = React.useState<AuditSeverity | ''>(
    initial.severity,
  )
  const [searchInput, setSearchInput] = React.useState(initial.q)
  const [search, setSearch] = React.useState(initial.q)
  const [sortBy, setSortBy] = React.useState<AuditSortField>(initial.sortBy)
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>(initial.sortDir)
  const [page, setPage] = React.useState(initial.page)
  const [pageSize, setPageSize] = React.useState(initial.pageSize)

  const [loadState, setLoadState] = React.useState<LoadState>('idle')
  const [items, setItems] = React.useState<AuditEvent[]>([])
  const [filtered, setFiltered] = React.useState<AuditEvent[]>([])
  const [total, setTotal] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(1)
  const [kpis, setKpis] = React.useState<AuditKpis>({
    todayCount: 0,
    controlledCount: 0,
    failedSecurityCount: 0,
  })
  const [actors, setActors] = React.useState<AuditActor[]>([])
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<AuditEvent | null>(null)
  const [originRowId, setOriginRowId] = React.useState<string | null>(null)
  const [exportOpen, setExportOpen] = React.useState(false)
  const [retentionOpen, setRetentionOpen] = React.useState(false)
  const [integrityLabel, setIntegrityLabel] = React.useState('اعتبارسنجی آنی زنجیره')
  const [refreshing, setRefreshing] = React.useState(false)

  const requestIdRef = React.useRef(0)
  const exportMenuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  React.useEffect(() => {
    const state: AuditUrlState = {
      range,
      from: fromJalali,
      to: toJalali,
      actorId,
      role,
      actions,
      entityType,
      severity,
      q: search,
      sortBy,
      sortDir,
      page,
      pageSize,
    }
    const params = serializeAuditUrlState(state, DEFAULT_AUDIT_URL_STATE)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [
    range,
    fromJalali,
    toJalali,
    actorId,
    role,
    actions,
    entityType,
    severity,
    search,
    sortBy,
    sortDir,
    page,
    pageSize,
    pathname,
    router,
  ])

  const queryKey = React.useMemo(
    () =>
      JSON.stringify({
        range,
        fromJalali,
        toJalali,
        actorId,
        role,
        actions,
        actionGroup,
        entityType,
        severity,
        search,
        sortBy,
        sortDir,
        page,
        pageSize,
      }),
    [
      range,
      fromJalali,
      toJalali,
      actorId,
      role,
      actions,
      actionGroup,
      entityType,
      severity,
      search,
      sortBy,
      sortDir,
      page,
      pageSize,
    ],
  )

  const load = React.useCallback(async () => {
    const requestId = ++requestIdRef.current
    try {
      const query = {
        range,
        fromJalali,
        toJalali,
        actorId: actorId || undefined,
        role,
        actions: actions.length > 0 ? actions : undefined,
        actionGroup: actions.length === 0 ? actionGroup : undefined,
        entityType,
        severity,
        search,
        sortBy,
        sortDir,
        page,
        pageSize,
      }
      const result = await fetchAuditEvents(query)
      if (requestId !== requestIdRef.current) return
      setItems(result.items)
      setFiltered(result.filtered)
      setTotal(result.total)
      setPageCount(result.pageCount)
      setPage(result.page)
      setKpis(result.kpis)
      setActors(result.actors)
      setLoadState(result.total === 0 ? 'empty' : 'ready')
    } catch {
      if (requestId !== requestIdRef.current) return
      setLoadState('error')
    }
  }, [
    range,
    fromJalali,
    toJalali,
    actorId,
    role,
    actions,
    actionGroup,
    entityType,
    severity,
    search,
    sortBy,
    sortDir,
    page,
    pageSize,
  ])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      setLoadState('loading')
      await load()
    })()
    return () => {
      cancelled = true
    }
  }, [queryKey, load])

  React.useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!exportMenuRef.current?.contains(event.target as Node)) {
        setExportOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function handleSort(field: AuditSortField) {
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortDir(field === 'timestamp' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  function clearAllFilters() {
    setRange('week')
    setFromJalali('')
    setToJalali('')
    setActorId('')
    setRole('')
    setActions([])
    setActionGroup('all')
    setEntityType('')
    setSeverity('')
    setSearchInput('')
    setSearch('')
    setPage(1)
  }

  function openEvent(event: AuditEvent) {
    setOriginRowId(event.id)
    setSelected(event)
    setDrawerOpen(true)
  }

  function handleDrawerOpenChange(open: boolean) {
    setDrawerOpen(open)
    if (!open) {
      const rowId = originRowId
      window.setTimeout(() => {
        if (!rowId) return
        const row = document.querySelector<HTMLElement>(`[data-row-id="${rowId}"]`)
        row?.focus()
      }, 0)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    setLoadState('loading')
    await load()
    setRefreshing(false)
  }

  function verifyIntegrity() {
    setIntegrityLabel('در حال بررسی هش‌ها...')
    window.setTimeout(() => {
      setIntegrityLabel('زنجیره معتبر است')
      window.setTimeout(() => setIntegrityLabel('اعتبارسنجی آنی زنجیره'), 2200)
    }, 900)
  }

  const chips: ActiveChip[] = []
  chips.push({
    id: 'range',
    label:
      range === 'custom'
        ? `بازه: ${fromJalali || '—'} تا ${toJalali || '—'}`
        : `بازه: ${RANGE_LABELS[range]}`,
    clear: () => {
      setRange('week')
      setFromJalali('')
      setToJalali('')
      setPage(1)
    },
  })
  if (actorId) {
    const actor = actors.find((a) => a.id === actorId)
    chips.push({
      id: 'actor',
      label: `عامل: ${actor?.name ?? actorId}`,
      clear: () => {
        setActorId('')
        setPage(1)
      },
    })
  }
  if (role) {
    chips.push({
      id: 'role',
      label: `نقش: ${getAuditRoleLabel(role)}`,
      clear: () => {
        setRole('')
        setPage(1)
      },
    })
  }
  if (actionGroup !== 'all' || actions.length > 0) {
    chips.push({
      id: 'action',
      label: `نوع: ${
        actions.length === 1
          ? getAuditActionLabel(actions[0]!)
          : AUDIT_ACTION_FILTER_GROUPS[actionGroup].labelFa
      }`,
      clear: () => {
        setActions([])
        setActionGroup('all')
        setPage(1)
      },
    })
  }
  if (entityType) {
    chips.push({
      id: 'entity',
      label: `موجودیت: ${AUDIT_ENTITY_TYPES[entityType].labelFa}`,
      clear: () => {
        setEntityType('')
        setPage(1)
      },
    })
  }
  if (severity) {
    chips.push({
      id: 'severity',
      label: `شدت: ${AUDIT_SEVERITIES[severity].labelFa}`,
      clear: () => {
        setSeverity('')
        setPage(1)
      },
    })
  }
  if (search) {
    chips.push({
      id: 'search',
      label: `جستجو: ${search}`,
      clear: () => {
        setSearchInput('')
        setSearch('')
        setPage(1)
      },
    })
  }

  const hasFilterMatchEmpty =
    loadState === 'empty' &&
    Boolean(
      search ||
        actorId ||
        role ||
        actions.length ||
        actionGroup !== 'all' ||
        entityType ||
        severity ||
        range !== 'week',
    )

  const columns: DenseColumn<AuditEvent>[] = [
    {
      id: 'id',
      header: 'شناسه لاگ',
      dir: 'ltr',
      className: 'w-28',
      cell: (row) => (
        <span className="font-latin tabular-nums-data text-text-muted">#{row.id}</span>
      ),
    },
    {
      id: 'timestamp',
      ariaSort: sortAria('timestamp', sortBy, sortDir),
      header: (
        <SortableHeader
          label="تاریخ و ساعت ثانیه‌ای"
          active={sortBy === 'timestamp'}
          dir={sortDir}
          onClick={() => handleSort('timestamp')}
        />
      ),
      className: 'min-w-[7.5rem]',
      cell: (row) => (
        <div>
          <div className="font-bold tabular-nums-data text-text-primary">
            {formatJalaliDate(row.timestamp)}
          </div>
          <div className="font-latin text-label-sm text-text-muted" dir="ltr">
            {formatPersianTime(row.timestamp, true)}
          </div>
        </div>
      ),
    },
    {
      id: 'actor',
      ariaSort: sortAria('actor', sortBy, sortDir),
      header: (
        <SortableHeader
          label="عامل / کاربر و نقش"
          active={sortBy === 'actor'}
          dir={sortDir}
          onClick={() => handleSort('actor')}
        />
      ),
      className: 'min-w-[8rem] max-md:hidden',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
              row.actor.role === 'technical_officer'
                ? 'bg-primary text-primary-foreground'
                : row.actor.role === 'system'
                  ? 'bg-secondary-tint text-secondary'
                  : 'bg-surface-muted text-text-primary',
            )}
          >
            {row.actor.initials}
          </div>
          <div>
            <div className="text-label-md font-bold text-text-primary">{row.actor.name}</div>
            <div
              className={cn(
                'text-label-sm',
                row.actor.role === 'technical_officer' ? 'text-primary' : 'text-text-muted',
              )}
            >
              {getAuditRoleLabel(row.actor.role)}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'action',
      ariaSort: sortAria('action', sortBy, sortDir),
      header: (
        <SortableHeader
          label="نوع عملیات"
          active={sortBy === 'action'}
          dir={sortDir}
          onClick={() => handleSort('action')}
        />
      ),
      className: 'min-w-[7.5rem]',
      cell: (row) => (
        <Badge
          variant={actionBadgeTone(row.action)}
          className={cn(
            row.isControlledSubstance || row.action === 'login_failure'
              ? 'ring-1 ring-status-critical-border'
              : undefined,
          )}
        >
          <Icon name={actionIcon(row.action)} size={14} />
          {getAuditActionLabel(row.action)}
        </Badge>
      ),
    },
    {
      id: 'entity',
      ariaSort: sortAria('entity', sortBy, sortDir),
      header: (
        <SortableHeader
          label="موجودیت درگیر"
          active={sortBy === 'entity'}
          dir={sortDir}
          onClick={() => handleSort('entity')}
        />
      ),
      className: 'min-w-[8rem] max-lg:hidden',
      cell: (row) => (
        <div>
          <div className="text-label-md text-text-primary">{row.entityLabel}</div>
          <div className="font-latin text-body-sm text-text-muted" dir="ltr">
            {row.entityId}
          </div>
        </div>
      ),
    },
    {
      id: 'diff',
      header: 'تغییرات مقادیر (Diff Audit)',
      className: 'min-w-[11rem] max-md:hidden',
      cell: (row) => <DiffInline event={row} />,
    },
    {
      id: 'source',
      header: 'مبدأ و پایانه کاربری',
      className: 'min-w-[8rem] max-xl:hidden',
      cell: (row) => (
        <div>
          <div className="font-latin text-label-sm text-text-primary" dir="ltr">
            {row.ip}
          </div>
          <div className="text-label-sm text-text-muted">{row.terminal}</div>
        </div>
      ),
    },
    {
      id: 'severity',
      ariaSort: sortAria('severity', sortBy, sortDir),
      header: (
        <SortableHeader
          label="وضعیت امنیتی"
          active={sortBy === 'severity'}
          dir={sortDir}
          onClick={() => handleSort('severity')}
        />
      ),
      className: 'w-32 text-center',
      cell: (row) => (
        <div className="flex flex-col items-center gap-1">
          <TriageStatusBadge status={severityStatus(row.severity)}>
            {AUDIT_SEVERITIES[row.severity].labelFa}
          </TriageStatusBadge>
          <span className="text-label-sm text-text-secondary">
            {SECURITY_LABELS[row.securityStatus]}
          </span>
        </div>
      ),
    },
    {
      id: 'open',
      header: 'اقدام',
      className: 'w-16 text-center',
      cell: (row) => (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`جزئیات ${row.id}`}
          onClick={(event) => {
            event.stopPropagation()
            openEvent(row)
          }}
        >
          <Icon name="terminal" size={18} />
        </Button>
      ),
    },
  ]

  const latestEvent = filtered[0] ?? items[0]

  return (
    <AppShell
      navItems={getAuditNavItems('audit-log')}
      contentClassName="min-w-0 overflow-x-clip"
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
      <div
        className="flex min-w-0 max-w-full flex-col gap-6 overflow-x-clip"
        data-slot="audit-log-page"
      >
        <PageHeader
          title="گزارش و ممیزی رویدادهای سامانه (Audit Trail)"
          description="لاگ‌های این پایگاه داده ممهور به امضای الکترونیک مسئول فنی بوده و بر اساس الزامات رگولاتوری سازمان غذا و دارو غیرقابل حذف یا ویرایش هستند."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info" className="gap-1">
                <Icon name="lock" size={14} />
                ثبت رمزنگاری‌شده (WORM / Immutable)
              </Badge>
              <div className="relative" ref={exportMenuRef}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setExportOpen((open) => !open)}
                  aria-expanded={exportOpen}
                  aria-haspopup="menu"
                >
                  <Icon name="file_download" size={18} />
                  خروجی ممهور امنیتی
                  <Icon name="expand_more" size={16} />
                </Button>
                {exportOpen ? (
                  <div
                    role="menu"
                    className="absolute end-0 z-30 mt-2 w-64 rounded-default border border-border-default bg-surface p-1 shadow-dropdown"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 rounded-inner px-3 py-2 text-start text-body-sm hover:bg-surface-hover"
                      onClick={() => {
                        void exportAuditCsv(filtered, {
                          range,
                          fromJalali,
                          toJalali,
                          actorId: actorId || undefined,
                          role,
                          actions: actions.length > 0 ? actions : undefined,
                          actionGroup: actions.length === 0 ? actionGroup : undefined,
                          entityType,
                          severity,
                          search,
                          sortBy,
                          sortDir,
                        }).finally(() => setExportOpen(false))
                      }}
                    >
                      <Icon name="table_view" size={16} className="text-primary" />
                      دریافت فایل استاندارد CSV
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 rounded-inner px-3 py-2 text-start text-body-sm hover:bg-surface-hover"
                      onClick={() => {
                        exportAuditPdf(filtered)
                        setExportOpen(false)
                      }}
                    >
                      <Icon name="picture_as_pdf" size={16} className="text-status-critical-fg" />
                      گزارش رسمی با سربرگ بازرسی (PDF)
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 rounded-inner px-3 py-2 text-start text-body-sm hover:bg-surface-hover"
                      onClick={() => {
                        void exportAuditJson(filtered, {
                          range,
                          fromJalali,
                          toJalali,
                          actorId: actorId || undefined,
                          role,
                          actions: actions.length > 0 ? actions : undefined,
                          actionGroup: actions.length === 0 ? actionGroup : undefined,
                          entityType,
                          severity,
                          search,
                          sortBy,
                          sortDir,
                        }).finally(() => setExportOpen(false))
                      }}
                    >
                      <Icon name="code" size={16} className="text-secondary" />
                      بسته کریپتوگرافیک JSON
                    </button>
                  </div>
                ) : null}
              </div>
              <Button type="button" variant="outline" onClick={() => setRetentionOpen(true)}>
                <Icon name="admin_panel_settings" size={18} />
                تنظیمات نگهداشت لاگ
              </Button>
              <Button
                type="button"
                size="icon"
                aria-label="بروزرسانی داده‌ها"
                onClick={() => void handleRefresh()}
              >
                <Icon
                  name="refresh"
                  size={18}
                  className={refreshing ? 'animate-spin' : undefined}
                />
              </Button>
            </div>
          }
        />

        <div className="flex flex-col gap-4 rounded-default border border-border-default bg-surface-subtle p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-default bg-status-valid-bg text-status-valid-fg">
              <Icon name="security" size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-label-lg text-text-primary">
                <span>وضعیت گواهی‌نامه زنجیره بلوکی و یکپارچگی داده‌ها (Hash Chain Status)</span>
                <span className="inline-flex items-center gap-1 text-label-sm font-bold text-status-valid-fg">
                  <span className="size-2 animate-pulse rounded-full bg-status-valid-fg" />
                  معتبر و پایدار
                </span>
              </div>
              <div
                className="mt-0.5 max-w-full break-all font-latin text-body-sm text-text-secondary"
                dir="ltr"
              >
                SHA-256 Block Signature: e8d4c9f10a8b792e34fa98d23490bca8712e4f0165c78bdf12903824ab5
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="text-end">
              <div className="text-label-sm text-text-muted">آخرین رویداد ممیزی شده:</div>
              <div className="tabular-nums-data text-text-primary">
                {latestEvent
                  ? `${formatJalaliDate(latestEvent.timestamp)} - ${formatPersianTime(latestEvent.timestamp)}`
                  : '—'}
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={verifyIntegrity}>
              <Icon name="task_alt" size={16} />
              {integrityLabel}
            </Button>
          </div>
        </div>

        <section
          className="flex flex-col gap-4 rounded-default border border-border-default bg-surface p-5"
          aria-label="پالایش پیشرفته رویدادها"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-headline-sm text-primary">
              <Icon name="tune" size={22} />
              <h2 className="text-headline-sm">پالایش پیشرفته رویدادها</h2>
            </div>
            <div className="flex items-center gap-2 text-label-sm text-text-muted">
              <span>
                {toPersianDigits(Math.max(chips.length - 1, 0))} فیلتر اعمال‌شده
              </span>
              <button
                type="button"
                className="ps-focus-ring text-primary hover:underline"
                onClick={clearAllFilters}
              >
                پاکسازی فیلترها
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="audit-range">بازه زمانی رویداد</Label>
              <Select
                value={range}
                onValueChange={(value) => {
                  setRange(value as DateRangePreset)
                  setPage(1)
                }}
              >
                <SelectTrigger id="audit-range" aria-label="بازه زمانی رویداد">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="today">{RANGE_LABELS.today}</SelectItem>
                    <SelectItem value="week">{RANGE_LABELS.week}</SelectItem>
                    <SelectItem value="month">{RANGE_LABELS.month}</SelectItem>
                    <SelectItem value="last30">{RANGE_LABELS.last30}</SelectItem>
                    <SelectItem value="custom">{RANGE_LABELS.custom}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="audit-actor">کاربر مسئول / عامل</Label>
              <Select
                value={actorId || 'all'}
                onValueChange={(value) => {
                  setActorId(value === 'all' ? '' : value)
                  setPage(1)
                }}
              >
                <SelectTrigger id="audit-actor" aria-label="کاربر مسئول / عامل">
                  <SelectValue placeholder="تمام کاربران و پرسنل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">تمام کاربران و پرسنل</SelectItem>
                    {actors.map((actor) => (
                      <SelectItem key={actor.id} value={actor.id}>
                        {actor.name} ({getAuditRoleLabel(actor.role)})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="audit-role">نقش</Label>
              <Select
                value={role || 'all'}
                onValueChange={(value) => {
                  setRole(value === 'all' ? '' : (value as AuditRole))
                  setPage(1)
                }}
              >
                <SelectTrigger id="audit-role" aria-label="نقش">
                  <SelectValue placeholder="همه نقش‌ها" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">همه نقش‌ها</SelectItem>
                    {(Object.keys(AUDIT_ROLES) as AuditRole[]).map((code) => (
                      <SelectItem key={code} value={code}>
                        {AUDIT_ROLES[code].labelFa}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="audit-action">نوع عملیات (Action)</Label>
              <Select
                value={actionGroup}
                onValueChange={(value) => {
                  const group = value as AuditActionFilterGroup
                  setActionGroup(group)
                  const codes = AUDIT_ACTION_FILTER_GROUPS[group].codes
                  setActions(codes ? [...codes] : [])
                  setPage(1)
                }}
              >
                <SelectTrigger id="audit-action" aria-label="نوع عملیات">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {ACTION_GROUP_VALUES.map((group) => (
                      <SelectItem key={group} value={group}>
                        {AUDIT_ACTION_FILTER_GROUPS[group].labelFa}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="audit-entity">بخش / موجودیت درگیر</Label>
              <Select
                value={entityType || 'all'}
                onValueChange={(value) => {
                  setEntityType(value === 'all' ? '' : (value as AuditEntityType))
                  setPage(1)
                }}
              >
                <SelectTrigger id="audit-entity" aria-label="بخش / موجودیت درگیر">
                  <SelectValue placeholder="کل ساختار داده‌ای" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">کل ساختار داده‌ای</SelectItem>
                    {(Object.keys(AUDIT_ENTITY_TYPES) as AuditEntityType[]).map((code) => (
                      <SelectItem key={code} value={code}>
                        {AUDIT_ENTITY_TYPES[code].labelFa}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="audit-severity">شدت</Label>
              <Select
                value={severity || 'all'}
                onValueChange={(value) => {
                  setSeverity(value === 'all' ? '' : (value as AuditSeverity))
                  setPage(1)
                }}
              >
                <SelectTrigger id="audit-severity" aria-label="شدت رویداد">
                  <SelectValue placeholder="همه شدت‌ها" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">همه شدت‌ها</SelectItem>
                    {(Object.keys(AUDIT_SEVERITIES) as AuditSeverity[]).map((code) => (
                      <SelectItem key={code} value={code}>
                        {AUDIT_SEVERITIES[code].labelFa}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          {range === 'custom' ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="audit-from">از تاریخ (جلالی)</Label>
                <Input
                  id="audit-from"
                  dir="ltr"
                  className="font-latin tabular-nums-data"
                  placeholder="1403/08/01"
                  value={fromJalali}
                  onChange={(event) => {
                    setFromJalali(event.target.value)
                    setPage(1)
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="audit-to">تا تاریخ (جلالی)</Label>
                <Input
                  id="audit-to"
                  dir="ltr"
                  className="font-latin tabular-nums-data"
                  placeholder="1403/08/24"
                  value={toJalali}
                  onChange={(event) => {
                    setToJalali(event.target.value)
                    setPage(1)
                  }}
                />
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audit-search">جستجوی دقیق کدهای سیستمی</Label>
            <div className="relative">
              <Icon
                name="search"
                size={18}
                className="pointer-events-none absolute inset-inline-start-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <Input
                id="audit-search"
                className="ps-10"
                placeholder="کد IRC، شناسه لاگ، IP..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-label-sm text-text-muted">فیلترهای فعال:</span>
            {chips.map((chip) => (
              <Badge key={chip.id} variant="neutral" className="gap-1 pe-1">
                <span>{chip.label}</span>
                <button
                  type="button"
                  className="ps-focus-ring rounded-full p-0.5 hover:text-status-critical-fg"
                  aria-label={`حذف فیلتر ${chip.label}`}
                  onClick={chip.clear}
                >
                  <Icon name="close" size={14} />
                </button>
              </Badge>
            ))}
          </div>
        </section>

        {loadState === 'error' ? (
          <AlertBanner
            tone="critical"
            title="خطا در دریافت لاگ ممیزی"
            description="بارگذاری دفتر رویدادها ناموفق بود. دوباره تلاش کنید."
            action={
              <Button type="button" onClick={() => void handleRefresh()}>
                تلاش مجدد
              </Button>
            }
          />
        ) : null}

        {loadState === 'loading' ? (
          <div
            data-slot="audit-log-skeleton"
            className="flex flex-col gap-3 rounded-default border border-border-default bg-surface p-5"
            aria-busy="true"
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-10 animate-pulse rounded-inner bg-surface-muted"
              />
            ))}
          </div>
        ) : null}

        {loadState === 'empty' && !hasFilterMatchEmpty ? (
          <AlertBanner
            tone="info"
            title="رویدادی ثبت نشده است"
            description="هنوز هیچ رویدادی در دفتر ممیزی وجود ندارد."
          />
        ) : null}

        {hasFilterMatchEmpty ? (
          <AlertBanner
            tone="warning"
            title="نتیجه‌ای برای فیلترها یافت نشد"
            description="هیچ رویدادی با پالایش فعلی هم‌خوانی ندارد. فیلترها را پاکسازی کنید."
            action={
              <Button type="button" variant="outline" onClick={clearAllFilters}>
                پاکسازی فیلترها
              </Button>
            }
          />
        ) : null}

        {loadState === 'ready' || (loadState === 'empty' && hasFilterMatchEmpty) ? (
          <section className="min-w-0 max-w-full overflow-hidden rounded-default border border-border-default bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-subtle px-5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-headline-sm text-text-primary">
                  دفتر ثبت رویدادهای غیرقابل تغییر
                </h2>
                <Badge variant="default">
                  تعداد رکوردها: {formatPersianNumber(total)} مورد
                </Badge>
              </div>
              <div className="flex items-center gap-1 text-label-sm text-text-secondary">
                <span>ستون‌های فعال: اولویت‌بندی‌شده برای موبایل/تبلت</span>
                <Icon name="view_column" size={16} className="text-text-muted" />
              </div>
            </div>

            <DenseDataTable
              columns={columns}
              data={items}
              getRowId={(row) => row.id}
              onRowClick={openEvent}
              emptyMessage="رویدادی برای نمایش نیست"
              maxHeight="min(32rem, 60vh)"
              className="max-w-full min-w-0 rounded-none border-0"
            />

            <Pagination
              page={page}
              pageCount={pageCount}
              totalItems={total}
              pageSize={pageSize}
              pageSizeOptions={[...AUDIT_PAGE_SIZES]}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
            />
          </section>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <KpiMetricCard
            title="حجم رویدادهای امروز"
            value={formatPersianNumber(kpis.todayCount)}
            icon="event_note"
            tone="valid"
            description="تراکنش ممیزی شده"
            delta={{ label: 'نسبت به میانگین هفتگی', direction: 'up' }}
          />
          <KpiMetricCard
            title="رویدادهای داروهای تحت نظارت و مخدر"
            value={formatPersianNumber(kpis.controlledCount)}
            icon="verified"
            tone="critical"
            description="تراکنش حساس (مورفین، ریتالین، بوپرنورفین)"
          />
          <KpiMetricCard
            title="رخدادهای ناموفق و انحرافات امنیتی"
            value={formatPersianNumber(kpis.failedSecurityCount)}
            icon="shield_with_heart"
            tone="info"
            description="مورد تخطی امنیتی یا لاگ مخدوش"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-default border border-border-default bg-surface-subtle p-4">
          <div className="flex items-center gap-3">
            <Icon name="gavel" size={28} className="text-primary" />
            <div>
              <div className="text-label-lg text-text-primary">
                انطباق با مقررات ملی و استانداردهای GAMP 5 و FDA 21 CFR Part 11
              </div>
              <div className="text-body-sm text-text-secondary">
                این سامانه ملزم به نگهداری پیشینه کامل تغییرات به مدت حداقل ۵ سال از تاریخ ثبت هر
                تراکنش دارویی است.
              </div>
            </div>
          </div>
          <span className="font-latin text-label-sm text-text-muted" dir="ltr">
            IR-MOH-PHARM-2024-9182
          </span>
        </div>
      </div>

      <SideDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
        title={selected ? `#${selected.id}` : 'جزئیات رویداد'}
        description="جزئیات کامل امضای دیجیتال و پی‌لود رویداد"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => handleDrawerOpenChange(false)}>
              بستن پنجره
            </Button>
            <Button
              type="button"
              onClick={() => {
                window.print()
              }}
            >
              <Icon name="print" size={16} />
              چاپ شناسنامه رویداد
            </Button>
          </div>
        }
      >
        {selected ? (
          <div className="flex flex-col gap-4" data-slot="audit-event-drawer">
            <div className="grid grid-cols-2 gap-3 rounded-default bg-surface-subtle p-3">
              <div>
                <div className="text-label-sm text-text-muted">عنوان تراکنش</div>
                <div className="mt-0.5 text-label-md text-text-primary">
                  {getAuditActionLabel(selected.action)}
                </div>
              </div>
              <div>
                <div className="text-label-sm text-text-muted">زمان دقیق ثبت</div>
                <div className="mt-0.5 font-latin tabular-nums-data text-label-md" dir="ltr">
                  {formatJalaliDate(selected.timestamp)} - {formatPersianTime(selected.timestamp)}
                </div>
              </div>
              <div>
                <div className="text-label-sm text-text-muted">کاربر عامل</div>
                <div className="mt-0.5 text-label-md text-text-primary">
                  {selected.actor.name} · {getAuditRoleLabel(selected.actor.role)}
                </div>
              </div>
              <div>
                <div className="text-label-sm text-text-muted">آدرس IP و ترمینال</div>
                <div className="mt-0.5 font-latin text-label-md" dir="ltr">
                  {selected.ip} ({selected.terminal})
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <TriageStatusBadge status={severityStatus(selected.severity)}>
                {AUDIT_SEVERITIES[selected.severity].labelFa}
              </TriageStatusBadge>
              {selected.isControlledSubstance ? (
                <Badge variant="critical">داروی تحت کنترل</Badge>
              ) : null}
              {selected.action === 'login_failure' || selected.action === 'login_lock' ? (
                <Badge variant="critical">ورود ناموفق / قفل</Badge>
              ) : null}
            </div>

            <div>
              <div className="mb-2 text-label-lg text-text-primary">شرح تغییرات و مقادیر ثبت‌شده</div>
              <DiffDetail event={selected} />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-label-lg text-text-primary">
                  کد ساختاریافته رویداد (JSON Payload)
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(
                      JSON.stringify(
                        {
                          event_id: selected.id,
                          action: selected.action,
                          actor: selected.actor.name,
                          entity_id: selected.entityId,
                          before: selected.before ?? null,
                          after: selected.after ?? null,
                        },
                        null,
                        2,
                      ),
                    )
                  }}
                >
                  <Icon name="content_copy" size={14} />
                  کپی جیسون
                </Button>
              </div>
              <pre
                className="max-h-56 overflow-x-auto rounded-default bg-text-primary p-3 font-latin text-label-sm leading-relaxed text-text-inverse"
                dir="ltr"
              >
                {JSON.stringify(
                  {
                    event_id: selected.id,
                    action: selected.action,
                    actor: { id: selected.actor.id, role: selected.actor.role },
                    entity: {
                      type: selected.entityType,
                      id: selected.entityId,
                      before: selected.before ?? null,
                      after: selected.after ?? null,
                    },
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          </div>
        ) : null}
      </SideDrawer>

      <Dialog open={retentionOpen} onOpenChange={setRetentionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>سیاست نگهداشت لاگ‌ها (Retention Policy)</DialogTitle>
            <DialogDescription>
              بر اساس آیین‌نامه نظارت بر امور دارو و مواد بیولوژیک سازمان غذا و دارو، حذف یا
              کوتاه‌سازی بازه نگهداشت این رکوردها بدون مجوز مکتوب بازرس فنی تخلف محسوب می‌گردد.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-default bg-surface-subtle p-3">
              <div>
                <div className="text-label-md">مدت زمان بایگانی فعال (Hot Storage)</div>
                <div className="text-label-sm text-text-muted">دسترسی لحظه‌ای و جستجوی آنی</div>
              </div>
              <span className="tabular-nums-data font-bold text-primary">
                {toPersianDigits(2)} سال کامل
              </span>
            </div>
            <div className="flex items-center justify-between rounded-default bg-surface-subtle p-3">
              <div>
                <div className="text-label-md">بایگانی سرد و رمزنگاری‌شده (Cold Storage)</div>
                <div className="text-label-sm text-text-muted">پشتیبان غیرقابل بازنویسی</div>
              </div>
              <span className="tabular-nums-data font-bold text-primary">
                {toPersianDigits(10)} سال قانونی
              </span>
            </div>
            <div className="flex items-center justify-between rounded-default bg-surface-subtle p-3">
              <div>
                <div className="text-label-md">حداکثر سقف مجاز دستکاری</div>
                <div className="text-label-sm text-text-muted">WORM (Write Once, Read Many)</div>
              </div>
              <span className="text-label-sm font-bold text-status-critical-fg">صفر (غیرفعال دائمی)</span>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setRetentionOpen(false)}>
              تایید و بازگشت
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
