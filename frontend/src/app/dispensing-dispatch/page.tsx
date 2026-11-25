import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AppShellPageFallback } from '@/components/layout'
import { DispensingDispatchView } from './dispensing-dispatch-view'

export const metadata: Metadata = {
  title: 'میز کار نسخه‌پیچی و صدور حواله خروج کالا | انبار دارو',
  description:
    'پردازش اقلام تجویزی، تخصیص FEFO، تایید مسئول فنی و صدور حواله خروج از انبار',
}

export default function DispensingDispatchPage() {
  return (
    <Suspense
      fallback={
        <AppShellPageFallback
          activeNavId="dispensing"
          message="در حال بارگذاری میز کار نسخه‌پیچی…"
        />
      }
    >
      <DispensingDispatchView />
    </Suspense>
  )
}
