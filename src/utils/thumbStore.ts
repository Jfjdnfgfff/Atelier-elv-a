import { ref, get as rtdbGet, set as rtdbSet, remove as rtdbRemove } from 'firebase/database';
import { get, set, del } from 'idb-keyval';
import { rtdb, sanitizeForFirebase } from '../firebase';

const MAX_LRU_THUMBS = 300;
const memoryLruThumbs = new Map<string, string>();
const pendingFetches = new Map<string, Promise<string | null>>();

function touchLru(id: string, dataUrl: string) {
  if (!id || !dataUrl) return;
  if (memoryLruThumbs.has(id)) {
    memoryLruThumbs.delete(id);
  } else if (memoryLruThumbs.size >= MAX_LRU_THUMBS) {
    const firstKey = memoryLruThumbs.keys().next().value;
    if (firstKey) memoryLruThumbs.delete(firstKey);
  }
  memoryLruThumbs.set(id, dataUrl);
}

export const thumbStore = {
  /**
   * Synchronous check in memory LRU cache (0ms lookup)
   */
  getThumbSync(id: string): string | null {
    if (!id) return null;
    const cached = memoryLruThumbs.get(id);
    if (cached) {
      touchLru(id, cached);
      return cached;
    }
    return null;
  },

  /**
   * Asynchronously loads thumbnail:
   * 1. Memory LRU cache (max 300)
   * 2. IndexedDB persistent storage
   * 3. Firebase RTDB path `clothThumbs/${id}`
   * 4. Fallback to fallbackThumb parameter
   */
  async getThumb(id: string, fallbackThumb?: string, bypassCache = false): Promise<string | null> {
    if (!id) return fallbackThumb || null;

    if (!bypassCache) {
      const syncMem = this.getThumbSync(id);
      if (syncMem) return syncMem;

      // Check IndexedDB
      try {
        const idbCached = await get<string>(`cloth_thumb_${id}`);
        if (idbCached) {
          touchLru(id, idbCached);
          return idbCached;
        }
      } catch (e) {
        // Continue to network
      }
    }

    // Deduplicate in-flight requests for the same ID
    if (pendingFetches.has(id)) {
      return pendingFetches.get(id)!;
    }

    const fetchPromise = (async () => {
      try {
        const thumbRef = ref(rtdb, `clothThumbs/${id}`);
        const snapshot = await rtdbGet(thumbRef);
        if (snapshot.exists()) {
          const val = snapshot.val();
          const thumbStr = val?.thumb || (typeof val === 'string' ? val : null);
          if (thumbStr) {
            touchLru(id, thumbStr);
            set(`cloth_thumb_${id}`, thumbStr).catch(() => {});
            return thumbStr;
          }
        }
      } catch (err) {
        console.warn(`[ThumbStore] Error fetching thumb for ${id}:`, err);
      } finally {
        pendingFetches.delete(id);
      }

      if (fallbackThumb) {
        touchLru(id, fallbackThumb);
        return fallbackThumb;
      }
      return null;
    })();

    pendingFetches.set(id, fetchPromise);
    return fetchPromise;
  },

  /**
   * Saves thumbnail to Firebase RTDB `clothThumbs/${id}`, IndexedDB, and memory LRU
   */
  async saveThumb(id: string, thumbDataUrl: string): Promise<boolean> {
    if (!id || !thumbDataUrl) return false;
    try {
      const thumbRef = ref(rtdb, `clothThumbs/${id}`);
      const payload = sanitizeForFirebase({
        thumb: thumbDataUrl,
        updatedAt: new Date().toISOString()
      });
      await rtdbSet(thumbRef, payload);
      touchLru(id, thumbDataUrl);
      await set(`cloth_thumb_${id}`, thumbDataUrl).catch(() => {});
      return true;
    } catch (err) {
      console.error(`[ThumbStore] Failed to save thumb for ${id}:`, err);
      return false;
    }
  },

  /**
   * Direct check if `clothThumbs/${id}` exists in Firebase RTDB
   */
  async hasRemoteThumb(id: string): Promise<boolean> {
    if (!id) return false;
    try {
      const thumbRef = ref(rtdb, `clothThumbs/${id}`);
      const snapshot = await rtdbGet(thumbRef);
      return snapshot.exists() && !!snapshot.val()?.thumb;
    } catch (err) {
      return false;
    }
  },

  /**
   * Removes thumbnail from memory, IndexedDB, and Firebase RTDB
   */
  async removeThumb(id: string): Promise<boolean> {
    if (!id) return false;
    memoryLruThumbs.delete(id);
    del(`cloth_thumb_${id}`).catch(() => {});
    try {
      const thumbRef = ref(rtdb, `clothThumbs/${id}`);
      await rtdbRemove(thumbRef);
      return true;
    } catch (err) {
      return false;
    }
  }
};
