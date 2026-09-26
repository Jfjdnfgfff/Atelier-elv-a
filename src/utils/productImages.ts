import { ClothItem } from '../types';
import { imageStore } from './imageStore';
import { getListImage } from './imageUtils';
import type { PrintImage } from './printInterface';

export async function collectClothExportImages(items: ClothItem[]): Promise<PrintImage[]> {
  const images: PrintImage[] = [];
  const seen = new Set<string>();

  const push = (src: string | undefined, filename: string, caption: string) => {
    if (!src || seen.has(src)) return;
    seen.add(src);
    images.push({ src, filename, caption });
  };

  for (const item of items) {
    let full = '';
    if (item.hasFullImage && item.id) {
      try {
        full = (await imageStore.loadFull(item.id)) || '';
      } catch {
        full = '';
      }
    }
    const main = full || item.imageUrl || getListImage(item);
    const label = item.barcode ? `${item.name} • ${item.barcode}` : item.name;
    push(main, `${item.name || 'قطعة'}_${item.barcode || item.id || 'img'}`, label);

    for (const variant of item.variants || []) {
      push(
        variant.imageUrl,
        `${item.name || 'قطعة'}_${variant.color || ''}_${variant.size || variant.id || 'لون'}`,
        `${item.name} — ${variant.color || ''} ${variant.size || ''}`.trim()
      );
    }
  }

  return images;
}
