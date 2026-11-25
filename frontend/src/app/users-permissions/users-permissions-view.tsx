'use client'

import * as React from 'react'
import { toast } from 'sonner'
import {
  RbacPermissionMatrix,
  type RbacCellMeta,
  type RbacPermission,
  type RbacRole,
} from '@/components/domain'
import { AppShell } from '@/components/layout'
import {
  ActionTooltip,
  AlertBanner,
  DenseDataTable,
  KpiMetricCard,
  PageHeader,
  Pagination,
  TriageStatusBadge,
  type DenseColumn,
} from '@/components/shared'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Icon,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { ApiError } from '@/lib/api/http'
import { getSessionUser } from '@/lib/api/session'
import { getAuditRoleLabel } from '@/lib/domain/auditEvents'
import {
  formatJalaliDate,
  formatPersianNumber,
  formatPersianTime,
} from '@/lib/persian'
import type {
  BranchOption,
  RbacMatrixData,
  UserAccount,
  UsersKpis,
} from '@/lib/types/users'
import {
  fetchRbacMatrix,
  fetchUsers,
  saveRbacMatrix,
  toggleUserAccountStatus,
} from '@/lib/users/data-access'
import { getUsersPermissionsNavItems } from './nav'
import { ResetPasswordDialog } from './reset-password-dialog'
import { UserFormDrawer } from './user-form-drawer'
import { UserPermissionsDrawer } from './user-permissions-drawer'

const SEARCH_DEBOUNCE_MS = 250
const emptySubscribe = () => () => {}

const DEFAULT_KPIS: UsersKpis = {
  totalUsers: 0,
  activeUsers: 0,
  technicalOfficers: 0,
  sensitivePermissions: 2,
  auditCoveragePercent: 100,
}

function cloneMatrix(
  m: Record<string, Record<string, boolean>>,
): Record<string, Record<string, boolean>> {
  const out: Record<string, Record<string, boolean>> = {}
  for (const [permId, cols] of Object.entries(m)) {
    out[permId] = { ...cols }
  }
  return out
}

function matricesEqual(
  a: Record<string, Record<string, boolean>>,
  b: Record<string, Record<string, boolean>>,
): boolean {
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  for (const p of keysA) {
    const rowA = a[p] ?? {}
    const rowB = b[p] ?? {}
    for (const r of Object.keys(rowA)) {
      if (Boolean(rowA[r]) !== Boolean(rowB[r])) return false
    }
  }
  return true
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]
  if (!first) return '؟'
  if (parts.length === 1) return first.slice(0, 2)
  const last = parts[parts.length - 1]
  return `${first[0] ?? ''}${last?.[0] ?? ''}`
}

function roleBadgeClass(role: string): string {
  switch (role) {
    case 'super_admin':
      return 'border-primary-border bg-primary text-primary-foreground'
    case 'technical_officer':
    case 'pharmacist':
      return 'border-primary-border bg-secondary-tint text-primary'
    default:
      return 'border-border-default bg-surface-subtle text-text-primary'
  }
}

