import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AppShellPageFallback } from '@/components/layout'
import { AuditLogView } from './audit-log-view'

export const metadata: Metadata = {
  title: 'گزارش و لاگ وقایع - ممیزی | انبار دارو',
  description: 'دفتر ثبت رویدادهای غیرقابل تغییر سامانه انبار دارو',
}

export default function AuditLogPage() {
  return (
    <Suspense
      fallback={
        <AppShellPageFallback
          activeNavId="audit-log"
          message="در حال بارگذاری لاگ ممیزی…"
        />
      }
    >
      <AuditLogView />
    </Suspense>
  )
}
