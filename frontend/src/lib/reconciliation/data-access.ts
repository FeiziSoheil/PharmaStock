import {
  apiConfirmReconciliation,
  apiDeleteReconciliationRow,
  apiDownloadReconciliationTemplate,
  apiGetReconciliation,
  apiListReconciliations,
  apiPatchReconciliation,
  apiPatchReconciliationRow,
  apiRematchReconciliation,
  apiUpdateReconciliationMapping,
  apiUploadReconciliationFile,
  type DraftPatchBody,
  type MappingPatchBody,
  type RowPatchBody,
  type UploadReconciliationParams,
} from '@/lib/api/reconciliation'

export const downloadReconciliationTemplate = apiDownloadReconciliationTemplate
export const uploadReconciliationFile = apiUploadReconciliationFile
export const listReconciliations = apiListReconciliations
export const getReconciliation = apiGetReconciliation
export const patchReconciliation = apiPatchReconciliation
export const updateReconciliationMapping = apiUpdateReconciliationMapping
export const rematchReconciliation = apiRematchReconciliation
export const patchReconciliationRow = apiPatchReconciliationRow
export const deleteReconciliationRow = apiDeleteReconciliationRow
export const confirmReconciliation = apiConfirmReconciliation

export type {
  DraftPatchBody,
  MappingPatchBody,
  RowPatchBody,
  UploadReconciliationParams,
}
