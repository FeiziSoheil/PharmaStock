export type PharmacyIdentity = {
  nameFa: string
  branchNameFa: string
  branchId: string
  licenseNumber: string
  technicalOfficer: string
  medicalCouncilNo: string
  phone: string
  address: string
  printFooterNotice: string
}

export type InventoryRules = {
  criticalExpiryDays: number
  warningExpiryDays: number
  watchExpiryDays: number
  criticalCoverDays: number
  lowCoverDays: number
  reorderCycleDays: number
  safetyStockFactor: number
  strictFefoEnforced: boolean
  requireDualSignOff: boolean
}

export type TTACIntegration = {
  baseUrl: string
  timeoutMs: number
  cacheTtlHours: number
  liveLookupActive: boolean
  autoCacheMisses: boolean
}

export type SecurityConfig = {
  sessionTimeoutHours: number
  auditAllMutations: boolean
  enforceStrongPassword: boolean
}

export type SystemSettings = {
  id: string
  pharmacyIdentity: PharmacyIdentity
  inventoryRules: InventoryRules
  ttacIntegration: TTACIntegration
  securityConfig: SecurityConfig
  updatedAt: string
  updatedBy: string
}

export type TestTTACResult = {
  success: boolean
  latencyMs: number
  message: string
  baseUrl: string
}
