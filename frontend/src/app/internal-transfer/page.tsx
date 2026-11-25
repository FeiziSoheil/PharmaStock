import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AppShellPageFallback } from '@/components/layout'
import { InternalTransferView } from './internal-transfer-view'

export const metadata: Metadata = {
  title: 'انتقال داخلی | انبار دارو',
  description:
    'حواله انتقال داخلی کالا از انبار اصلی به پیشخوان تحویل نسخه با تخصیص بچ FEFO',
}

export default function InternalTransferPage() {
  return (
    <Suspense
      fallback={
        <AppShellPageFallback
          activeNavId="internal-transfer"
          message="در حال بارگذاری فرم انتقال داخلی…"
        />
      }
    >
      <InternalTransferView />
    </Suspense>
  )
}
