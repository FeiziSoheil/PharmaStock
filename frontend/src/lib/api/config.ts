/** Public API wiring — no secrets. */

export function apiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
  return raw && raw.length > 0 ? raw.replace(/\/$/, '') : 'http://localhost:8080'
}
