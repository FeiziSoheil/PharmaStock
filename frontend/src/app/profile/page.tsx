import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AppShellPageFallback } from '@/components/layout'
import { ProfileView } from './profile-view'

export const metadata: Metadata = {
  title: 'پروفایل و تنظیمات حساب کاربری | انبار دارو',
  description: 'مشاهده مشخصات پرسنلی، ویرایش اطلاعات تماس و تغییر رمز عبور',
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <AppShellPageFallback message="در حال بارگذاری پروفایل کاربری…" />
      }
    >
      <ProfileView />
    </Suspense>
  )
}
