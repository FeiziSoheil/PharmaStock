'use client'

import * as React from 'react'
import { PrintableDocumentPreview } from '@/components/domain'
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Icon,
  Input,
  Label,
} from '@/components/ui'
import { formatJalaliDate, formatRial, toPersianDigits } from '@/lib/persian'
import type { SelectedDistributorDraft } from '@/lib/returns/selection'
import type { DistributorReturn } from '@/lib/types/returns'
import { cn } from '@/lib/utils'

export type ReturnSlipModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Mode A: previewing newly selected distributor groups before confirming */
  drafts?: SelectedDistributorDraft[]
  todayISO: string
  submitting?: boolean
  onConfirmIssue?: (note: string) => Promise<void>
  /** Mode B: inspecting / printing / settling an existing issued slip */
  existingSlip?: DistributorReturn | null
  onSettleSlip?: (
    id: string,
    payload: { visitorName?: string; creditNoteNo?: string },
  ) => Promise<void>
}

const SLIP_COLUMNS = [
  'ردیف',
  'شرح ژنریک دارو و دوز',
  'شرکت سازنده',
  'سری ساخت (بچ)',
  'تاریخ انقضا',
  'تعداد / واحد',
  'فی خرید (ریال)',
  'مبلغ کل استرداد (ریال)',
]

export function ReturnSlipModal(props: ReturnSlipModalProps) {
  if (!props.open) {
    return (
      <Dialog open={false} onOpenChange={props.onOpenChange}>
        <DialogContent />
      </Dialog>
    )
  }

  const modalKey = props.existingSlip
    ? `slip-${props.existingSlip.id}-${props.existingSlip.status}`
    : `draft-${props.drafts?.map((d) => `${d.distributorId}:${d.items.length}`).join(',') ?? ''}`

  return <ReturnSlipModalInner key={modalKey} {...props} />
}

