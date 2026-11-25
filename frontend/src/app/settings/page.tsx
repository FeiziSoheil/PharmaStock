import type { Metadata } from 'next'
import { SettingsView } from './settings-view'

export const metadata: Metadata = {
  title: 'تنظیمات سیستم و انبار دارو | فارما استاک',
  description: 'پیکربندی هویت داروخانه، قوانین FEFO، ارتباط با سامانه تیتک و کنترل‌های امنیتی',
}

export default function SettingsPage() {
  return <SettingsView />
}
