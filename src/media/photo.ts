// Prepares a photo from the phone before it is uploaded.
//
// Phone cameras take 12+ megapixel photos (4-8 MB each). The tablet screen only
// needs about 1600 pixels on the long edge, so we shrink the photo first: uploads
// are faster on slow connections and the tablet's offline copies stay small.
// Saving a new JPEG also drops the photo's hidden metadata (EXIF), which can
// include the GPS location where it was taken.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export const MAX_PHOTO_EDGE = 1600;
const JPEG_QUALITY = 0.8;

/**
 * How to resize a `width` x `height` photo so its long edge fits `maxEdge`.
 * Returns only the long edge; the other side is worked out to keep the shape.
 * Returns null when the photo is already small enough, or its size is unknown (0).
 */
export function resizeFor(
  width: number,
  height: number,
  maxEdge = MAX_PHOTO_EDGE,
): { width: number } | { height: number } | null {
  if (width <= 0 || height <= 0) {
    return null;
  }
  if (width >= height) {
    return width > maxEdge ? { width: maxEdge } : null;
  }
  return height > maxEdge ? { height: maxEdge } : null;
}

/** Returns the URI of a smaller JPEG copy of the photo at `uri`, ready to upload. */
export async function preparePhotoForSending(
  uri: string,
  width: number,
  height: number,
): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  const size = resizeFor(width, height);
  if (size) {
    context.resize(size);
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  return result.uri;
}
