import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  RbacPermissionMatrix,
  type RbacPermission,
  type RbacRole,
} from '@/components/domain/rbac-permission-matrix'

const ROLES: RbacRole[] = [
  { id: 'admin', label: 'مدیر سامانه' },
  { id: 'pharmacist', label: 'داروساز مسئول فنی', highlight: true },
  { id: 'clerk', label: 'متصدی نسخه' },
]

const PERMISSIONS: RbacPermission[] = [
  {
    id: 'view-catalog',
    label: 'مشاهده کاتالوگ',
    group: 'مدیریت کاتالوگ',
  },
  {
    id: 'adjust-stock',
    label: 'ثبت تعدیل موجودی',
    group: 'انبارداری',
  },
]

const VALUE = {
  'view-catalog': {
    admin: true,
    pharmacist: true,
    clerk: false,
  },
  'adjust-stock': {
    admin: true,
    pharmacist: true,
    clerk: false,
  },
}

describe('RbacPermissionMatrix', () => {
  it('renders roles and permissions', () => {
    render(
      <RbacPermissionMatrix
        roles={ROLES}
        permissions={PERMISSIONS}
        value={VALUE}
      />,
    )

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('مدیر سامانه')).toBeInTheDocument()
    expect(screen.getByText('داروساز مسئول فنی')).toBeInTheDocument()
    expect(screen.getByText('متصدی نسخه')).toBeInTheDocument()
    expect(screen.getByText('مشاهده کاتالوگ')).toBeInTheDocument()
    expect(screen.getByText('ثبت تعدیل موجودی')).toBeInTheDocument()
    expect(screen.getByText('مدیریت کاتالوگ')).toBeInTheDocument()
    expect(screen.getByText('انبارداری')).toBeInTheDocument()
  })

  it('toggles checkbox and calls onChange with ids', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <RbacPermissionMatrix
        roles={ROLES}
        permissions={PERMISSIONS}
        value={VALUE}
        onChange={onChange}
      />,
    )

    const checkbox = screen.getByRole('checkbox', {
      name: 'مشاهده کاتالوگ — متصدی نسخه',
    })
    expect(checkbox).toHaveAttribute('aria-checked', 'false')

    await user.click(checkbox)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('view-catalog', 'clerk', true)
  })

  it('does not toggle a disabled cell', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <RbacPermissionMatrix
        roles={ROLES}
        permissions={PERMISSIONS}
        value={VALUE}
        disabledCells={{ 'adjust-stock': { clerk: true } }}
        onChange={onChange}
      />,
    )

    const checkbox = screen.getByRole('checkbox', {
      name: 'ثبت تعدیل موجودی — متصدی نسخه',
    })
    expect(checkbox).toBeDisabled()

    await user.click(checkbox)

    expect(onChange).not.toHaveBeenCalled()
  })

  it('has data-slot=rbac-permission-matrix', () => {
    const { container } = render(
      <RbacPermissionMatrix
        roles={ROLES}
        permissions={PERMISSIONS}
        value={VALUE}
      />,
    )

    expect(
      container.querySelector('[data-slot="rbac-permission-matrix"]'),
    ).toBeInTheDocument()
  })

  it('renders exclusive and forbidden regulatory lock badges when cellMeta is provided', () => {
    render(
      <RbacPermissionMatrix
        roles={[
          { id: 'super_admin', label: 'مدیر سامانه', subtitle: 'Super Admin' },
          { id: 'technical_officer', label: 'مسئول فنی', highlight: true },
        ]}
        permissions={[
          {
            id: 'controlled',
            label: 'تأییدیه داروهای تحت کنترل',
            badge: 'الزام قانونی غذا و دارو',
            sensitive: true,
          },
        ]}
        value={{ controlled: { super_admin: false, technical_officer: true } }}
        cellMeta={{
          controlled: {
            super_admin: { variant: 'forbidden', label: 'غیرمجاز فنی' },
            technical_officer: { variant: 'exclusive', label: 'انحصار مسئول فنی' },
          },
        }}
      />,
    )

    expect(screen.getByText('الزام قانونی غذا و دارو')).toBeInTheDocument()
    expect(screen.getByText('غیرمجاز فنی')).toBeInTheDocument()
    expect(screen.getByText('انحصار مسئول فنی')).toBeInTheDocument()
  })
})
