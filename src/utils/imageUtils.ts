import { ClothItem } from '../types';
import { imageStore } from './imageStore';

/**
 * Returns the small list/card image url for a cloth item.
 * Falls back to legacy imageUrl if thumbUrl is not present.
 */
export function getListImage(item?: ClothItem | null): string {
  if (!item) return '';
  return item.thumbUrl || item.imageUrl || '';
}

/**
 * Shared helper to open image preview with thumbnail immediately,
 * and asynchronously update with the high-res full image when loaded.
 */
export async function openFullImagePreview(
  item: ClothItem,
  onOpenPreview: (url: string, title: string) => void
): Promise<void> {
  if (!item || !onOpenPreview) return;
  const initialUrl = getListImage(item) || item.imageUrl || '';
  onOpenPreview(initialUrl, item.name);
  if (item.hasFullImage && item.id) {
    const full = await imageStore.loadFull(item.id);
    if (full) {
      onOpenPreview(full, item.name);
    }
  }
}

/**
 * Resizes an image (file or base64 dataUrl) using Canvas.
 * Creates two variants:
 * 1. thumbUrl: max 200px longest edge, JPEG quality 0.6 (~8-15KB)
 * 2. fullUrl: max 1200px longest edge, JPEG quality 0.8
 */
export interface ImageVariants {
  thumbUrl: string;
  fullUrl: string;
}

export const THUMB_MAX_DIM = 200;
export const THUMB_QUALITY = 0.6;

export function processImageToVariants(input: File | string): Promise<ImageVariants> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    const processLoadedImage = () => {
      try {
        const thumbUrl = compressCanvas(img, THUMB_MAX_DIM, THUMB_QUALITY);
        const fullUrl = compressCanvas(img, 1200, 0.8);
        resolve({ thumbUrl, fullUrl });
      } catch (err) {
        reject(err);
      }
    };

    img.onload = processLoadedImage;
    img.onerror = (err) => reject(new Error('فشل تحميل الصورة للمعالجة'));

    if (typeof input === 'string') {
      img.src = input;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(input);
    }
  });
}

function compressCanvas(img: HTMLImageElement, maxDim: number, quality: number): string {
  let width = img.width || 800;
  let height = img.height || 800;

  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Fill white background for transparent PNGs converted to JPEG
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/jpeg', quality);
}
