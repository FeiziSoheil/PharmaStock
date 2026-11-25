'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  FileDropzone,
  KardexTimeline,
  PrintableDocumentPreview,
  RbacPermissionMatrix,
  Stepper,
  WarehouseRackGrid,
  type RackCell,
  type StepperStep,
} from '@/components/domain'
import { Icon } from '@/components/ui/icon'

const STEPS: StepperStep[] = [
  {
    id: 'meta',
    label: 'مشخصات فاکتور و شرکت پخش',
    description: 'داروپخش • ف-۱۴۰۳/۸۹۱',
    meta: 'گام ۱ • پایان‌یافته',
    status: 'completed',
  },
  {
    id: 'scan',
    label: 'اسکن بارکد، بچ و اقلام دارویی',
    description: '۳ قلم از ۵ قلم درج گردیده',
    meta: 'گام ۲ • در حال پردازش',
    status: 'current',
  },
  {
    id: 'finalize',
    label: 'تطبیق نهایی، قفسه و کاردکس',
    description: 'تایید حسابداری و ورود قطعی',
    meta: 'گام ۳ • مرحله آتی',
    status: 'upcoming',
  },
]

const RACK_STATUSES = [
  'empty',
  'occupied',
  'low',
  'expiring',
  'controlled',
  'critical',
  'quarantine',
] as const satisfies readonly RackCell['status'][]

const RACK_CELLS: RackCell[] = Array.from({ length: 16 }, (_, i) => {
  const status = RACK_STATUSES[i % RACK_STATUSES.length]!
  const col = (i % 4) + 1
  const row = Math.floor(i / 4) + 1
  return {
    id: `c-${row}-${col}`,
    label: `A-0${col}-${row}`,
    status,
    title: `قفسه A-0${col} · ردیف ${row}`,
  }
})

