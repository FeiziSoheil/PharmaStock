import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AppShellPageFallback } from '@/components/layout'
import { ControlledLedgerView } from './controlled-ledger-view'

export const metadata: Metadata = {
  title: 'دفترچه داروهای تحت کنترل و مخدر | انبار دارو',
  description:
    'ثبت و پایش قانونی گردش فرآورده‌های تحت کنترل و مخدر، تطبیق موجودی گاوصندوق، تایید مسئول فنی و گزارش بازرسی TTAC',
}

export default function ControlledSubstancesLedgerPage() {
  return (
    <Suspense
      fallback={
        <AppShellPageFallback
          activeNavId="controlled-substances"
          message="در حال بارگذاری دفترچه داروهای تحت کنترل و مخدر…"
        />
      }
    >
      <ControlledLedgerView />
    </Suspense>
  )
}
