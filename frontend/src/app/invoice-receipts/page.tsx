import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AppShellPageFallback } from '@/components/layout'
import { InvoiceReceiptsView } from './invoice-receipts-view'

export const metadata: Metadata = {
  title: 'ورود فاکتور و رسید انبار | انبار دارو',
  description:
    'ثبت فاکتور شرکت پخش، بارکد اسکن، تطبیق سری ساخت و قیمت‌گذاری مصوب سازمان غذا و دارو',
}

export default function InvoiceReceiptsPage() {
  return (
    <Suspense
      fallback={
        <AppShellPageFallback
          activeNavId="receipts"
          message="در حال بارگذاری ورود فاکتور…"
        />
      }
    >
      <InvoiceReceiptsView />
    </Suspense>
  )
}
