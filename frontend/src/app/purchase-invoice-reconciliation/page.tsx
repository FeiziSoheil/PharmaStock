import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AppShellPageFallback } from '@/components/layout'
import { PurchaseReconciliationView } from './purchase-reconciliation-view'

export const metadata: Metadata = {
  title: 'فاکتور خرید (اکسل و تطبیق) | انبار دارو',
  description:
    'ورود فاکتورهای صادره از شرکت‌های پخش، تطبیق خودکار ستون‌ها و اعتبارسنجی کاتالوگ دارو با پایگاه داده سازمان غذا و دارو (تی‌تک)',
}

export default function PurchaseInvoiceReconciliationPage() {
  return (
    <Suspense
      fallback={
        <AppShellPageFallback
          activeNavId="purchase-reconciliation"
          message="در حال بارگذاری سامانه تطبیق فاکتور خرید…"
        />
      }
    >
      <PurchaseReconciliationView />
    </Suspense>
  )
}
