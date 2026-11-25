import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfileView } from '@/app/profile/profile-view'
import { TooltipProvider } from '@/components/ui/tooltip'
import * as profileApi from '@/lib/api/profile'
import * as sessionModule from '@/lib/api/session'

function renderProfileView() {
  return render(
    <TooltipProvider>
      <ProfileView />
    </TooltipProvider>,
  )
}

const mockProfile: profileApi.ProfileMe = {
  id: 'user-rezaei',
  username: 'dr.rezaei',
  name: 'دکتر محمدرضا رضایی',
  email: 'rezaei@pharmastock.ir',
  phone: '09121111111',
  personnelCode: 'MED-1001',
  medicalCouncilNo: '۱۴۰۳-۹۹',
  role: 'technical_officer',
  branchId: 'branch-central',
  branchNameFa: 'داروخانه مرکزی - انبار شماره ۱',
  unitLabel: 'واحد بالینی و کنترل کیفی',
  status: 'active',
  lastLoginAt: '2026-11-12T01:30:00Z',
  lastLoginIp: '192.168.1.100',
  lastLoginDevice: 'Chrome Linux',
}

describe('ProfileView', () => {
  beforeEach(() => {
    vi.spyOn(profileApi, 'apiGetMe').mockResolvedValue(mockProfile)
    vi.spyOn(profileApi, 'apiUpdateMe').mockResolvedValue({
      ...mockProfile,
      name: 'دکتر محمدرضا رضایی جدید',
      email: 'new.rezaei@pharmastock.ir',
    })
    vi.spyOn(profileApi, 'apiChangePassword').mockResolvedValue({
      ok: true,
      message: 'رمز عبور با موفقیت تغییر یافت',
    })
    vi.spyOn(sessionModule, 'updateSessionUser').mockReturnValue({
      id: 'user-rezaei',
      username: 'dr.rezaei',
      name: 'دکتر محمدرضا رضایی جدید',
      role: 'technical_officer',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders Persian main heading and read-only organizational details', async () => {
    renderProfileView()

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'پروفایل و تنظیمات حساب کاربری',
      }),
    ).toBeInTheDocument()

    expect(screen.getByText('dr.rezaei')).toBeInTheDocument()
    expect(screen.getByText('MED-1001')).toBeInTheDocument()
    expect(screen.getByText('واحد بالینی و کنترل کیفی')).toBeInTheDocument()
    expect(
      screen.getAllByText('داروخانه مرکزی - انبار شماره ۱').length,
    ).toBeGreaterThanOrEqual(1)
  })

  it('validates empty name on profile form submission', async () => {
    const user = userEvent.setup()
    renderProfileView()

    await screen.findByRole('heading', {
      level: 1,
      name: 'پروفایل و تنظیمات حساب کاربری',
    })

    const nameInput = screen.getByLabelText('نام و نام خانوادگی')
    await user.clear(nameInput)

    const saveButton = screen.getByRole('button', { name: 'ذخیره تغییرات' })
    await user.click(saveButton)

    expect(
      screen.getByText('نام و نام خانوادگی الزامی است'),
    ).toBeInTheDocument()
    expect(profileApi.apiUpdateMe).not.toHaveBeenCalled()
  })

  it('updates profile and syncs session user on valid submission', async () => {
    const user = userEvent.setup()
    renderProfileView()

    await screen.findByRole('heading', {
      level: 1,
      name: 'پروفایل و تنظیمات حساب کاربری',
    })

    const nameInput = screen.getByLabelText('نام و نام خانوادگی')
    await user.clear(nameInput)
    await user.type(nameInput, 'دکتر محمدرضا رضایی جدید')

    const saveButton = screen.getByRole('button', { name: 'ذخیره تغییرات' })
    await user.click(saveButton)

    await waitFor(() => {
      expect(profileApi.apiUpdateMe).toHaveBeenCalledWith({
        name: 'دکتر محمدرضا رضایی جدید',
        email: 'rezaei@pharmastock.ir',
        phone: '09121111111',
      })
    })

    expect(sessionModule.updateSessionUser).toHaveBeenCalledWith({
      name: 'دکتر محمدرضا رضایی جدید',
    })
  })

  it('validates password change and updates password successfully', async () => {
    const user = userEvent.setup()
    renderProfileView()

    await screen.findByRole('heading', {
      level: 1,
      name: 'پروفایل و تنظیمات حساب کاربری',
    })

    const changeBtn = screen.getByRole('button', { name: 'تغییر رمز عبور' })
    await user.click(changeBtn)

    expect(screen.getByText('رمز عبور فعلی الزامی است')).toBeInTheDocument()

    const currentPass = screen.getByLabelText('رمز عبور فعلی')
    const newPass = screen.getByLabelText('رمز عبور جدید')
    const confirmPass = screen.getByLabelText('تکرار رمز عبور جدید')

    await user.type(currentPass, 'OldSecret123')
    await user.type(newPass, 'NewSecret2026')
    await user.type(confirmPass, 'Mismatched2026')
    await user.click(changeBtn)

    expect(
      screen.getByText('تکرار رمز عبور با رمز جدید مطابقت ندارد'),
    ).toBeInTheDocument()

    await user.clear(confirmPass)
    await user.type(confirmPass, 'NewSecret2026')
    await user.click(changeBtn)

    await waitFor(() => {
      expect(profileApi.apiChangePassword).toHaveBeenCalledWith({
        currentPassword: 'OldSecret123',
        newPassword: 'NewSecret2026',
      })
    })
  })
})
