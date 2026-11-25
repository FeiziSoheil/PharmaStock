import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { KpiMetricCard } from '@/components/shared/kpi-metric-card'

describe('KpiMetricCard', () => {
  it('renders title, value, and delta', () => {
    render(
      <KpiMetricCard
        title="موجودی کم"
        value="۳۶"
        tone="warning"
        delta={{ label: '+۲ این هفته', direction: 'up' }}
      />,
    )
    expect(screen.getByText('موجودی کم')).toBeInTheDocument()
    expect(screen.getByText('۳۶')).toBeInTheDocument()
    expect(screen.getByText('+۲ این هفته')).toBeInTheDocument()
    expect(screen.getByText('+۲ این هفته').closest('[data-slot="kpi-delta"]')).toHaveAttribute(
      'data-direction',
      'up',
    )
  })

  it('allows block-level value content without wrapping in a paragraph', () => {
    render(
      <KpiMetricCard
        title="تفکیک پخش‌ها"
        value={
          <div data-testid="kpi-block-value">
            <div>پخش الف</div>
          </div>
        }
      />,
    )
    const block = screen.getByTestId('kpi-block-value')
    expect(block.closest('p')).toBeNull()
    expect(block.parentElement?.tagName).toBe('DIV')
  })
})
