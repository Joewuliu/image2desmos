const API_VERSION = 'v1.11'

export function desmosScriptUrl(apiKey: string): string {
  return `https://www.desmos.com/api/${API_VERSION}/calculator.js?apiKey=${encodeURIComponent(apiKey)}`
}

const loading = new Map<string, Promise<DesmosNamespace>>()

/**
 * Loads the official Desmos script once per key and resolves with the
 * `Desmos` namespace. A failed load is not cached, so it can be retried.
 */
export function loadDesmos(apiKey: string): Promise<DesmosNamespace> {
  if (window.Desmos) return Promise.resolve(window.Desmos)

  const cached = loading.get(apiKey)
  if (cached) return cached

  const promise = new Promise<DesmosNamespace>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = desmosScriptUrl(apiKey)
    script.async = true
    script.onload = () => {
      if (window.Desmos) resolve(window.Desmos)
      else reject(new Error('Could not start the Desmos calculator. Please try again.'))
    }
    script.onerror = () => {
      script.remove()
      reject(new Error('Could not load the Desmos calculator. Check your connection and try again.'))
    }
    document.head.appendChild(script)
  })
  loading.set(apiKey, promise)
  promise.catch(() => loading.delete(apiKey))
  return promise
}
