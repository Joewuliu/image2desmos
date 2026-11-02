import type { Bounds } from './types'

export interface MathBounds {
  left: number
  right: number
  bottom: number
  top: number
}

/**
 * Smallest window that contains `bounds` plus `padding` (a fraction of each
 * side) and has the same aspect ratio (width / height) as the graph element,
 * so circles stay circular and the image is not stretched.
 */
export function fitViewport(bounds: Bounds, aspect: number, padding = 0.06): MathBounds {
  const centerX = (bounds.min_x + bounds.max_x) / 2
  const centerY = (bounds.min_y + bounds.max_y) / 2
  let width = (bounds.max_x - bounds.min_x) * (1 + 2 * padding)
  let height = (bounds.max_y - bounds.min_y) * (1 + 2 * padding)

  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : width / height
  if (width / height < safeAspect) width = height * safeAspect
  else height = width / safeAspect

  return {
    left: centerX - width / 2,
    right: centerX + width / 2,
    bottom: centerY - height / 2,
    top: centerY + height / 2,
  }
}
