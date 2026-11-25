import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AppShellPageFallback } from '@/components/layout'
import { UsersPermissionsView } from './users-permissions-view'

export const metadata: Metadata = {
  title: 'مدیریت کاربران و ماتریس دسترسی‌ها | انبار دارو',
  description:
    'پیکربندی سطح دسترسی، تفکیک وظایف دارویی و مدیریت کاربران سامانه انبار دارو',
}

export default function UsersPermissionsPage() {
  return (
    <Suspense
      fallback={
        <AppShellPageFallback
          activeNavId="users-permissions"
          message="در حال بارگذاری مدیریت کاربران و ماتریس دسترسی‌ها…"
        />
      }
    >
      <UsersPermissionsView />
    </Suspense>
  )
}
