export type UserStatus = 'active' | 'inactive' | 'locked'

export type RbacRoleId =
  | 'super_admin'
  | 'technical_officer'
  | 'warehouse_lead'
  | 'dispensing_clerk'

export type UserAccount = {
  id: string
  username: string
  name: string
  email: string
  phone: string
  personnelCode: string
  medicalCouncilNo?: string
  role: string
  branchId: string
  unitLabel: string
  status: UserStatus
  active: boolean
  permanentlyLocked: boolean
  customPermissions?: Record<string, boolean>
  lastLoginAt?: string
  lastLoginIp?: string
  lastLoginDevice?: string
  createdAt?: string
  updatedAt?: string
}

export type UserDetail = UserAccount & {
  effectivePermissions: Record<string, boolean>
}

export type UsersKpis = {
  totalUsers: number
  activeUsers: number
  technicalOfficers: number
  sensitivePermissions: number
  lastAccessChangeAt?: string
  auditCoveragePercent: number
}

export type BranchOption = {
  id: string
  nameFa: string
  active: boolean
}

export type UsersListResult = {
  items: UserAccount[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  kpis: UsersKpis
  branches: BranchOption[]
}

export type RbacRoleDefinition = {
  id: string
  label: string
  subtitle: string
  highlight?: boolean
}

export type RbacPermissionDefinition = {
  id: string
  label: string
  group: string
  badge?: string
  sensitive?: boolean
}

export type RbacCellLock = {
  forcedValue: boolean
  variant: 'exclusive' | 'forbidden' | 'disabled'
  label?: string
}

export type RbacMatrixData = {
  roles: RbacRoleDefinition[]
  permissions: RbacPermissionDefinition[]
  matrix: Record<string, Record<string, boolean>>
  lockedCells: Record<string, Record<string, RbacCellLock>>
  updatedAt?: string
  updatedBy?: string
}

export type CreateUserInput = {
  username: string
  name: string
  email: string
  phone: string
  personnelCode: string
  medicalCouncilNo?: string
  role: string
  branchId: string
  unitLabel: string
  password: string
  active?: boolean
}

export type UpdateUserInput = {
  name: string
  email: string
  phone: string
  personnelCode: string
  medicalCouncilNo?: string
  role: string
  branchId: string
  unitLabel: string
  active?: boolean
}
