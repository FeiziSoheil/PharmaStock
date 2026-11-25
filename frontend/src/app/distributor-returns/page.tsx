import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AppShellPageFallback } from '@/components/layout'
import { DistributorReturnsView } from './distributor-returns-view'

export const metadata: Metadata = {
  title: 'مرجوعی به شرکت‌های پخش | انبار دارو',
  description:
    'پایش خودکار بچ‌های در بازه مرجوعی قراردادی، تجمیع بر اساس شرکت پخش و صدور صورت‌جلسه رسمی استرداد کالا',
}

export default function DistributorReturnsPage() {
  return (
    <Suspense
      fallback={
        <AppShellPageFallback
          activeNavId="distributor-returns"
          message="در حال بارگذاری مدیریت مرجوعی به شرکت‌های پخش…"
        />
      }
    >
      <DistributorReturnsView />
    </Suspense>
  )
}
