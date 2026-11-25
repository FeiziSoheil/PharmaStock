import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AppShellPageFallback } from '@/components/layout'
import { DrugDetailsView } from './drug-details-view'

export const metadata: Metadata = {
  title: 'جزئیات دارو و کاردکس | انبار دارو',
  description: 'پروفایل دارو، سری‌های ساخت و کاردکس انبار',
}

export default function DrugDetailsCardexPage() {
  return (
    <Suspense
      fallback={
        <AppShellPageFallback
          activeNavId="catalog"
          message="در حال بارگذاری جزئیات دارو و کاردکس…"
        />
      }
    >
      <DrugDetailsView />
    </Suspense>
  )
}
