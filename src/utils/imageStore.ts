import { ref, get, set, remove as rtdbRemove } from 'firebase/database';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { rtdb, sanitizeForFirebase } from '../firebase';

export interface ImageStore {
  saveFull(id: string, dataUrl: string): Promise<boolean>;
  loadFull(id: string, bypassCache?: boolean): Promise<string | null>;
  remove(id: string): Promise<boolean>;
}

// In-memory LRU cache for last 30 loaded full images
const MAX_LRU_CACHE_SIZE = 30;
const memoryLruCache = new Map<string, string>();

function touchLru(id: string, dataUrl: string) {
  if (memoryLruCache.has(id)) {
    memoryLruCache.delete(id);
  } else if (memoryLruCache.size >= MAX_LRU_CACHE_SIZE) {
    const firstKey = memoryLruCache.keys().next().value;
    if (firstKey) memoryLruCache.delete(firstKey);
  }
  memoryLruCache.set(id, dataUrl);
}

// In-memory LRU cache for 300 thumbnails (Task 2)
const MAX_THUMB_LRU_SIZE = 300;
const thumbMemoryLruCache = new Map<string, string>();

function touchThumbLru(id: string, dataUrl: string) {
  if (thumbMemoryLruCache.has(id)) {
    thumbMemoryLruCache.delete(id);
  } else if (thumbMemoryLruCache.size >= MAX_THUMB_LRU_SIZE) {
    const firstKey = thumbMemoryLruCache.keys().next().value;
    if (firstKey) thumbMemoryLruCache.delete(firstKey);
  }
  thumbMemoryLruCache.set(id, dataUrl);
}

export const thumbnailStore = {
  getMemoryCached(id: string): string | null {
    if (!id) return null;
    return thumbMemoryLruCache.get(id) || null;
  },

  async saveThumb(id: string, thumbDataUrl: string): Promise<boolean> {
    if (!id || !thumbDataUrl) return false;
    try {
      const thumbRef = ref(rtdb, `clothThumbs/${id}`);
      const payload = sanitizeForFirebase({
        thumb: thumbDataUrl,
        updatedAt: new Date().toISOString()
      });
      await set(thumbRef, payload);
      touchThumbLru(id, thumbDataUrl);
      try {
        await idbSet(`cloth_thumb_${id}`, thumbDataUrl);
      } catch (e) {
        // idb error ignored
      }
      return true;
    } catch (err) {
      console.error('[ThumbnailStore] Failed to save thumb for', id, err);
      return false;
    }
  },

  async loadThumb(id: string, fallbackThumbUrl?: string, bypassCache = false): Promise<string | null> {
    if (!id) return fallbackThumbUrl || null;

    // 1. Check in-memory LRU cache first
    if (!bypassCache && thumbMemoryLruCache.has(id)) {
      const cached = thumbMemoryLruCache.get(id)!;
      touchThumbLru(id, cached);
      return cached;
    }

    // 2. Check IndexedDB
    if (!bypassCache) {
      try {
        const idbVal = await idbGet(`cloth_thumb_${id}`);
        if (idbVal && typeof idbVal === 'string') {
          touchThumbLru(id, idbVal);
          return idbVal;
        }
      } catch (err) {
        // ignore IDB error
      }
    }

    // 3. Check RTDB clothThumbs/{id}
    try {
      const thumbRef = ref(rtdb, `clothThumbs/${id}`);
      const snapshot = await get(thumbRef);
      if (snapshot.exists()) {
        const val = snapshot.val();
        const thumbDataUrl = val?.thumb || null;
        if (thumbDataUrl) {
          touchThumbLru(id, thumbDataUrl);
          try {
            await idbSet(`cloth_thumb_${id}`, thumbDataUrl);
          } catch (e) {}
          return thumbDataUrl;
        }
      }
    } catch (err) {
      console.warn('[ThumbnailStore] Failed to load thumb from RTDB for', id, err);
    }

    // 4. Fallback to legacy thumbUrl / imageUrl on product
    if (fallbackThumbUrl) {
      touchThumbLru(id, fallbackThumbUrl);
      return fallbackThumbUrl;
    }

    return null;
  },

  async removeThumb(id: string): Promise<boolean> {
    if (!id) return false;
    thumbMemoryLruCache.delete(id);
    try {
      await idbDel(`cloth_thumb_${id}`);
    } catch (e) {}
    try {
      const thumbRef = ref(rtdb, `clothThumbs/${id}`);
      await rtdbRemove(thumbRef);
      return true;
    } catch (err) {
      console.error('[ThumbnailStore] Failed to remove thumb for', id, err);
      return false;
    }
  }
};

export const firebaseRtdbImageStore: ImageStore = {
  async saveFull(id: string, dataUrl: string): Promise<boolean> {
    if (!id || !dataUrl) return false;
    try {
      const imgRef = ref(rtdb, `clothImages/${id}`);
      const payload = sanitizeForFirebase({
        full: dataUrl,
        updatedAt: new Date().toISOString()
      });
      await set(imgRef, payload);
      touchLru(id, dataUrl);
      return true;
    } catch (err) {
      console.error('[ImageStore] Failed to save full image for', id, err);
      return false;
    }
  },

  async loadFull(id: string, bypassCache = false): Promise<string | null> {
    if (!id) return null;

    // Check in-memory LRU cache first unless bypassCache is requested
    if (!bypassCache && memoryLruCache.has(id)) {
      const cached = memoryLruCache.get(id)!;
      // Re-insert to mark as recently used
      touchLru(id, cached);
      return cached;
    }

    try {
      const imgRef = ref(rtdb, `clothImages/${id}`);
      const snapshot = await get(imgRef);
      if (snapshot.exists()) {
        const val = snapshot.val();
        const fullDataUrl = val?.full || null;
        if (fullDataUrl) {
          touchLru(id, fullDataUrl);
        }
        return fullDataUrl;
      }
      return null;
    } catch (err) {
      console.error('[ImageStore] Failed to load full image for', id, err);
      return null;
    }
  },

  async remove(id: string): Promise<boolean> {
    if (!id) return false;
    memoryLruCache.delete(id);
    try {
      const imgRef = ref(rtdb, `clothImages/${id}`);
      await rtdbRemove(imgRef);
      return true;
    } catch (err) {
      console.error('[ImageStore] Failed to remove full image for', id, err);
      return false;
    }
  }
};

// Default active image store implementation
export const imageStore: ImageStore = firebaseRtdbImageStore;

