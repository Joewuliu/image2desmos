/** Builds a safe download name like `sketch-desmos-state.json` from the uploaded file's name. */
export function exportFileName(sourceName: string | undefined, suffix: string, extension: string): string {
  const stem = (sourceName ?? '')
    .replace(/\.[^.]*$/, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 60)
  return `${stem || 'image'}-${suffix}.${extension}`
}

/** Triggers a browser download of `blob`. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.rel = 'noopener'
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    // Give the browser a moment to start the download before releasing the URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

export function downloadText(text: string, filename: string, mimeType: string): void {
  downloadBlob(new Blob([text], { type: `${mimeType};charset=utf-8` }), filename)
}

/** Decodes a `data:` URI (as returned by Desmos screenshots) into a Blob. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl)
  if (!match) throw new Error('Not a data URL.')
  const [, mime = 'application/octet-stream', base64, payload] = match
  if (!base64) return new Blob([decodeURIComponent(payload)], { type: mime })
  const binary = atob(payload)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}
