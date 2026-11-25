import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AppShellPageFallback } from '@/components/layout'
import { PeriodicStocktakeView } from './periodic-stocktake-view'

export const metadata: Metadata = {
  title: 'انبارگردانی دوره‌ای | انبار دارو',
  description:
    'مدیریت چرخه‌های انبارگردانی، شمارش فیزیکی کور و آشکار، پایش مغایرت‌های کاردکس و صدور سند تعدیل موجودی',
}

export default function PeriodicStocktakePage() {
  return (
    <Suspense
      fallback={
        <AppShellPageFallback
          activeNavId="periodic-stocktake"
          message="در حال بارگذاری سامانه انبارگردانی دوره‌ای…"
        />
      }
    >
      <PeriodicStocktakeView />
    </Suspense>
  )
}