export function UsersPermissionsView() {
  const [activeTab, setActiveTab] = React.useState<'matrix' | 'users'>('matrix')

  // Matrix state
  const [matrixData, setMatrixData] = React.useState<RbacMatrixData | null>(null)
  const [draftMatrix, setDraftMatrix] = React.useState<
    Record<string, Record<string, boolean>>
  >({})
  const [matrixLoading, setMatrixLoading] = React.useState(true)
  const [matrixError, setMatrixError] = React.useState<string | null>(null)
  const [savingMatrix, setSavingMatrix] = React.useState(false)

  // Users list state
  const [users, setUsers] = React.useState<UserAccount[]>([])
  const [totalUsers, setTotalUsers] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)
  const [pageCount, setPageCount] = React.useState(1)
  const [kpis, setKpis] = React.useState<UsersKpis>(DEFAULT_KPIS)
  const [branches, setBranches] = React.useState<BranchOption[]>([])
  const [usersLoading, setUsersLoading] = React.useState(true)
  const [usersError, setUsersError] = React.useState<string | null>(null)

  // Filters
  const [searchInput, setSearchInput] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [roleFilter, setRoleFilter] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('')

  // Modals / Drawers
  const [activeDrawerKind, setActiveDrawerKind] = React.useState<
    'user' | 'permissions'
  >('user')
  const [userDrawerOpen, setUserDrawerOpen] = React.useState(false)
  const [userDrawerMode, setUserDrawerMode] = React.useState<'create' | 'edit'>(
    'create',
  )
  const [selectedUser, setSelectedUser] = React.useState<UserAccount | null>(null)
  const [permDrawerOpen, setPermDrawerOpen] = React.useState(false)
  const [resetDialogOpen, setResetDialogOpen] = React.useState(false)
  const [complianceOpen, setComplianceOpen] = React.useState(false)
  const [togglingUserId, setTogglingUserId] = React.useState<string | null>(null)
  const currentUserId = React.useSyncExternalStore(
    emptySubscribe,
    () => getSessionUser()?.id ?? null,
    () => null,
  )

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const refreshMatrix = React.useCallback(() => {
    setMatrixLoading(true)
    setMatrixError(null)
    fetchRbacMatrix()
      .then((res) => {
        setMatrixData(res)
        setDraftMatrix(cloneMatrix(res.matrix))
      })
      .catch((err) => {
        setMatrixError(
          err instanceof ApiError
            ? err.message
            : 'خطا در دریافت ماتریس دسترسی‌ها',
        )
      })
      .finally(() => {
        setMatrixLoading(false)
      })
  }, [])

  const refreshUsers = React.useCallback(() => {
    setUsersLoading(true)
    setUsersError(null)
    fetchUsers({
      search: debouncedSearch,
      role: roleFilter,
      status: statusFilter,
      page,
      pageSize,
      sortBy: 'name',
      sortDir: 'asc',
    })
      .then((res) => {
        setUsers(res.items)
        setTotalUsers(res.total)
        setPageCount(Math.max(1, res.pageCount))
        setKpis(res.kpis)
        setBranches(res.branches)
      })
      .catch((err) => {
        setUsersError(
          err instanceof ApiError
            ? err.message
            : 'خطا در دریافت فهرست کاربران',
        )
      })
      .finally(() => {
        setUsersLoading(false)
      })
  }, [debouncedSearch, roleFilter, statusFilter, page, pageSize])

  React.useEffect(() => {
    let active = true
    fetchRbacMatrix()
      .then((res) => {
        if (!active) return
        setMatrixData(res)
        setDraftMatrix(cloneMatrix(res.matrix))
        setMatrixError(null)
      })
      .catch((err) => {
        if (!active) return
        setMatrixError(
          err instanceof ApiError
            ? err.message
            : 'خطا در دریافت ماتریس دسترسی‌ها',
        )
      })
      .finally(() => {
        if (active) setMatrixLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  React.useEffect(() => {
    let active = true
    fetchUsers({
      search: debouncedSearch,
      role: roleFilter,
      status: statusFilter,
      page,
      pageSize,
      sortBy: 'name',
      sortDir: 'asc',
    })
      .then((res) => {
        if (!active) return
        setUsers(res.items)
        setTotalUsers(res.total)
        setPageCount(Math.max(1, res.pageCount))
        setKpis(res.kpis)
        setBranches(res.branches)
        setUsersError(null)
      })
      .catch((err) => {
        if (!active) return
        setUsersError(
          err instanceof ApiError
            ? err.message
            : 'خطا در دریافت فهرست کاربران',
        )
      })
      .finally(() => {
        if (active) setUsersLoading(false)
      })
    return () => {
      active = false
    }
  }, [debouncedSearch, roleFilter, statusFilter, page, pageSize])

  const matrixDirty = React.useMemo(() => {
    if (!matrixData) return false
    return !matricesEqual(matrixData.matrix, draftMatrix)
  }, [matrixData, draftMatrix])

  const handleMatrixCellChange = (
    permissionId: string,
    roleId: string,
    checked: boolean,
  ) => {
    setDraftMatrix((prev) => ({
      ...prev,
      [permissionId]: {
        ...(prev[permissionId] ?? {}),
        [roleId]: checked,
      },
    }))
  }

  const handleResetMatrix = () => {
    if (!matrixData) return
    setDraftMatrix(cloneMatrix(matrixData.matrix))
  }

  const handleSaveMatrix = async () => {
    if (!matrixDirty) return
    setSavingMatrix(true)
    try {
      const saved = await saveRbacMatrix(draftMatrix)
      setMatrixData(saved)
      setDraftMatrix(cloneMatrix(saved.matrix))
      toast.success('تغییرات ماتریس دسترسی‌ها با موفقیت ذخیره و در لاگ ممیزی ثبت شد')
      refreshUsers()
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : 'خطا در ذخیره‌سازی ماتریس دسترسی‌ها',
      )
    } finally {
      setSavingMatrix(false)
    }
  }

  const handleToggleUserStatus = async (user: UserAccount, nextActive: boolean) => {
    setTogglingUserId(user.id)
    try {
      await toggleUserAccountStatus(user.id, nextActive)
      toast.success(
        nextActive
          ? `حساب کاربری ${user.name} فعال شد`
          : `حساب کاربری ${user.name} غیرفعال شد`,
      )
      refreshUsers()
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : 'خطا در تغییر وضعیت حساب کاربری',
      )
    } finally {
      setTogglingUserId(null)
    }
  }

  const matrixRoles: RbacRole[] = React.useMemo(
    () =>
      (matrixData?.roles ?? []).map((r) => ({
        id: r.id,
        label: r.label,
        subtitle: r.subtitle,
        highlight: r.highlight,
      })),
    [matrixData],
  )

  const matrixPermissions: RbacPermission[] = React.useMemo(
    () =>
      (matrixData?.permissions ?? []).map((p) => ({
        id: p.id,
        label: p.label,
        group: p.group,
        badge: p.badge,
        sensitive: p.sensitive,
      })),
    [matrixData],
  )

  const { disabledCells, cellMeta } = React.useMemo(() => {
    const disabled: Record<string, Record<string, boolean>> = {}
    const meta: Record<string, Record<string, RbacCellMeta>> = {}
    if (!matrixData) return { disabledCells: disabled, cellMeta: meta }

    for (const [permId, cols] of Object.entries(matrixData.lockedCells)) {
      disabled[permId] = {}
      for (const [roleId, lock] of Object.entries(cols)) {
        disabled[permId][roleId] = true
        if (lock.variant === 'exclusive' || lock.variant === 'forbidden') {
          meta[permId] ??= {}
          meta[permId][roleId] = {
            variant: lock.variant,
            label: lock.label,
          }
        }
      }
    }
    return { disabledCells: disabled, cellMeta: meta }
  }, [matrixData])

  const branchMap = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const b of branches) {
      map.set(b.id, b.nameFa)
    }
    return map
  }, [branches])

  const userColumns: DenseColumn<UserAccount>[] = [
    {
      id: 'identity',
      header: 'کاربر و اطلاعات شناسنامه‌ای',
      className: 'whitespace-normal min-w-44',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-label-md font-semibold text-primary"
          >
            {initialsOf(row.name)}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1 font-medium text-text-primary">
              <span className="truncate">{row.name}</span>
              {row.role === 'technical_officer' || row.role === 'pharmacist' ? (
                <Icon
                  name="verified"
                  size={16}
                  className="text-primary"
                  label="مسئول فنی تاییدشده"
                />
              ) : null}
            </div>
            <div
              dir="ltr"
              className="font-latin truncate text-left text-label-sm text-text-muted"
            >
              {row.email || row.username}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'personnelCode',
      header: 'کد پرسنلی / ش نظام',
      cell: (row) => (
        <div className="space-y-0.5">
          <div className="font-semibold text-text-primary tabular-nums-data">
            {row.personnelCode || row.username}
          </div>
          {row.medicalCouncilNo ? (
            <div className="text-label-sm text-text-muted">
              {row.medicalCouncilNo}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: 'role',
      header: 'نقش سازمانی',
      cell: (row) => (
        <Badge
          variant="outline"
          className={roleBadgeClass(row.role)}
        >
          {getAuditRoleLabel(row.role)}
        </Badge>
      ),
    },
    {
      id: 'unitLabel',
      header: 'واحد استقرار',
      className: 'whitespace-normal min-w-36',
      cell: (row) => (
        <span className="text-body-sm text-text-primary">
          {row.unitLabel || branchMap.get(row.branchId) || 'داروخانه مرکزی'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'وضعیت حساب',
      cell: (row) => {
        const isSelf = currentUserId === row.id
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={row.active}
              disabled={togglingUserId === row.id || isSelf}
              aria-label={`تغییر وضعیت حساب ${row.name}`}
              onCheckedChange={(checked) => handleToggleUserStatus(row, checked)}
            />
            <TriageStatusBadge
              status={
                row.permanentlyLocked
                  ? 'critical'
                  : row.active
                    ? 'valid'
                    : 'neutral'
              }
            >
              {row.permanentlyLocked
                ? 'قفل‌شده'
                : row.active
                  ? 'فعال'
                  : 'غیرفعال'}
            </TriageStatusBadge>
          </div>
        )
      },
    },
    {
      id: 'lastLogin',
      header: 'آخرین ورود به سامانه',
      cell: (row) =>
        row.lastLoginAt ? (
          <div className="space-y-0.5">
            <div className="text-body-sm text-text-primary tabular-nums-data">
              {formatJalaliDate(row.lastLoginAt)} ·{' '}
              {formatPersianTime(row.lastLoginAt)}
            </div>
            {row.lastLoginDevice || row.lastLoginIp ? (
              <div className="text-label-sm text-text-muted">
                {row.lastLoginDevice || `IP: ${row.lastLoginIp}`}
              </div>
            ) : null}
          </div>
        ) : (
          <span className="text-label-sm text-text-muted">ثبت نشده</span>
        ),
    },
    {
      id: 'actions',
      header: 'عملیات',
      align: 'end',
      cell: (row) => (
        <div className="inline-flex items-center gap-1">
          <ActionTooltip title="ویرایش پروفایل">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`ویرایش پروفایل ${row.name}`}
              onClick={() => {
                setPermDrawerOpen(false)
                setSelectedUser(row)
                setUserDrawerMode('edit')
                setActiveDrawerKind('user')
                setUserDrawerOpen(true)
              }}
            >
              <Icon name="edit" size={18} data-slot="icon" />
            </Button>
          </ActionTooltip>
          <ActionTooltip title="مجوزهای اختصاصی">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-primary"
              aria-label={`تنظیم مجوز اختصاصی ${row.name}`}
              onClick={() => {
                setUserDrawerOpen(false)
                setSelectedUser(row)
                setActiveDrawerKind('permissions')
                setPermDrawerOpen(true)
              }}
            >
              <Icon name="tune" size={18} data-slot="icon" />
            </Button>
          </ActionTooltip>
          <ActionTooltip title="بازنشانی کلمه عبور">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`بازنشانی کلمه عبور ${row.name}`}
              onClick={() => {
                setSelectedUser(row)
                setResetDialogOpen(true)
              }}
            >
              <Icon name="key" size={18} data-slot="icon" />
            </Button>
          </ActionTooltip>
        </div>
      ),
    },
  ]

  const lastAuditDescription = React.useMemo(() => {
    if (!kpis.lastAccessChangeAt) return 'برخط و تغییرناپذیر (WORM)'
    return `آخرین تغییر: ${formatJalaliDate(kpis.lastAccessChangeAt)} · ${formatPersianTime(kpis.lastAccessChangeAt)}`
  }, [kpis.lastAccessChangeAt])

  return (
    <AppShell
      navItems={getUsersPermissionsNavItems()}
      header={{
        branchLabel: branches[0]?.nameFa ?? 'داروخانه مرکزی - انبار شماره ۱',
        searchPlaceholder: 'جستجوی سریع پرسنل یا مجوز…',
        onSearchChange: (q) => {
          setSearchInput(q)
          if (q.trim() && activeTab !== 'users') {
            setActiveTab('users')
          }
        },
      }}
    >
      <div data-slot="users-permissions-page" className="space-y-5">
        <PageHeader
          breadcrumbs={
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/dashboard">داشبورد</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>مدیریت کاربران و ماتریس دسترسی‌ها</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          }
          title="مدیریت کاربران و ماتریس دسترسی‌ها"
          description="پیکربندی سطح دسترسی و تفکیک وظایف بالینی، انبارداری و ثبت نسخ پرسنل داروخانه مرکزی بر اساس اصول کنترل کیفیت دارویی و نظام ردیابی الکترونیک (TTAC / GSP)."
          actions={
            <>
              <Button
                type="button"
                variant="default"
                loading={savingMatrix}
                disabled={!matrixDirty || matrixLoading}
                onClick={handleSaveMatrix}
              >
                <Icon name="save_clock" size={18} data-slot="icon" />
                <span>ذخیره تغییرات ماتریس</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPermDrawerOpen(false)
                  setSelectedUser(null)
                  setUserDrawerMode('create')
                  setActiveDrawerKind('user')
                  setUserDrawerOpen(true)
                }}
              >
                <Icon name="person_add" size={18} data-slot="icon" />
                <span>افزودن کاربر جدید</span>
              </Button>
            </>
          }
        />

        {/* KPI Bento Row */}
        <section
          aria-label="شاخص‌های کلیدی دسترسی و پرسنل"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 desktop:grid-cols-4"
        >
          <KpiMetricCard
            title="کل کاربران ثبت‌شده"
            value={formatPersianNumber(kpis.totalUsers)}
            icon="group"
            tone="primary"
            delta={{
              label: `${formatPersianNumber(kpis.activeUsers)} کاربر فعال`,
              direction: 'up',
            }}
          />
          <KpiMetricCard
            title="داروسازان مسئول فنی"
            value={formatPersianNumber(kpis.technicalOfficers)}
            icon="medication_liquid"
            tone="info"
            description="دارای مهر نظام پزشکی"
          />
          <KpiMetricCard
            title="مجوزهای حساس (مخدر/سموم)"
            value={formatPersianNumber(kpis.sensitivePermissions)}
            icon="lock_person"
            tone="critical"
            description="انحصار مسئول فنی (منطبق با بخشنامه غذا و دارو)"
          />
          <KpiMetricCard
            title="وضعیت لاگ ممیزی (Audit)"
            value={`${formatPersianNumber(kpis.auditCoveragePercent)}٪`}
            icon="history"
            tone="valid"
            description={lastAuditDescription}
          />
        </section>

        {/* Perspective Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as 'matrix' | 'users')}
          className="space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-default border border-border-default bg-surface p-2">
            <TabsList className="flex-wrap">
              <TabsTrigger value="matrix" className="gap-1.5">
                <Icon name="grid_view" size={18} data-slot="icon" />
                <span>ماتریس دسترسی‌ها بر اساس نقش</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-1.5">
                <Icon name="badge" size={18} data-slot="icon" />
                <span>فهرست کاربران و پرسنل</span>
                <Badge variant="secondary" className="tabular-nums-data">
                  {formatPersianNumber(totalUsers)}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <div className="hidden items-center gap-4 px-2 text-label-sm text-text-muted tablet:flex">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-3 rounded-xs bg-primary" aria-hidden />
                دسترسی فعال
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="size-3 rounded-xs border border-border-strong bg-surface-muted"
                  aria-hidden
                />
                غیرمجاز
              </span>
              <span className="inline-flex items-center gap-1 text-status-critical-fg">
                <Icon name="lock" size={14} data-slot="icon" />
                الزام قانونی و انحصاری
              </span>
            </div>
          </div>

          {/* VIEW 1: ROLE-PERMISSION MATRIX */}
          <TabsContent value="matrix" className="space-y-4">
            <AlertBanner
              tone="info"
              title="قاعده طلایی تفکیک وظایف دارویی (Separation of Duties)"
              description="انبارداران و مدیران غیربالینی به هیچ‌عنوان امکان تأیید نهایی خروج داروهای تحت کنترل و صدور اسناد مغایرت انبارگردانی بدون امضای دیجیتال مسئول فنی را ندارند."
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setComplianceOpen(true)}
                >
                  مشاهده مستندات ضوابط
                </Button>
              }
            />

            {matrixDirty ? (
              <div
                role="status"
                className="flex flex-wrap items-center justify-between gap-3 rounded-default border border-status-warning-border bg-status-warning-bg px-4 py-2.5 text-status-warning-fg"
              >
                <span className="text-body-sm font-medium">
                  تغییرات ذخیره‌نشده در ماتریس دسترسی وجود دارد.
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={savingMatrix}
                    onClick={handleResetMatrix}
                  >
                    بازگردانی تغییرات
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    loading={savingMatrix}
                    onClick={handleSaveMatrix}
                  >
                    ذخیره تغییرات ماتریس
                  </Button>
                </div>
              </div>
            ) : null}

            {matrixError ? (
              <AlertBanner
                tone="critical"
                title="خطا در دریافت ماتریس دسترسی"
                description={matrixError}
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={refreshMatrix}
                  >
                    تلاش مجدد
                  </Button>
                }
              />
            ) : matrixLoading ? (
              <div
                data-slot="matrix-skeleton"
                className="space-y-2 rounded-default border border-border-default bg-surface p-4"
              >
                {Array.from({ length: 8 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-10 animate-pulse rounded-default bg-surface-subtle"
                  />
                ))}
              </div>
            ) : (
              <RbacPermissionMatrix
                roles={matrixRoles}
                permissions={matrixPermissions}
                value={draftMatrix}
                disabledCells={disabledCells}
                cellMeta={cellMeta}
                onChange={handleMatrixCellChange}
              />
            )}
          </TabsContent>

          {/* VIEW 2: USERS LIST */}
          <TabsContent value="users" className="space-y-4">
            <Card className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                  <div className="relative min-w-60 flex-1 sm:max-w-sm">
                    <Icon
                      name="search"
                      size={18}
                      className="pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 text-text-placeholder"
                      data-slot="icon"
                    />
                    <Input
                      type="search"
                      aria-label="جستجوی پرسنل"
                      placeholder="جستجوی پرسنل با نام، کد پرسنلی یا ایمیل…"
                      className="ps-10"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                    />
                  </div>

                  <Select
                    value={roleFilter || 'all'}
                    onValueChange={(val) => {
                      setRoleFilter(val === 'all' ? '' : val)
                      setPage(1)
                    }}
                  >
                    <SelectTrigger
                      className="w-48"
                      aria-label="فیلتر بر اساس نقش سازمانی"
                    >
                      <SelectValue placeholder="تمام نقش‌ها" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">تمام نقش‌ها</SelectItem>
                      <SelectItem value="super_admin">
                        مدیر سامانه / مؤسس
                      </SelectItem>
                      <SelectItem value="technical_officer">
                        داروساز مسئول فنی
                      </SelectItem>
                      <SelectItem value="warehouse_lead">
                        انباردار داروخانه
                      </SelectItem>
                      <SelectItem value="dispensing_clerk">
                        متصدی نسخه و پیشخوان
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={statusFilter || 'all'}
                    onValueChange={(val) => {
                      setStatusFilter(val === 'all' ? '' : val)
                      setPage(1)
                    }}
                  >
                    <SelectTrigger
                      className="w-40"
                      aria-label="فیلتر بر اساس وضعیت حساب"
                    >
                      <SelectValue placeholder="همه وضعیت‌ها" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                      <SelectItem value="active">فعال</SelectItem>
                      <SelectItem value="inactive">غیرفعال / قفل‌شده</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="text-label-md text-text-secondary tabular-nums-data">
                  نمایش {formatPersianNumber(users.length)} از{' '}
                  {formatPersianNumber(totalUsers)} کاربر
                </div>
              </div>
            </Card>

            {usersError ? (
              <AlertBanner
                tone="critical"
                title="خطا در دریافت فهرست کاربران"
                description={usersError}
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={refreshUsers}
                  >
                    تلاش مجدد
                  </Button>
                }
              />
            ) : usersLoading ? (
              <div
                data-slot="users-skeleton"
                className="space-y-2 rounded-default border border-border-default bg-surface p-4"
              >
                {Array.from({ length: 5 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-12 animate-pulse rounded-default bg-surface-subtle"
                  />
                ))}
              </div>
            ) : (
              <>
                <DenseDataTable
                  columns={userColumns}
                  data={users}
                  getRowId={(row) => row.id}
                  emptyMessage="کاربری با فیلترهای انتخاب‌شده یافت نشد"
                />
                <Pagination
                  page={page}
                  pageCount={pageCount}
                  pageSize={pageSize}
                  totalItems={totalUsers}
                  onPageChange={setPage}
                  onPageSizeChange={(next) => {
                    setPageSize(next)
                    setPage(1)
                  }}
                />
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Regulatory Compliance Footer Card */}
        <Card className="p-5">
          <CardContent className="space-y-4 p-0">
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-default bg-status-critical-bg text-status-critical-fg"
              >
                <Icon name="verified_user" size={22} data-slot="icon" />
              </span>
              <div className="space-y-1">
                <h2 className="text-title-md font-semibold text-text-primary">
                  دستورالعمل‌های الزام‌آور معاونت غذا و دارو و استانداردهای GSP / GDP
                </h2>
                <p className="text-body-sm leading-relaxed text-text-secondary">
                  مطابق با دستورالعمل ملی توزیع و انبارش بهینه فرآورده‌های سلامت‌محور، کلیه اقدامات مربوط به تأیید نهایی محموله‌های حاوی داروهای تحت کنترل و مخدر (نظیر مورفین، متادون و بوپرنورفین) منحصراً منوط به تأیید داروساز مسئول فنی مستقر در شیفت است. هیچ کاربری تحت نقش انباردار یا متصدی نسخه مجاز به آزادسازی یا صدور خروج فیزیکی این اقلام نیست.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 tablet:grid-cols-3">
              <div className="flex items-center gap-3 rounded-default border border-border-subtle bg-surface-subtle p-3">
                <Icon
                  name="fingerprint"
                  size={20}
                  className="text-primary"
                  data-slot="icon"
                />
                <div>
                  <div className="text-label-md font-semibold text-text-primary">
                    تفکیک وظایف اجباری
                  </div>
                  <div className="text-label-sm text-text-muted">
                    انحصار تأیید مخدر برای مسئول فنی
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-default border border-border-subtle bg-surface-subtle p-3">
                <Icon
                  name="enhanced_encryption"
                  size={20}
                  className="text-primary"
                  data-slot="icon"
                />
                <div>
                  <div className="text-label-md font-semibold text-text-primary">
                    سیاست تغییرناپذیری لاگ‌ها
                  </div>
                  <div className="text-label-sm text-text-muted">
                    ثبت WORM همه تغییرات سطح دسترسی
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-default border border-border-subtle bg-surface-subtle p-3">
                <Icon
                  name="hourglass_top"
                  size={20}
                  className="text-primary"
                  data-slot="icon"
                />
                <div>
                  <div className="text-label-md font-semibold text-text-primary">
                    کنترل قفل و نشست امنیتی
                  </div>
                  <div className="text-label-sm text-text-muted">
                    قفل خودکار پس از ۵ خطای متوالی ورود
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Side Drawer (Create/Edit User OR Per-User Custom Permissions) */}
      {activeDrawerKind === 'permissions' ? (
        <UserPermissionsDrawer
          open={permDrawerOpen}
          onOpenChange={setPermDrawerOpen}
          user={selectedUser}
          matrixData={matrixData}
          onSaved={refreshUsers}
        />
      ) : (
        <UserFormDrawer
          open={userDrawerOpen}
          onOpenChange={setUserDrawerOpen}
          mode={userDrawerMode}
          user={selectedUser}
          branches={branches}
          onSuccess={refreshUsers}
        />
      )}

      {/* Reset Password Dialog */}
      <ResetPasswordDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        user={selectedUser}
        onSuccess={refreshUsers}
      />

      {/* Regulatory Compliance Guidelines Dialog */}
      <Dialog open={complianceOpen} onOpenChange={setComplianceOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Icon name="policy" size={20} data-slot="icon" />
              <span>مستندات ضوابط تفکیک وظایف دارویی (IFDA / GSP)</span>
            </DialogTitle>
            <DialogDescription>
              محدودیت‌های زیر به‌صورت سیستمی در سرور نیز اعمال می‌شوند و قابل دور زدن نیستند.
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-2 ps-5 text-body-sm text-text-secondary">
            <li>
              تأییدیه قانونی داروهای تحت کنترل و مخدر منحصراً در اختیار{' '}
              <strong className="text-text-primary">داروساز مسئول فنی</strong> است.
            </li>
            <li>
              تأیید نهایی مغایرت انبارگردانی و صدور سند تعدیل برای انباردار و متصدی پیشخوان مسدود است.
            </li>
            <li>
              حداقل یک حساب <strong className="text-text-primary">مدیر سامانه / مؤسس</strong> فعال باید همواره در سامانه باقی بماند.
            </li>
            <li>
              کلیه تغییرات ماتریس، ویرایش نقش‌ها و بازنشانی رمز عبور در دفترچه ممیزی (Audit Trail) با کد{' '}
              <code className="font-latin text-xs">role_change</code> ثبت می‌شوند.
            </li>
          </ul>
          <DialogFooter>
            <Button type="button" onClick={() => setComplianceOpen(false)}>
              متوجه شدم
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
