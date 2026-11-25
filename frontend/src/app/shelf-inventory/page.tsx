import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AppShellPageFallback } from '@/components/layout'
import { ShelfInventoryView } from './shelf-inventory-view'

export const metadata: Metadata = {
  title: 'موجودی فیزیکی قفسه‌ها | انبار دارو',
  description: 'پایش موجودی به تفکیک موقعیت فیزیکی انبار با چیدمان FEFO',
}

export default function ShelfInventoryPage() {
  return (
    <Suspense
      fallback={
        <AppShellPageFallback
          activeNavId="shelf"
          message="در حال بارگذاری موجودی قفسه‌ها…"
        />
      }
    >
      <ShelfInventoryView />
    </Suspense>
  )
}
