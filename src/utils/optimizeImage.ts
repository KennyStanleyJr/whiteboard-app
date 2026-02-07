/**
 * Optimizes an image by resizing to a max dimension and compressing.
 * Used on demand (Image info dialog) and on import when user chooses "Optimize".
 */

/** Maximum width or height for stored images; larger images are scaled down. */
export const OPTIMIZE_IMAGE_MAX_DIMENSION = 2048;

/** JPEG quality when output format is JPEG (opaque images). Kept low enough to reduce file size. */
export const OPTIMIZE_IMAGE_JPEG_QUALITY = 0.8;

/** Maximum dimension of the canvas to sample for transparency (we don't need every pixel). */
const TRANSPARENCY_SAMPLE_MAX = 64;

export interface OptimizedImageResult {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Loads a blob as an Image and resolves with dimensions. Rejects on load error.
 */
function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

/**
 * Converts a canvas to a data URL using the given MIME type and optional quality.
 */
function canvasToDataUrl(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number
): string {
  return canvas.toDataURL(mimeType, quality);
}

/**
 * Returns true if the image has any transparent (or semi-transparent) pixels.
 * Samples a small grid to keep cost low; false negatives are possible but rare for real transparency.
 */
function imageHasTransparency(img: HTMLImageElement): boolean {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (w <= 0 || h <= 0) return false;
  const sampleW = Math.min(w, TRANSPARENCY_SAMPLE_MAX);
  const sampleH = Math.min(h, TRANSPARENCY_SAMPLE_MAX);
  const canvas = document.createElement("canvas");
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext("2d");
  if (ctx == null) return false;
  ctx.drawImage(img, 0, 0, w, h, 0, 0, sampleW, sampleH);
  const data = ctx.getImageData(0, 0, sampleW, sampleH).data;
  for (let i = 3; i < data.length; i += 4) {
    const alpha = data[i];
    if (alpha !== undefined && alpha < 255) return true;
  }
  return false;
}

/**
 * Converts an image src (data URL or blob URL) to a File for optimization.
 * Rejects if fetch fails (e.g. revoked blob URL).
 */
export function imageSrcToFile(src: string): Promise<File> {
  return fetch(src)
    .then((r) => {
      if (!r.ok) throw new Error("Failed to fetch image");
      return r.blob();
    })
    .then((blob) => {
      const type = blob.type || "image/png";
      const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
      return new File([blob], `image.${ext}`, { type });
    });
}

/**
 * Computes scaled dimensions so that neither width nor height exceeds maxDim.
 */
export function scaledDimensions(
  width: number,
  height: number,
  maxDim: number
): { width: number; height: number } {
  if (width <= maxDim && height <= maxDim) {
    return { width, height };
  }
  const scale = maxDim / Math.max(width, height, 1);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/**
 * Optimizes an image file: resizes if over max dimension and compresses.
 * Returns a data URL and the (possibly scaled) width and height.
 * @param file - Image file to optimize.
 * @param maxDimension - Optional cap for the longest side (e.g. display size so file shrinks). Defaults to OPTIMIZE_IMAGE_MAX_DIMENSION.
 */
export function optimizeImage(
  file: File,
  maxDimension: number = OPTIMIZE_IMAGE_MAX_DIMENSION
): Promise<OptimizedImageResult> {
  return loadImage(file).then((img) => {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (w <= 0 || h <= 0) {
      return Promise.reject(new Error("Invalid image dimensions"));
    }

    const effectiveMax = Math.max(1, Math.round(maxDimension));
    const { width: outW, height: outH } = scaledDimensions(w, h, effectiveMax);

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (ctx == null) {
      return Promise.reject(new Error("Could not get canvas context"));
    }
    ctx.drawImage(img, 0, 0, outW, outH);

    // Only use PNG when the image actually has transparency; otherwise JPEG is much smaller.
    const usePng = imageHasTransparency(img);
    const mimeType = usePng ? "image/png" : "image/jpeg";
    const quality = usePng ? undefined : OPTIMIZE_IMAGE_JPEG_QUALITY;
    const dataUrl = canvasToDataUrl(canvas, mimeType, quality);
    return Promise.resolve({ dataUrl, width: outW, height: outH });
  });
}
