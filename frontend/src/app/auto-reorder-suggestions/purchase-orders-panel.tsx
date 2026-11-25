'use client'

import * as React from 'react'
import {
  Badge,
  Button,
  Icon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import {
  AlertBanner,
  ConfirmDialog,
  TriageStatusBadge,
  type TriageStatus,
} from '@/components/shared'
import {
  REORDER_DISTRIBUTORS,
  type PurchaseOrder,
  type PurchaseOrderStatus,
} from '@/lib/types/reorder'
import {
  formatJalaliDate,
  formatPersianNumber,
  formatRial,
  toPersianDigits,
} from '@/lib/persian'

type PurchaseOrdersPanelProps = {
  orders: PurchaseOrder[]
  loading: boolean
  onRefresh: () => Promise<void>
  onUpdateStatus: (
    id: string,
    status: PurchaseOrderStatus,
    technicalConfirm?: boolean,
  ) => Promise<void>
  onExportOrder: (id: string) => Promise<void>
}

const ORDER_STATUS_META: Record<
  PurchaseOrderStatus,
  { label: string; triage: TriageStatus }
> = {
  draft: { label: 'پیش‌نویس', triage: 'warning' },
  submitted: { label: 'ثبت و ارسال‌شده به پخش', triage: 'expiring' },
  approved: { label: 'تأیید نهایی', triage: 'valid' },
  cancelled: { label: 'لغو شده', triage: 'critical' },
}

export function PurchaseOrdersPanel({
  orders,
  loading,
  onRefresh,
  onUpdateStatus,
  onExportOrder,
}: PurchaseOrdersPanelProps) {
  const [statusFilter, setStatusFilter] = React.useState<
    PurchaseOrderStatus | 'all'
  >('all')
  const [distributorFilter, setDistributorFilter] = React.useState('')
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [pendingAction, setPendingAction] = React.useState<{
    order: PurchaseOrder
    nextStatus: PurchaseOrderStatus
  } | null>(null)

  const filtered = React.useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false
      if (distributorFilter && order.distributorId !== distributorFilter) {
        return false
      }
      return true
    })
  }, [orders, statusFilter, distributorFilter])

  async function runAction(
    order: PurchaseOrder,
    nextStatus: PurchaseOrderStatus,
  ) {
    setBusyId(order.id)
    try {
      await onUpdateStatus(
        order.id,
        nextStatus,
        order.hasControlled && nextStatus === 'approved' ? true : undefined,
      )
      setPendingAction(null)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4" data-slot="purchase-orders-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-default border border-border-default bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as PurchaseOrderStatus | 'all')
            }
          >
            <SelectTrigger className="w-[12rem]" aria-label="فیلتر وضعیت سفارش">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه وضعیت‌ها ({toPersianDigits(orders.length)})</SelectItem>
              <SelectItem value="draft">پیش‌نویس</SelectItem>
              <SelectItem value="submitted">ثبت و ارسال‌شده</SelectItem>
              <SelectItem value="approved">تأیید نهایی</SelectItem>
              <SelectItem value="cancelled">لغو شده</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={distributorFilter || '__all__'}
            onValueChange={(value) =>
              setDistributorFilter(value === '__all__' ? '' : value)
            }
          >
            <SelectTrigger className="w-[12rem]" aria-label="فیلتر پخش سفارش‌ها">
              <SelectValue placeholder="همه شرکت‌های پخش" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">همه شرکت‌های پخش</SelectItem>
              {REORDER_DISTRIBUTORS.map((dist) => (
                <SelectItem key={dist.id} value={dist.id}>
                  {dist.nameFa}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => void onRefresh()}
        >
          <Icon name="refresh" size={16} data-slot="icon" />
          بروزرسانی کارتابل
        </Button>
      </div>

      {filtered.length === 0 ? (
        <AlertBanner
          tone="info"
          title="سفارش خریدی با این فیلتر یافت نشد"
          description="از تب پیشنهادهای فعال، اقلام مورد نیاز را انتخاب کرده و به سفارش خرید یا پیش‌نویس تبدیل کنید."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const meta = ORDER_STATUS_META[order.status] ?? ORDER_STATUS_META.draft
            const isExpanded = expandedId === order.id
            const isBusy = busyId === order.id

            return (
              <div
                key={order.id}
                className="overflow-hidden rounded-default border border-border-default bg-surface"
              >
                <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="font-latin text-title-md font-bold text-text-primary tabular-nums-data"
                        dir="ltr"
                      >
                        {order.orderNumber}
                      </span>
                      <Badge variant="secondary">{order.distributorNameFa}</Badge>
                      <TriageStatusBadge status={meta.triage}>
                        {meta.label}
                      </TriageStatusBadge>
                      {order.hasControlled ? (
                        <Badge variant="critical" className="gap-1">
                          <Icon name="lock" size={12} data-slot="icon" />
                          حاوی قلم تحت کنترل
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-label-sm text-text-secondary">
                      <span>
                        تاریخ ثبت: {formatJalaliDate(order.createdAt)}
                      </span>
                      <span>•</span>
                      <span>{toPersianDigits(order.itemCount)} قلم دارو</span>
                      <span>•</span>
                      <span>
                        جمع تعدادی: {formatPersianNumber(order.totalQty)} واحد
                      </span>
                      <span>•</span>
                      <span className="font-semibold text-primary">
                        برآورد کل: {formatRial(order.totalCost)}
                      </span>
                      {order.actorName ? (
                        <>
                          <span>•</span>
                          <span>ثبت‌کننده: {order.actorName}</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : order.id)
                      }
                    >
                      <Icon
                        name={isExpanded ? 'chevron_left' : 'format_list_bulleted'}
                        size={16}
                        data-slot="icon"
                      />
                      {isExpanded ? 'بستن اقلام' : 'مشاهده اقلام'}
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => void onExportOrder(order.id)}
                    >
                      <Icon name="table_view" size={16} data-slot="icon" />
                      خروجی اکسل
                    </Button>

                    {order.status === 'draft' ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => void runAction(order, 'submitted')}
                      >
                        <Icon name="send_and_archive" size={16} data-slot="icon" />
                        ارسال به پخش
                      </Button>
                    ) : null}

                    {order.status === 'submitted' ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={isBusy}
                        onClick={() =>
                          setPendingAction({ order, nextStatus: 'approved' })
                        }
                      >
                        <Icon name="task_alt" size={16} data-slot="icon" />
                        تأیید نهایی
                      </Button>
                    ) : null}

                    {order.status !== 'cancelled' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isBusy}
                        onClick={() =>
                          setPendingAction({ order, nextStatus: 'cancelled' })
                        }
                      >
                        <Icon name="close" size={16} data-slot="icon" />
                        لغو سفارش
                      </Button>
                    ) : null}
                  </div>
                </div>

                {isExpanded ? (
                  <div className="border-t border-border-default bg-surface-subtle p-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-start text-body-sm">
                        <thead>
                          <tr className="border-b border-border-default text-label-sm text-text-secondary">
                            <th className="py-2 text-start">نام دارو</th>
                            <th className="py-2 text-start">شناسه IRC</th>
                            <th className="py-2 text-end">تعداد سفارش</th>
                            <th className="py-2 text-end">قیمت واحد</th>
                            <th className="py-2 text-end">جمع کل</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.items.map((item) => {
                            const lineTotal =
                              item.lineTotal ??
                              item.finalQty * (item.unitCost ?? 0)
                            return (
                              <tr
                                key={`${order.id}-${item.drugId}`}
                                className="border-b border-border-default/60 last:border-0"
                              >
                                <td className="py-2 font-medium text-text-primary">
                                  {item.nameFa || item.drugId}{' '}
                                  {item.strength ?? ''}
                                  {item.isControlled ? (
                                    <Badge
                                      variant="critical"
                                      className="ms-2 text-[10px]"
                                    >
                                      تحت کنترل
                                    </Badge>
                                  ) : null}
                                </td>
                                <td
                                  className="py-2 font-latin tabular-nums-data text-text-secondary"
                                  dir="ltr"
                                >
                                  {toPersianDigits(item.irc || '—')}
                                </td>
                                <td className="py-2 text-end tabular-nums-data font-semibold">
                                  {formatPersianNumber(item.finalQty)}{' '}
                                  {item.unitLabel ?? ''}
                                </td>
                                <td className="py-2 text-end tabular-nums-data text-text-secondary">
                                  {item.unitCost
                                    ? formatRial(item.unitCost)
                                    : '—'}
                                </td>
                                <td className="py-2 text-end tabular-nums-data font-semibold text-primary">
                                  {lineTotal ? formatRial(lineTotal) : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null)
        }}
        tone={
          pendingAction?.nextStatus === 'cancelled' ||
          pendingAction?.order.hasControlled
            ? 'critical'
            : 'warning'
        }
        title={
          pendingAction?.nextStatus === 'cancelled'
            ? `لغو سفارش ${pendingAction.order.orderNumber}`
            : `تأیید نهایی سفارش ${pendingAction?.order.orderNumber ?? ''}`
        }
        description={
          pendingAction?.nextStatus === 'cancelled'
            ? 'با لغو این سفارش، اقلام آن از وضعیت در راه خارج شده و در صورت قرار داشتن زیر نقطه سفارش به فهرست پیشنهادهای فعال بازمی‌گردند.'
            : pendingAction?.order.hasControlled
              ? 'این سفارش شامل قلم تحت کنترل / سهمیه‌ای است. تأیید شما به‌منزله تأیید صریح مسئول فنی داروخانه ثبت می‌شود.'
              : 'سفارش خرید به وضعیت «تأیید نهایی» تغییر می‌یابد.'
        }
        confirmLabel={
          pendingAction?.nextStatus === 'cancelled'
            ? 'تأیید لغو سفارش'
            : 'تأیید نهایی سفارش'
        }
        cancelLabel="انصراف"
        loading={Boolean(busyId)}
        onConfirm={() => {
          if (pendingAction) {
            void runAction(pendingAction.order, pendingAction.nextStatus)
          }
        }}
      />
    </div>
  )
}
