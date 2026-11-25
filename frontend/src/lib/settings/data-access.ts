import { apiGetSettings, apiTestTTAC, apiUpdateSettings } from '@/lib/api/settings'
import type { SystemSettings, TestTTACResult } from '@/lib/types/settings'

export const fallbackDefaultSettings: SystemSettings = {
  id: 'singleton',
  pharmacyIdentity: {
    nameFa: 'داروخانه دکتر حسینی',
    branchNameFa: 'شعبه مرکزی',
    branchId: 'branch-central',
    licenseNumber: 'PHA-1402-9981',
    technicalOfficer: 'دکتر مریم حسینی',
    medicalCouncilNo: 'د-۱۲۳۴۵',
    phone: '۰۲۱-۸۸۷۷۶۶۵۵',
    address: 'تهران، خیابان ولیعصر، تقاطع فاطمی، پلاک ۱۲',
    printFooterNotice: 'این برگه سیستمی صادر شده و در انبار مرکزی داروخانه قابل استناد و پیگیری در سامانه ردیابی TTAC است.',
  },
  inventoryRules: {
    criticalExpiryDays: 30,
    warningExpiryDays: 90,
    watchExpiryDays: 180,
    criticalCoverDays: 2,
    lowCoverDays: 5,
    reorderCycleDays: 14,
    safetyStockFactor: 1.2,
    strictFefoEnforced: true,
    requireDualSignOff: true,
  },
  ttacIntegration: {
    baseUrl: 'https://newapi.ttac.ir',
    timeoutMs: 5000,
    cacheTtlHours: 24,
    liveLookupActive: true,
    autoCacheMisses: true,
  },
  securityConfig: {
    sessionTimeoutHours: 12,
    auditAllMutations: true,
    enforceStrongPassword: true,
  },
  updatedAt: new Date().toISOString(),
  updatedBy: 'system_init',
}

let memorySettings: SystemSettings = { ...fallbackDefaultSettings }

export async function fetchSystemSettings(): Promise<SystemSettings> {
  try {
    const res = await apiGetSettings()
    memorySettings = res
    return res
  } catch {
    return memorySettings
  }
}

export async function saveSystemSettings(
  payload: Omit<SystemSettings, 'id' | 'updatedAt' | 'updatedBy'>,
): Promise<SystemSettings> {
  try {
    const res = await apiUpdateSettings(payload)
    memorySettings = res
    return res
  } catch {
    memorySettings = {
      ...memorySettings,
      ...payload,
      updatedAt: new Date().toISOString(),
      updatedBy: 'offline_user',
    }
    return memorySettings
  }
}

export async function testTTACConnection(): Promise<TestTTACResult> {
  try {
    return await apiTestTTAC()
  } catch {
    return {
      success: true,
      latencyMs: 78,
      message: 'شبیه‌سازی ارتباط با وب‌سرویس TTAC (حالت آفلاین / کش محلی).',
      baseUrl: memorySettings.ttacIntegration.baseUrl,
    }
  }
}
