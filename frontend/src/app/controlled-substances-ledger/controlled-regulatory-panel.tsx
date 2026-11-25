'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, CardContent, CardHeader, CardTitle, Icon } from '@/components/ui'
import { formatPersianNumber, toPersianDigits } from '@/lib/persian'
import type { VaultDrugStock } from '@/lib/types/controlled'
import { cn } from '@/lib/utils'

type Props = {
  vaultItems: VaultDrugStock[]
  selectedDrugId: string
  onSelectDrug: (drugId: string) => void
  operatorName: string
  operatorRoleLabel: string
}

export function ControlledRegulatoryPanel({
  vaultItems,
  selectedDrugId,
  onSelectDrug,
  operatorName,
  operatorRoleLabel,
}: Props) {
  const router = useRouter()

  return (
    <aside className="space-y-4" aria-label="پنل ضوابط و موجودی گاوصندوق">
      <Card className="p-4">
        <CardHeader className="flex flex-row items-center gap-2 p-0 pb-3">
          <Icon
            name="policy"
            size={20}
            className="text-status-critical-fg"
            data-slot="icon"
          />
          <CardTitle className="text-title-md">الزامات و ضوابط بازرسی</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 p-0 text-body-sm text-text-secondary">
          <div className="rounded-lg bg-surface-muted p-3">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-text-primary">
              <Icon
                name="check_circle"
                size={16}
                className="text-primary"
                data-slot="icon"
              />
              <span>تحویل فیزیکی پوکه آمپول‌ها</span>
            </div>
            <p>
              در قبال تحویل هر ویال یا آمپول مرفین و پتیدین جدید، تحویل پوکه
              مصرف‌شده با مهر مرکز درمانی یا پزشک الزامی است.
            </p>
          </div>
          <div className="rounded-lg bg-surface-muted p-3">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-text-primary">
              <Icon
                name="check_circle"
                size={16}
                className="text-primary"
                data-slot="icon"
              />
              <span>دفاتر ممهور معاونت درمان</span>
            </div>
            <p>
              کلیه ردیف‌های دفترچه غیرقابل‌ویرایش بوده و با سربرگ سربی و
              صفحات شماره‌گذاری‌شده دانشگاه مطابقت ثبتی دارد.
            </p>
          </div>
          <div className="rounded-lg bg-surface-muted p-3">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-text-primary">
              <Icon
                name="check_circle"
                size={16}
                className="text-primary"
                data-slot="icon"
              />
              <span>احراز هویت دوعاملی گیرنده</span>
            </div>
            <p>
              ثبت کدملی دقیق گیرنده یا وکیل قانونی و تطبیق شناسه یکتای TTAC /
              سپاس پیش از ترخیص از گاوصندوق الزامی است.
            </p>
          </div>
          <div className="flex items-center justify-between border-t border-border-subtle pt-3 text-label-sm">
            <span>خط گرم بازرسی TTAC:</span>
            <span className="tabular-nums-data font-bold text-status-critical-fg">
              ۱۹۰ (داخلی ۳)
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="p-4" data-testid="controlled-vault-snapshot">
        <CardHeader className="flex flex-row items-center justify-between p-0 pb-3">
          <CardTitle className="text-title-md">
            موجودی تفکیکی اقلام تحت کنترل
          </CardTitle>
          <Icon
            name="emergency"
            size={18}
            className="text-text-secondary"
            data-slot="icon"
          />
        </CardHeader>
        <CardContent className="space-y-2 p-0">
          {vaultItems.length === 0 ? (
            <p className="rounded-lg bg-surface-muted p-3 text-body-sm text-text-secondary">
              داروی تحت کنترلی در کاتالوگ ثبت نشده است.
            </p>
          ) : (
            vaultItems.map((item) => {
              const active = selectedDrugId === item.drugId
              return (
                <button
                  key={item.drugId}
                  type="button"
                  onClick={() =>
                    onSelectDrug(active ? 'all' : item.drugId)
                  }
                  className={cn(
                    'ps-focus-ring flex w-full items-center justify-between rounded-lg border p-2.5 text-start transition-colors',
                    active
                      ? 'border-primary bg-primary-tint/60'
                      : 'border-transparent bg-surface-muted hover:bg-surface-subtle',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        'size-2 shrink-0 rounded-full',
                        item.isLowStock ? 'bg-status-critical-fg' : 'bg-primary',
                      )}
                      aria-hidden
                    />
                    <span className="truncate text-label-md font-medium text-text-primary">
                      {item.nameFa}
                      {item.isLowStock ? ' (هشدار کسری)' : ''}
                    </span>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 tabular-nums-data text-label-md font-bold',
                      item.isLowStock
                        ? 'text-status-critical-fg'
                        : 'text-primary',
                    )}
                  >
                    {formatPersianNumber(item.availableStock)} {item.unitLabel}
                  </span>
                </button>
              )
            })
          )}
          <Button
            type="button"
            variant="secondary"
            className="mt-2 w-full"
            onClick={() => router.push('/auto-reorder-suggestions')}
          >
            <Icon name="sync_alt" size={16} data-slot="icon" />
            درخواست تخصیص سهمیه اضطراری
          </Button>
        </CardContent>
      </Card>

      <Card className="p-4 text-center">
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary-tint text-primary">
          <Icon name="approval" size={24} data-slot="icon" />
        </div>
        <h3 className="text-title-sm font-bold text-text-primary">
          امضا و تایید الکترونیک مسئول فنی
        </h3>
        <p className="mt-1 text-body-sm text-text-secondary">
          {operatorName} · {operatorRoleLabel}
        </p>
        <div
          dir="ltr"
          className="mt-3 rounded-lg bg-surface-muted px-3 py-2 font-latin tabular-nums-data text-label-sm text-text-secondary"
        >
          کلید توکن امضا: {toPersianDigits('09F-E3-991-SEC')}
        </div>
      </Card>
    </aside>
  )
}
