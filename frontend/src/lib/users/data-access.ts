import {
  apiCreateUser,
  apiGetRbacMatrix,
  apiGetUser,
  apiGetUsers,
  apiPutRbacMatrix,
  apiResetUserPassword,
  apiUpdateUser,
  apiUpdateUserPermissions,
  apiUpdateUserStatus,
  type UsersQueryParams,
} from '@/lib/api/users'
import type {
  CreateUserInput,
  RbacMatrixData,
  UpdateUserInput,
  UserAccount,
  UserDetail,
  UsersListResult,
} from '@/lib/types/users'

export async function fetchUsers(
  params: UsersQueryParams = {},
): Promise<UsersListResult> {
  return apiGetUsers(params)
}

export async function fetchUserDetail(id: string): Promise<UserDetail> {
  return apiGetUser(id)
}

export async function createUserAccount(
  input: CreateUserInput,
): Promise<UserAccount> {
  return apiCreateUser(input)
}

export async function updateUserAccount(
  id: string,
  input: UpdateUserInput,
): Promise<UserAccount> {
  return apiUpdateUser(id, input)
}

export async function toggleUserAccountStatus(
  id: string,
  active: boolean,
): Promise<UserAccount> {
  return apiUpdateUserStatus(id, active)
}

export async function saveUserCustomPermissions(
  id: string,
  overrides: Record<string, boolean | null>,
): Promise<UserDetail> {
  return apiUpdateUserPermissions(id, overrides)
}

export async function resetUserAccountPassword(
  id: string,
  newPassword: string,
  unlock = false,
): Promise<UserAccount> {
  return apiResetUserPassword(id, newPassword, unlock)
}

export async function fetchRbacMatrix(): Promise<RbacMatrixData> {
  return apiGetRbacMatrix()
}

export async function saveRbacMatrix(
  matrix: Record<string, Record<string, boolean>>,
): Promise<RbacMatrixData> {
  return apiPutRbacMatrix(matrix)
}
