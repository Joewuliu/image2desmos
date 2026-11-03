export const API_URL: string = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:8001'
).replace(/\/+$/, '')

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

/**
 * Longer than the server's queue and trace limits combined, plus the minute a
 * sleeping free-tier server can take to start.
 */
export const REQUEST_TIMEOUT_MS = 180_000

export const ACCEPTED_TYPES: readonly string[] = ['image/png', 'image/jpeg']

/**
 * Desmos API key, supplied at build time through VITE_DESMOS_API_KEY (see
 * frontend/.env.example). Get one at https://www.desmos.com/my-api.
 */
export const DESMOS_API_KEY: string = (import.meta.env.VITE_DESMOS_API_KEY ?? '').trim()

/** Above this many expressions the graph asks before rendering. */
export const HEAVY_EXPRESSION_COUNT = 1500