function ReturnSlipModalInner({
  open,
  onOpenChange,
  drafts = [],
  todayISO,
  submitting = false,
  onConfirmIssue,
  existingSlip,
  onSettleSlip,
}: ReturnSlipModalProps) {
  const [activeDraftIdx, setActiveDraftIdx] = React.useState(0)
  const [note, setNote] = React.useState('')
  const [visitorName, setVisitorName] = React.useState(
    existingSlip?.visitorName ?? '',
  )
  const [creditNoteNo, setCreditNoteNo] = React.useState(
    existingSlip?.creditNoteNo ?? '',
  )

  const isExisting = Boolean(existingSlip)
  const activeDraft = drafts[activeDraftIdx] ?? drafts[0]

  const slipData = React.useMemo(() => {
    if (existingSlip) {
      return {
        slipNo: existingSlip.returnNo ?? existingSlip.id.slice(0, 8),
        issueDate: existingSlip.confirmedAt ?? existingSlip.createdAt ?? todayISO,
        distributorName: existingSlip.distributorName,
        customerCode: existingSlip.customerCode ?? '—',
        visitorName: existingSlip.visitorName ?? 'نماینده رسمی شرکت پخش',
        totalQty: existingSlip.totalQty,
        totalValueRial: existingSlip.totalValueRial,
        lines: existingSlip.lines.map((line, index) => ({
          id: line.id || `${line.batchId}-${index}`,
          cells: [
            toPersianDigits(index + 1),
            [line.nameFa, line.dosageForm, line.strength]
              .filter(Boolean)
              .join(' '),
            line.manufacturer || '—',
            line.batchNo,
            formatJalaliDate(line.expiry),
            `${toPersianDigits(line.quantity)} ${line.unitLabel}`,
            formatRial(line.buyPriceRial, { withCurrency: false }),
            formatRial(line.lineTotalRial, { withCurrency: false }),
          ],
        })),
      }
    }

    if (!activeDraft) return null

    return {
      slipNo: `پیش‌نویس-${activeDraft.distributorCode}`,
      issueDate: todayISO,
      distributorName: activeDraft.distributorName,
      customerCode: activeDraft.customerCode || '—',
      visitorName: activeDraft.visitorName || 'نماینده شرکت پخش',
      totalQty: activeDraft.totalQty,
      totalValueRial: activeDraft.totalValueRial,
      lines: activeDraft.items.map((item, index) => ({
        id: item.batchId,
        cells: [
          toPersianDigits(index + 1),
          [item.nameFa, item.dosageForm, item.strength]
            .filter(Boolean)
            .join(' '),
          item.manufacturer || '—',
          item.batchNo,
          formatJalaliDate(item.expiry),
          `${toPersianDigits(item.returnQty)} ${item.unitLabel}`,
          formatRial(item.buyPriceRial, { withCurrency: false }),
          formatRial(item.lineTotalRial, { withCurrency: false }),
        ],
      })),
    }
  }, [existingSlip, activeDraft, todayISO])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-h-[92vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
      >
        <DialogHeader className="border-b border-border-subtle bg-surface-subtle px-5 py-4 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 pe-6">
            <div>
              <DialogTitle>
                پیش‌نمایش سند رسمی استرداد و مرجوعی دارو
              </DialogTitle>
              <DialogDescription>
                فرمت استاندارد سازمان غذا و دارو (IFDA) و اتحادیه شرکت‌های پخش
                سراسری دارویی
              </DialogDescription>
            </div>
            {existingSlip ? (
              <Badge
                variant={
                  existingSlip.status === 'settled' ? 'valid' : 'warning'
                }
              >
                {existingSlip.status === 'settled'
                  ? 'تسویه‌شده با ویزیتور'
                  : 'منتظر تایید ویزیتور'}
              </Badge>
            ) : drafts.length > 1 ? (
              <Badge variant="info">
                {toPersianDigits(drafts.length)} برگه مجزا به تفکیک شرکت پخش
              </Badge>
            ) : null}
          </div>

          {!isExisting && drafts.length > 1 ? (
            <div
              className="mt-3 flex flex-wrap gap-2"
              role="tablist"
              aria-label="انتخاب شرکت پخش در پیش‌نمایش"
            >
              {drafts.map((d, idx) => (
                <Button
                  key={d.distributorId}
                  type="button"
                  size="sm"
                  variant={idx === activeDraftIdx ? 'default' : 'outline'}
                  onClick={() => setActiveDraftIdx(idx)}
                >
                  {d.distributorName} ({toPersianDigits(d.items.length)})
                </Button>
              ))}
            </div>
          ) : null}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {slipData ? (
            <PrintableDocumentPreview
              title="صورت‌جلسه رسمی مرجوعی به شرکت پخش"
              subtitle="داروخانه مرکزی — واحد کنترل انقضا و استرداد"
              documentTitle="صورت‌جلسه مرجوعی کالا"
              meta={[
                { label: 'شماره حواله:', value: slipData.slipNo, dir: 'ltr' },
                {
                  label: 'تاریخ صدور:',
                  value: formatJalaliDate(slipData.issueDate),
                },
                {
                  label: 'نوع حواله:',
                  value: 'استرداد تضمینی انقضا (ماده ۴)',
                },
              ]}
              parties={[
                {
                  label: 'شرکت پخش مقصد (موزع):',
                  value: slipData.distributorName,
                },
                {
                  label: 'کد مشتری / اشتراک داروخانه:',
                  value: slipData.customerCode,
                },
                {
                  label: 'مسئول وصول / ویزیتور مربوطه:',
                  value: slipData.visitorName,
                },
              ]}
              columns={SLIP_COLUMNS}
              lines={slipData.lines}
              totalLabel={`جمع کل (${toPersianDigits(slipData.totalQty)} قلم)`}
              totalValue={formatRial(slipData.totalValueRial)}
              footerNote="۱. اقلام فوق به‌صورت فیزیکی پلمب و در شرایط دمایی استاندارد نگهداری شده و مورد تایید مسئول فنی داروخانه می‌باشند. ۲. وجه اقلام مرجوعی می‌بایست ظرف مدت حداکثر ۷ روز کاری به حساب بستانکاری داروخانه منظور گردد."
              className="max-w-none border-0"
            >
              <div className="grid grid-cols-1 gap-3 border-t border-border-subtle pt-4 md:grid-cols-3">
                <div className="flex flex-col items-center rounded-default bg-surface-subtle p-3 text-center">
                  <span className="text-label-md font-bold text-text-primary">
                    مسئول فنی داروخانه
                  </span>
                  <span className="mt-0.5 text-label-sm text-text-secondary">
                    تاییدیه سلامت نگهداری و اصالت بچ
                  </span>
                  <div className="mt-3 flex h-12 items-center justify-center">
                    <span className="rounded-full border border-primary/40 px-3 py-1 text-label-sm font-semibold text-primary">
                      تایید شد — مسئول فنی
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-center rounded-default bg-surface-subtle p-3 text-center">
                  <span className="text-label-md font-bold text-text-primary">
                    انباردار تحویل‌دهنده
                  </span>
                  <span className="mt-0.5 text-label-sm text-text-secondary">
                    کسر از کاردکس و تحویل فیزیکی کارتن
                  </span>
                  <div className="mt-3 flex h-12 items-center justify-center text-label-sm text-text-muted">
                    امضای تحویل‌دهنده
                  </div>
                </div>
                <div className="flex flex-col items-center rounded-default bg-surface-subtle p-3 text-center">
                  <span className="text-label-md font-bold text-text-primary">
                    نماینده / موزع شرکت پخش
                  </span>
                  <span className="mt-0.5 text-label-sm text-text-secondary">
                    {slipData.visitorName}
                  </span>
                  <div className="mt-3 flex h-12 items-center justify-center text-label-sm text-text-muted">
                    {existingSlip?.creditNoteNo
                      ? `سند بستانکاری: ${existingSlip.creditNoteNo}`
                      : '(مهر و امضای دریافت شرکت پخش)'}
                  </div>
                </div>
              </div>
            </PrintableDocumentPreview>
          ) : null}

          {!isExisting ? (
            <div className="mt-4 flex flex-col gap-1.5 print:hidden">
              <Label htmlFor="return-slip-note">
                توضیحات تکمیلی حواله (اختیاری)
              </Label>
              <Input
                id="return-slip-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="مثلاً: تحویل در نوبت ویزیتور صبح، بسته‌بندی در قفسه قرنطینه..."
              />
            </div>
          ) : existingSlip?.status === 'confirmed' && onSettleSlip ? (
            <div className="mt-4 grid grid-cols-1 gap-3 rounded-default border border-border-default bg-surface-subtle p-4 sm:grid-cols-2 print:hidden">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="settle-visitor-name">
                  نام ویزیتور / تحویل‌گیرنده پخش
                </Label>
                <Input
                  id="settle-visitor-name"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  placeholder="مثلاً: مهندس کاظمی"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="settle-credit-note">
                  شماره رسید / اعلامیه بستانکاری (اختیاری)
                </Label>
                <Input
                  id="settle-credit-note"
                  dir="ltr"
                  className="font-latin text-start"
                  value={creditNoteNo}
                  onChange={(e) => setCreditNoteNo(e.target.value)}
                  placeholder="CN-403-102"
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle bg-surface-subtle px-5 py-3.5 print:hidden">
          <div className="flex items-center gap-2 text-label-sm text-text-secondary">
            <Icon
              name="check_circle"
              size={18}
              className="text-secondary"
              data-slot="icon"
            />
            <span>
              {isExisting
                ? 'این سند در کاردکس انبار و لاگ ممیزی ثبت شده است.'
                : 'با تایید نهایی، اقلام مرجوعی از موجودی بچ و کاردکس کسر و حواله صادر می‌شود.'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {isExisting ? 'بستن' : 'انصراف و بازگشت'}
            </Button>

            {!isExisting && onConfirmIssue ? (
              <Button
                type="button"
                disabled={submitting || drafts.length === 0}
                onClick={() => void onConfirmIssue(note)}
                className={cn(submitting && 'opacity-80')}
              >
                <Icon
                  name={submitting ? 'progress_activity' : 'task_alt'}
                  size={18}
                  className={cn(submitting && 'animate-spin')}
                  data-slot="icon"
                />
                <span>
                  {submitting
                    ? 'در حال صدور سند و کسر کاردکس…'
                    : drafts.length > 1
                      ? `تایید نهایی و صدور ${toPersianDigits(drafts.length)} حواله مرجوعی`
                      : 'تایید نهایی، صدور حواله و کسر از کاردکس انبار'}
                </span>
              </Button>
            ) : null}

            {existingSlip?.status === 'confirmed' && onSettleSlip ? (
              <Button
                type="button"
                disabled={submitting}
                onClick={() =>
                  void onSettleSlip(existingSlip.id, {
                    visitorName: visitorName.trim() || undefined,
                    creditNoteNo: creditNoteNo.trim() || undefined,
                  })
                }
              >
                <Icon name="verified" size={18} data-slot="icon" />
                <span>ثبت تایید ویزیتور و تسویه بستانکاری</span>
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
