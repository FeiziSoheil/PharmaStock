import type { Metadata } from 'next'
import { AutoReorderSuggestionsView } from './auto-reorder-suggestions-view'

export const metadata: Metadata = {
  title: 'پیشنهاد سفارش خودکار | انبار دارو',
  description:
    'پیشنهاد هوشمند سفارش دارو بر اساس نقطه سفارش مجدد (ROP)، مصرف روزانه و موجودی ایمن',
}

export default function AutoReorderSuggestionsPage() {
  return <AutoReorderSuggestionsView />
}
