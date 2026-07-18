/**
 * Client-only downscale for cover-image uploads, so a large phone photo
 * doesn't get rejected by Vercel's ~4.5 MB serverless request-body limit
 * (a platform-level 413 that fires *before* any app code runs — see
 * `src/server/uploads.ts`'s `MAX_COVER_BYTES` comment).
 *
 * Only files that actually need it are touched: anything already under
 * both thresholds passes through unchanged, bit-for-bit. Decoding is
 * unavoidable even for the size-only branch, since checking "longer than
 * 2000px" requires knowing the image's dimensions in the first place.
 *
 * Runs entirely in canvas/`createImageBitmap` — no dependency, no SSR
 * concern beyond the `typeof window` guard below (this only ever runs from
 * a browser `<input type="file">` change handler, but the guard keeps it
 * safe to import/call from anywhere, e.g. in a test environment without a
 * canvas implementation).
 */

const SIZE_THRESHOLD_BYTES = 3.5 * 1024 * 1024 // 3.5 MB
const DIMENSION_THRESHOLD_PX = 2000 // longest-edge trigger
const TARGET_DIMENSION_PX = 1600 // longest-edge output
const JPEG_QUALITY = 0.85

function canDownscale(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof createImageBitmap === 'function'
  )
}

function jpegFileName(originalName: string): string {
  const base = originalName.replace(/\.[^./]+$/, '')
  return `${base || 'cover'}.jpg`
}

/**
 * Downscales `file` to at most `TARGET_DIMENSION_PX` on its longest edge,
 * re-encoded as JPEG at `JPEG_QUALITY`, when it's over `SIZE_THRESHOLD_BYTES`
 * or over `DIMENSION_THRESHOLD_PX` on its longest edge. Otherwise (or if
 * canvas processing fails for any reason — an odd format, a decode error,
 * an environment without canvas support) returns the original `file`
 * untouched so the caller can still attempt the upload as-is.
 */
export async function maybeDownscaleCoverImage(file: File): Promise<File> {
  if (!canDownscale()) {
    return file
  }

  try {
    const bitmap = await createImageBitmap(file)
    try {
      const longestEdge = Math.max(bitmap.width, bitmap.height)
      const needsDownscale =
        file.size > SIZE_THRESHOLD_BYTES || longestEdge > DIMENSION_THRESHOLD_PX
      if (!needsDownscale) {
        return file
      }

      const scale = Math.min(1, TARGET_DIMENSION_PX / longestEdge)
      const width = Math.max(1, Math.round(bitmap.width * scale))
      const height = Math.max(1, Math.round(bitmap.height * scale))

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        return file
      }
      context.drawImage(bitmap, 0, 0, width, height)

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
      })
      if (!blob) {
        return file
      }

      return new File([blob], jpegFileName(file.name), { type: 'image/jpeg' })
    } finally {
      bitmap.close()
    }
  } catch {
    // Odd/unsupported format, decode failure, etc. — fall back to the
    // original file and let the server's own validation be the judge.
    return file
  }
}
