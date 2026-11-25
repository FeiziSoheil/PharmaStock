'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Input,
  Label,
} from '@/components/ui'
import { AppShell } from '@/components/layout'
import {
  AlertBanner,
  ConfirmDialog,
  DenseDataTable,
  KpiMetricCard,
  PageHeader,
  Pagination,
  SideDrawer,
  TriageStatusBadge,
  type DenseColumn,
  type TriageStatus,
} from '@/components/shared'
import { getAppNavItems } from '@/lib/nav/app-nav'

const NAV_ITEMS = getAppNavItems('dashboard')

type InventoryRow = {
  id: string
  name: string
  sku: string
  batch: string
  expiry: string
  qty: number
  price: string
  status: TriageStatus
}

const INVENTORY_ROWS: InventoryRow[] = [
  {
    id: '1',
    name: 'استامینوفن ۵۰۰',
    sku: 'IRC-100245',
    batch: 'B-1403-081',
    expiry: '۱۴۰۴/۰۶/۱۵',
    qty: 1240,
    price: '۱۸٬۵۰۰',
    status: 'valid',
  },
  {
    id: '2',
    name: 'آموکسی‌سیلین ۲۵۰',
    sku: 'IRC-100812',
    batch: 'B-1403-044',
    expiry: '۱۴۰۳/۱۱/۰۱',
    qty: 86,
    price: '۴۲٬۰۰۰',
    status: 'warning',
  },
  {
    id: '3',
    name: 'انسولین رگولار',
    sku: 'IRC-200331',
    batch: 'B-1402-912',
    expiry: '۱۴۰۳/۰۹/۲۰',
    qty: 24,
    price: '۲۱۵٬۰۰۰',
    status: 'expiring',
  },
  {
    id: '4',
    name: 'مورفین سولفات',
    sku: 'IRC-900014',
    batch: 'B-1401-003',
    expiry: '۱۴۰۳/۰۷/۰۱',
    qty: 0,
    price: '۹۸٬۰۰۰',
    status: 'critical',
  },
  {
    id: '5',
    name: 'متفورمین ۵۰۰',
    sku: 'IRC-100501',
    batch: 'B-1403-220',
    expiry: '۱۴۰۵/۰۱/۱۲',
    qty: 640,
    price: '۱۲٬۷۵۰',
    status: 'valid',
  },
  {
    id: '6',
    name: 'آزیترومایسین ۲۵۰',
    sku: 'IRC-100933',
    batch: 'B-1403-118',
    expiry: '۱۴۰۴/۰۳/۰۸',
    qty: 310,
    price: '۶۷٬۵۰۰',
    status: 'info',
  },
]

const COLUMNS: DenseColumn<InventoryRow>[] = [
  {
    id: 'name',
    header: 'نام دارو',
    cell: (row) => row.name,
  },
  {
    id: 'sku',
    header: 'کد IRC',
    dir: 'ltr',
    cell: (row) => row.sku,
  },
  {
    id: 'batch',
    header: 'سری ساخت',
    dir: 'ltr',
    cell: (row) => row.batch,
  },
  {
    id: 'expiry',
    header: 'انقضا',
    cell: (row) => row.expiry,
  },
  {
    id: 'qty',
    header: 'موجودی',
    align: 'end',
    cell: (row) => row.qty.toLocaleString('fa-IR'),
  },
  {
    id: 'price',
    header: 'قیمت واحد',
    align: 'end',
    cell: (row) => (
      <span className="font-latin tabular-nums-data" dir="ltr">
        {row.price} IRR
      </span>
    ),
  },
  {
    id: 'status',
    header: 'وضعیت',
    cell: (row) => <TriageStatusBadge status={row.status} />,
  },
]

