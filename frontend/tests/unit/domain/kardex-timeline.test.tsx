import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  KardexTimeline,
  type KardexTimelineItem,
} from '@/components/domain/kardex-timeline'

const ITEMS: KardexTimelineItem[] = [
  {
    id: '1',
    title: 'ورود فاکتور خرید #ف-۱۴۰۳/۸۹۱',
    description: '۱۸ کارتن آنتی‌بیوتیک اسکن شد',
    timestamp: '۳۵ دقیقه پیش',
    meta: 'توسط انباردار: محسنی',
    tone: 'primary',
    deltaIn: '+۵۰۰',
    balance: '۱,۲۶۰',
  },
  {
    id: '2',
    title: 'نسخه‌پیچی نسخه #۹۸۲۳۴',
    timestamp: '۱ ساعت پیش',
    tone: 'outbound',
    deltaOut: '۱۰ جعبه',
  },
  {
    id: '3',
    title: 'اخطار خودکار قرنطینه',
    description: 'انتقال ویال منقضی به باکس قرنطینه',
    timestamp: '۲ ساعت پیش',
    meta: 'سیستم: عدم صدور برگه ترخیص دارو',
    tone: 'alert',
    icon: 'warning',
  },
]

describe('KardexTimeline', () => {
  it('renders items in order', () => {
    render(<KardexTimeline items={ITEMS} />)

    const list = screen.getByRole('list', { name: 'کاردکس رویدادها' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('ورود فاکتور خرید #ف-۱۴۰۳/۸۹۱')
    expect(rows[1]).toHaveTextContent('نسخه‌پیچی نسخه #۹۸۲۳۴')
    expect(rows[2]).toHaveTextContent('اخطار خودکار قرنطینه')
  })

  it('shows empty state', () => {
    render(<KardexTimeline items={[]} emptyLabel="هیچ رویدادی نیست" />)

    expect(screen.getByRole('status')).toHaveTextContent('هیچ رویدادی نیست')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('exposes data-slot="kardex-timeline"', () => {
    const { container } = render(<KardexTimeline items={ITEMS} />)
    expect(container.querySelector('[data-slot="kardex-timeline"]')).not.toBeNull()

    const { container: empty } = render(<KardexTimeline items={[]} />)
    expect(empty.querySelector('[data-slot="kardex-timeline"]')).not.toBeNull()
  })

  it('shows tone and icon for alert item', () => {
    render(<KardexTimeline items={ITEMS} />)

    const alertRow = screen
      .getByText('اخطار خودکار قرنطینه')
      .closest('li')
    expect(alertRow).toHaveAttribute('data-tone', 'alert')

    const icon = alertRow?.querySelector('[data-slot="icon"]')
    expect(icon).not.toBeNull()
    expect(icon).toHaveAttribute('data-icon-requested', 'warning')
  })
})
