import { ref, get, set, remove as rtdbRemove } from 'firebase/database';
import { rtdb, sanitizeForFirebase } from '../firebase';

export interface ImageStore {
  saveFull(id: string, dataUrl: string): Promise<boolean>;
  loadFull(id: string): Promise<string | null>;
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

  async loadFull(id: string): Promise<string | null> {
    if (!id) return null;

    // Check in-memory LRU cache first
    if (memoryLruCache.has(id)) {
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