export default function ShellGalleryPage() {
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)
  const [bannerOpen, setBannerOpen] = React.useState(true)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [drawerOpen, setDrawerOpen] = React.useState(false)

  const pageCount = Math.max(1, Math.ceil(INVENTORY_ROWS.length / pageSize))
  const pageRows = INVENTORY_ROWS.slice((page - 1) * pageSize, page * pageSize)

  return (
    <AppShell
      navItems={NAV_ITEMS}
      header={{ branchLabel: 'شعبه مرکزی' }}
      sidebar={{
        brand: { title: 'فارما استاک', subtitle: 'مدیریت بالینی انبار' },
        footer: (
          <div className="flex items-center gap-2 text-label-sm text-text-muted">
            <span className="size-2 rounded-full bg-status-valid-fg" aria-hidden />
            وضعیت سامانه · برخط
          </div>
        ),
      }}
    >
      <div className="flex flex-col gap-6" data-page="shell-gallery">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-label-lg text-primary">
            گالری موقت اجزای مشترک · Phase D
          </p>
          <Link
            href="/components"
            className="text-body-sm text-primary underline-offset-4 hover:underline"
          >
            بازگشت به گالری Phase C
          </Link>
        </div>

        <PageHeader
          title="پیش‌نمایش پوسته و اجزای مشترک"
          description="ترکیب توکن‌های Phase B با کامپوننت‌های پایه Phase C — بدون تکرار primitives."
          breadcrumbs={
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">خانه</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>پوسته و اجزای مشترک</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          }
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                data-testid="open-drawer"
                onClick={() => setDrawerOpen(true)}
              >
                کشوی کناری
              </Button>
              <Button
                type="button"
                variant="destructive"
                data-testid="open-confirm"
                onClick={() => setConfirmOpen(true)}
              >
                دیالوگ تأیید
              </Button>
            </>
          }
        />

        {bannerOpen ? (
          <div id="alerts">
            <AlertBanner
              tone="expiring"
              title="۱۲ سری ساخت طی ۳۰ روز آینده منقضی می‌شوند"
              description="اولویت FEFO را برای قفسه یخچال و انسولین‌ها فعال کنید."
              onDismiss={() => setBannerOpen(false)}
              action={
                <Button type="button" size="sm" variant="outline">
                  مشاهده هشدارها
                </Button>
              }
            />
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-4">
          <KpiMetricCard
            title="کل اقلام فعال"
            value="۱٬۲۴۸"
            icon="inventory_2"
            tone="primary"
            delta={{ label: '+۴٪ نسبت به ماه گذشته', direction: 'up' }}
          />
          <KpiMetricCard
            title="موجودی کم"
            value="۳۶"
            icon="warning"
            tone="warning"
            delta={{ label: 'نیاز به سفارش مجدد', direction: 'flat' }}
          />
          <KpiMetricCard
            title="نزدیک انقضا"
            value="۱۲"
            icon="schedule"
            tone="expiring"
            delta={{ label: 'کمتر از ۹۰ روز', direction: 'down' }}
          />
          <KpiMetricCard
            title="بحرانی / صفر"
            value="۴"
            icon="dangerous"
            tone="critical"
            delta={{ label: 'قرنطینه خروج', direction: 'down' }}
          />
        </section>

        <section id="table" className="flex flex-col gap-0 overflow-hidden rounded-default border border-border-default bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
            <h2 className="text-headline-sm text-text-primary">جدول فشرده موجودی</h2>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  'valid',
                  'warning',
                  'expiring',
                  'critical',
                ] as const
              ).map((status) => (
                <TriageStatusBadge key={status} status={status} />
              ))}
            </div>
          </div>
          <DenseDataTable
            columns={COLUMNS}
            data={pageRows}
            getRowId={(row) => row.id}
            caption="نمونه داده‌های انبار برای تأیید چگالی و جهت مختلط"
            className="rounded-none border-0"
          />
          <Pagination
            page={page}
            pageCount={pageCount}
            pageSize={pageSize}
            totalItems={INVENTORY_ROWS.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
          />
        </section>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        tone="critical"
        title="حذف دائمی سری ساخت؟"
        description="این عملیات غیرقابل بازگشت است و در دفتر کنترل مواد ثبت می‌شود."
        confirmLabel="تأیید حذف"
        onConfirm={() => setConfirmOpen(false)}
      />

      <SideDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="افزودن سریع سری ساخت"
        description="ثبت بچ جدید بدون ترک صفحه جاری"
        footer={
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setDrawerOpen(false)}>
              انصراف
            </Button>
            <Button type="button" onClick={() => setDrawerOpen(false)}>
              ذخیره
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="batch-irc">کد IRC</Label>
            <Input id="batch-irc" className="font-latin" dir="ltr" placeholder="IRC-100245" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="batch-no">شماره سری ساخت</Label>
            <Input id="batch-no" className="font-latin" dir="ltr" placeholder="B-1403-081" />
          </div>
        </div>
      </SideDrawer>
    </AppShell>
  )
}
