import { apiRequest } from './http'

export type ProfileMe = {
  id: string
  username: string
  name: string
  email: string
  phone: string
  personnelCode: string
  medicalCouncilNo?: string
  role: string
  branchId: string
  branchNameFa: string
  unitLabel: string
  status: 'active' | 'inactive' | 'locked'
  lastLoginAt?: string
  lastLoginIp?: string
  lastLoginDevice?: string
  createdAt?: string
  updatedAt?: string
}

export type UpdateProfileInput = {
  name: string
  email?: string
  phone?: string
}

export type ChangePasswordInput = {
  currentPassword: string
  newPassword: string
}

export type ChangePasswordResult = {
  ok: boolean
  message: string
}

export async function apiGetMe(): Promise<ProfileMe> {
  return apiRequest<ProfileMe>('/api/v1/auth/me')
}

export async function apiUpdateMe(
  body: UpdateProfileInput,
): Promise<ProfileMe> {
  return apiRequest<ProfileMe>('/api/v1/auth/me', {
    method: 'PATCH',
    body,
  })
}

export async function apiChangePassword(
  body: ChangePasswordInput,
): Promise<ChangePasswordResult> {
  return apiRequest<ChangePasswordResult>('/api/v1/auth/change-password', {
    method: 'POST',
    body,
  })
}