export default function DomainGalleryPage() {
  const [stepId, setStepId] = React.useState('scan')
  const [files, setFiles] = React.useState<File[]>([])
  const [fileError, setFileError] = React.useState<string | null>(null)
  const [selectedCell, setSelectedCell] = React.useState<string | null>('c-1-2')
  const [matrix, setMatrix] = React.useState<Record<string, Record<string, boolean>>>({
    view_inventory: { admin: true, pharmacist: true, clerk: true, auditor: true },
    receive_invoice: { admin: true, pharmacist: true, clerk: false, auditor: false },
    dispense: { admin: true, pharmacist: true, clerk: true, auditor: false },
    controlled: { admin: true, pharmacist: true, clerk: false, auditor: false },
    manage_users: { admin: true, pharmacist: false, clerk: false, auditor: false },
  })

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-4 py-8 md:px-6">
      <header className="space-y-3 border-b border-border-subtle pb-6">
        <p className="text-label-lg text-primary">فاز E · اجزای دامنه</p>
        <h1 className="text-headline-lg text-text-primary">
          پیش‌نمایش کامپوننت‌های دامنه انبار دارو
        </h1>
        <p className="max-w-3xl text-body-md text-text-secondary">
          اجزای قابل‌استفاده مجدد با API مبتنی بر props؛ بدون منطق صفحهٔ کسب‌وکار و بدون فراخوانی
          API. راست‌چین و واکنش‌گرا در سه نقطهٔ شکست.
        </p>
        <Link
          href="/"
          className="ps-focus-ring inline-flex h-9 items-center gap-2 rounded-default border border-border-default bg-surface px-3 text-label-md text-text-primary hover:bg-surface-hover"
        >
          <Icon name="arrow_forward" size={16} />
          بازگشت به خانه
        </Link>
      </header>

      <section className="space-y-3" data-gallery-section="stepper">
        <h2 className="text-headline-sm text-text-primary">نشانگر مراحل (Stepper)</h2>
        <Stepper
          steps={STEPS.map((s) =>
            s.id === stepId
              ? { ...s, status: 'current' }
              : STEPS.findIndex((x) => x.id === s.id) <
                  STEPS.findIndex((x) => x.id === stepId)
                ? { ...s, status: 'completed' }
                : { ...s, status: 'upcoming' },
          )}
          currentStepId={stepId}
          onStepSelect={setStepId}
        />
      </section>

      <section className="space-y-3" data-gallery-section="file-dropzone">
        <h2 className="text-headline-sm text-text-primary">ناحیه بارگذاری فایل (FileDropzone)</h2>
        <FileDropzone
          accept=".xlsx,.xls,.csv"
          multiple={false}
          maxSizeBytes={5 * 1024 * 1024}
          title="بارگذاری فایل فاکتور"
          hint="فایل اکسل یا CSV را بکشید و رها کنید، یا برای انتخاب کلیک کنید"
          files={files}
          error={fileError}
          onFilesSelected={(next) => {
            setFileError(null)
            setFiles(next)
          }}
          onFileRemove={() => setFiles([])}
        />
      </section>

      <section className="space-y-3" data-gallery-section="kardex-timeline">
        <h2 className="text-headline-sm text-text-primary">خط‌زمانی کاردکس (KardexTimeline)</h2>
        <KardexTimeline
          items={[
            {
              id: '1',
              title: 'ورود فاکتور خرید #ف-۱۴۰۳/۸۹۱',
              description:
                'شرکت توزیع داروپخش؛ ۱۸ کارتن آنتی‌بیوتیک با اسکن UID به قفسه A-04 منتقل شد.',
              timestamp: '۳۵ دقیقه پیش',
              meta: 'توسط انباردار: محسنی',
              tone: 'inbound',
              deltaIn: '+۵۰۰',
              balance: '۱٬۲۶۰',
            },
            {
              id: '2',
              title: 'خروج نسخه POS #۹۸۲۳۴۱',
              description: 'کسر خودکار ۴ قلم از بچ‌های FEFO.',
              timestamp: '۱ ساعت پیش',
              meta: 'دکتر رضایی',
              tone: 'outbound',
              deltaOut: '۱۰',
              balance: '۱٬۲۵۰',
            },
            {
              id: '3',
              title: 'اخطار خودکار قرنطینه',
              description: 'انتقال ۲ ویال منقضی از قفسه C-02 به باکس قرنطینه.',
              timestamp: '۲ ساعت پیش',
              meta: 'سیستم',
              tone: 'alert',
            },
          ]}
        />
      </section>

      <section className="space-y-3" data-gallery-section="warehouse-rack-grid">
        <h2 className="text-headline-sm text-text-primary">شبکه قفسه‌های انبار (WarehouseRackGrid)</h2>
        <WarehouseRackGrid
          columns={4}
          cells={RACK_CELLS}
          selectedId={selectedCell}
          onSelect={setSelectedCell}
          rowLabels={['ردیف ۱', 'ردیف ۲', 'ردیف ۳', 'ردیف ۴']}
          columnLabels={['قفسه ۱', 'قفسه ۲', 'قفسه ۳', 'قفسه ۴']}
          legend
        />
      </section>

      <section className="space-y-3" data-gallery-section="rbac-permission-matrix">
        <h2 className="text-headline-sm text-text-primary">ماتریس دسترسی نقش‌ها (RbacPermissionMatrix)</h2>
        <RbacPermissionMatrix
          roles={[
            { id: 'admin', label: 'مدیر سامانه', highlight: true },
            { id: 'pharmacist', label: 'مسئول فنی' },
            { id: 'clerk', label: 'انباردار' },
            { id: 'auditor', label: 'ممیز' },
          ]}
          permissions={[
            { id: 'view_inventory', label: 'مشاهده موجودی', group: 'انبار' },
            { id: 'receive_invoice', label: 'ثبت رسید فاکتور', group: 'انبار' },
            { id: 'dispense', label: 'صدور حواله خروج', group: 'عملیات' },
            { id: 'controlled', label: 'داروهای تحت کنترل', group: 'عملیات' },
            { id: 'manage_users', label: 'مدیریت کاربران', group: 'امنیت' },
          ]}
          value={matrix}
          disabledCells={{ controlled: { clerk: true, auditor: true } }}
          onChange={(permissionId, roleId, checked) => {
            setMatrix((prev) => ({
              ...prev,
              [permissionId]: { ...prev[permissionId], [roleId]: checked },
            }))
          }}
        />
      </section>

      <section className="space-y-3" data-gallery-section="printable-document-preview">
        <h2 className="text-headline-sm text-text-primary">
          پیش‌نمایش سند چاپی (PrintableDocumentPreview)
        </h2>
        <PrintableDocumentPreview
          title="پیش‌نمایش سند رسمی استرداد و مرجوعی دارو"
          subtitle="فرمت استاندارد سازمان غذا و دارو (IFDA)"
          documentTitle="صورت‌جلسه مرجوعی کالا"
          meta={[
            { label: 'شماره حواله', value: 'RET-40308-012', dir: 'ltr' },
            { label: 'تاریخ صدور', value: '۱۴۰۳/۰۸/۲۰' },
            { label: 'نوع حواله', value: 'استرداد تضمینی انقضا (ماده ۴)' },
          ]}
          parties={[
            { label: 'شرکت پخش مقصد', value: 'شرکت توزیع داروپخش (سهامی عام)' },
            { label: 'کد مشتری', value: 'DP-CUST-88401' },
            { label: 'مسئول وصول', value: 'مهندس کاظمی (منطقه ۳)' },
          ]}
          columns={[
            'ردیف',
            'شرح ژنریک دارو',
            'سری ساخت',
            'تاریخ انقضا',
            'تعداد',
            'مبلغ استرداد',
          ]}
          lines={[
            {
              id: '1',
              cells: ['۱', 'کپسول سفالکسین ۵۰۰', 'CX500-449', '۱۴۰۳/۰۹/۰۲', '۴۵ جعبه', '۸,۱۰۰,۰۰۰'],
            },
            {
              id: '2',
              cells: ['۲', 'آمپول دگزامتازون ۸mg', 'DX-04', '۱۴۰۳/۰۹/۱۰', '۱۲۰ ویال', '۱۱,۴۰۰,۰۰۰'],
            },
          ]}
          footerNote="اقلام فوق پلمب و در شرایط دمایی استاندارد نگهداری شده‌اند."
          totalLabel="مبلغ نهایی"
          totalValue="۱۹,۵۰۰,۰۰۰ ریال"
        />
      </section>
    </main>
  )
}
