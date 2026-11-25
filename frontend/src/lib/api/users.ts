import type {
  CreateUserInput,
  RbacMatrixData,
  UpdateUserInput,
  UserAccount,
  UserDetail,
  UsersListResult,
} from '@/lib/types/users'
import { apiRequest } from './http'

export type UsersQueryParams = {
  search?: string
  role?: string
  status?: string
  branchId?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

export async function apiGetUsers(
  params: UsersQueryParams = {},
): Promise<UsersListResult> {
  return apiRequest<UsersListResult>('/api/v1/users', {
    query: {
      search: params.search,
      role: params.role || undefined,
      status: params.status || undefined,
      branchId: params.branchId || undefined,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortDir: params.sortDir,
    },
  })
}

export async function apiGetUser(id: string): Promise<UserDetail> {
  return apiRequest<UserDetail>(`/api/v1/users/${id}`)
}

export async function apiCreateUser(
  body: CreateUserInput,
): Promise<UserAccount> {
  return apiRequest<UserAccount>('/api/v1/users', {
    method: 'POST',
    body,
  })
}

export async function apiUpdateUser(
  id: string,
  body: UpdateUserInput,
): Promise<UserAccount> {
  return apiRequest<UserAccount>(`/api/v1/users/${id}`, {
    method: 'PATCH',
    body,
  })
}

export async function apiUpdateUserStatus(
  id: string,
  active: boolean,
): Promise<UserAccount> {
  return apiRequest<UserAccount>(`/api/v1/users/${id}/status`, {
    method: 'PATCH',
    body: { active },
  })
}

export async function apiUpdateUserPermissions(
  id: string,
  overrides: Record<string, boolean | null>,
): Promise<UserDetail> {
  return apiRequest<UserDetail>(`/api/v1/users/${id}/permissions`, {
    method: 'PUT',
    body: { overrides },
  })
}

export async function apiResetUserPassword(
  id: string,
  newPassword: string,
  unlock = false,
): Promise<UserAccount> {
  return apiRequest<UserAccount>(`/api/v1/users/${id}/reset-password`, {
    method: 'POST',
    body: { newPassword, unlock },
  })
}

export async function apiGetRbacMatrix(): Promise<RbacMatrixData> {
  return apiRequest<RbacMatrixData>('/api/v1/rbac/matrix')
}

export async function apiPutRbacMatrix(
  matrix: Record<string, Record<string, boolean>>,
): Promise<RbacMatrixData> {
  return apiRequest<RbacMatrixData>('/api/v1/rbac/matrix', {
    method: 'PUT',
    body: { matrix },
  })
}
