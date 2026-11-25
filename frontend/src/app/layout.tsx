import type { Metadata } from 'next'
import '@fontsource-variable/vazirmatn'
import '@fontsource-variable/inter'
import 'material-symbols/outlined.css'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppearanceProvider } from '@/lib/settings/appearance-context'
import { DEFAULT_THEME_ID } from '@/tokens'

export const metadata: Metadata = {
  title: 'انبار دارو · PharmaStock',
  description: 'سامانه مدیریت موجودی و انبار داروخانه',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fa" dir="rtl" data-theme={DEFAULT_THEME_ID}>
      <body className="min-h-screen bg-background text-text-primary antialiased">
        <AppearanceProvider>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </AppearanceProvider>
      </body>
    </html>
  )
}
