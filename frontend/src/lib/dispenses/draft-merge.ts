type DraftFields = Record<string, string | boolean>

/**
 * After a blur-save, take the server value only for fields that still match
 * the snapshot sent with the request. Fields typed since that snapshot stay local.
 */
export function keepDraftFields<T extends DraftFields>(server: T, sent: T, local: T): T {
  const merged = { ...server }
  for (const key of Object.keys(local) as (keyof T)[]) {
    if (!Object.is(local[key], sent[key])) merged[key] = local[key]
  }
  return merged
}
