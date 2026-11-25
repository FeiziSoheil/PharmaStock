import { apiRequest } from './http'
import type { SystemSettings, TestTTACResult } from '@/lib/types/settings'

export async function apiGetSettings(): Promise<SystemSettings> {
  return apiRequest<SystemSettings>('/settings', { auth: true })
}

export async function apiUpdateSettings(
  input: Omit<SystemSettings, 'id' | 'updatedAt' | 'updatedBy'>,
): Promise<SystemSettings> {
  return apiRequest<SystemSettings>('/settings', {
    method: 'PUT',
    body: input,
    auth: true,
  })
}

export async function apiTestTTAC(): Promise<TestTTACResult> {
  return apiRequest<TestTTACResult>('/settings/test-ttac', {
    method: 'POST',
    auth: true,
  })
}
