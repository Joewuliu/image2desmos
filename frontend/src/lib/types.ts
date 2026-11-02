export interface ImageMetadata {
  filename: string
  format: string
  mime_type: string
  width: number
  height: number
  pixel_count: number
  size_bytes: number
  has_alpha: boolean
}

export class UploadError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'UploadError'
    this.code = code
  }
}

export interface ProcessingParams {
  blur_sigma: number
  edge_sensitivity: number
  simplify: number
}

export const DEFAULT_PARAMS: ProcessingParams = {
  blur_sigma: 1,
  edge_sensitivity: 50,
  simplify: 2,
}

export interface Bounds {
  min_x: number
  max_x: number
  min_y: number
  max_y: number
}

export type Point = [number, number]

export interface ProcessingStats {
  contour_count: number
  point_count: number
  edge_pixel_count: number
  canny_low: number
  canny_high: number
  blur_kernel: number
  epsilon_px: number
  working_width: number
  working_height: number
}

export interface ProcessResponse {
  image: ImageMetadata
  params: ProcessingParams
  stats: ProcessingStats
  bounds: Bounds
  /** Cartesian points (origin at image centre, y up); contours are closed. */
  contours: Point[][]
  /** PNG data URL: detected edges as dark lines on white. */
  edge_image: string
  warnings: string[]
}
