import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  Stepper,
  type StepperStep,
} from '@/components/domain/stepper'

const STEPS: StepperStep[] = [
  {
    id: 'invoice',
    label: 'مشخصات فاکتور و شرکت پخش',
    description: 'داروپخش • ف-۱۴۰۳/۸۹۱',
    meta: 'گام ۱ • پایان‌یافته',
    status: 'completed',
  },
  {
    id: 'scan',
    label: 'اسکن بارکد، بچ و اقلام دارویی',
    description: '۳ قلم از ۵ قلم درج گردیده',
    meta: 'گام ۲ • در حال پردازش',
    status: 'current',
  },
  {
    id: 'reconcile',
    label: 'تطبیق نهایی، قفسه و کاردکس',
    description: 'تایید حسابداری و ورود قطعی',
    meta: 'گام ۳ • مرحله آتی',
    status: 'upcoming',
  },
]

describe('Stepper', () => {
  it('renders Persian labels and statuses', () => {
    render(<Stepper steps={STEPS} />)

    expect(screen.getByText('مشخصات فاکتور و شرکت پخش')).toBeInTheDocument()
    expect(screen.getByText('اسکن بارکد، بچ و اقلام دارویی')).toBeInTheDocument()
    expect(screen.getByText('تطبیق نهایی، قفسه و کاردکس')).toBeInTheDocument()
    expect(screen.getByText('گام ۱ • پایان‌یافته')).toBeInTheDocument()
    expect(screen.getByText('گام ۲ • در حال پردازش')).toBeInTheDocument()
    expect(screen.getByText('گام ۳ • مرحله آتی')).toBeInTheDocument()
  })

  it('marks current step with aria-current', () => {
    render(<Stepper steps={STEPS} />)

    const current = screen.getByText('اسکن بارکد، بچ و اقلام دارویی').closest('li')
    expect(current).toHaveAttribute('aria-current', 'step')

    const completed = screen.getByText('مشخصات فاکتور و شرکت پخش').closest('li')
    expect(completed).not.toHaveAttribute('aria-current')
  })

  it('calls onStepSelect when clicking a completed step', async () => {
    const user = userEvent.setup()
    const onStepSelect = vi.fn()
    render(<Stepper steps={STEPS} onStepSelect={onStepSelect} />)

    await user.click(screen.getByRole('button', { name: /مشخصات فاکتور و شرکت پخش/ }))
    expect(onStepSelect).toHaveBeenCalledTimes(1)
    expect(onStepSelect).toHaveBeenCalledWith('invoice')
  })

  it('has data-slot=stepper', () => {
    render(<Stepper steps={STEPS} />)
    expect(screen.getByRole('navigation', { name: 'مراحل' })).toHaveAttribute(
      'data-slot',
      'stepper',
    )
  })
})
