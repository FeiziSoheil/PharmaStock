import { render, screen } from '@testing-library/react'
import { cva } from 'class-variance-authority'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HomePage from '@/app/page'
import { cn } from '@/lib/utils'

const replaceMock = vi.fn()
const getTokenMock = vi.fn<() => string | null>(() => null)

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}))

vi.mock('@/lib/api/session', () => ({
  getToken: () => getTokenMock(),
}))

const sampleBadge = cva('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs', {
  variants: {
    tone: {
      default: 'bg-[var(--ps-primary)] text-white',
      neutral: 'bg-slate-100 text-slate-800',
    },
  },
  defaultVariants: {
    tone: 'default',
  },
})

describe('Bootstrap Smoke', () => {
  beforeEach(() => {
    replaceMock.mockReset()
    getTokenMock.mockReturnValue(null)
  })

  it('redirects unauthenticated root visits to /login with Persian status text', () => {
    render(<HomePage />)
    expect(screen.getByText('در حال انتقال…')).toBeInTheDocument()
    expect(replaceMock).toHaveBeenCalledWith('/login')
  })

  it('redirects authenticated root visits to /dashboard', () => {
    getTokenMock.mockReturnValue('jwt-token')
    render(<HomePage />)
    expect(replaceMock).toHaveBeenCalledWith('/dashboard')
  })

  it('merges classes via cn and resolves CVA variants', () => {
    const merged = cn('px-2 py-1', 'px-4', false && 'hidden')
    expect(merged).toBe('py-1 px-4')
    expect(sampleBadge({ tone: 'neutral' })).toContain('bg-slate-100')
  })
})
