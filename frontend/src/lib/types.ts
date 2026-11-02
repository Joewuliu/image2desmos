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
  fit_tolerance: number
  min_contour_size: number
}

export const DEFAULT_PARAMS: ProcessingParams = {
  blur_sigma: 1,
  edge_sensitivity: 50,
  simplify: 2,
  fit_tolerance: 1,
  min_contour_size: 1,
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

export type SegmentType = 'line' | 'bezier' | 'circle'

/**
 * line: points = [start, end]; bezier: points = [start, c1, c2, end] (cubic);
 * circle: center + radius, points empty. Cartesian space, y up.
 */
export interface Segment {
  type: SegmentType
  points: Point[]
  center: Point | null
  radius: number | null
  max_error: number
}

export interface Curve {
  closed: boolean
  segments: Segment[]
  max_error: number
  source_points: number
}

export interface FitStats {
  curve_count: number
  segment_count: number
  line_count: number
  bezier_count: number
  circle_count: number
  max_error: number
  mean_error: number
  max_error_px: number
  mean_error_px: number
  tolerance: number
  tolerance_px: number
}

export interface DesmosExpression {
  /** Valid Desmos expression id. */
  id: string
  latex: string
  type: 'line' | 'bezier' | 'circle'
  curve: number
}

export interface DesmosOutput {
  expressions: DesmosExpression[]
  count: number
  /** Segments that could not be written as valid equations, by reason. */
  skipped: Record<string, number>
  skipped_count: number
}

export interface ProcessResponse {
  image: ImageMetadata
  params: ProcessingParams
  stats: ProcessingStats
  bounds: Bounds
  /** Cartesian points (origin at image centre, y up); contours are closed. */
  contours: Point[][]
  /** Fitted lines, circles and cubic Béziers, one entry per stroke. */
  curves: Curve[]
  fit: FitStats
  desmos: DesmosOutput
  /** PNG data URL: detected edges as dark lines on white. */
  edge_image: string
  warnings: string[]
}
