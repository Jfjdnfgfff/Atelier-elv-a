import type { ClothItem } from '../types';

/**
 * Pure stock / counter helpers shared by the sale and rental handlers.
 *
 * Every helper returns:
 *  - `next`:  the updated item for local React state (never negative)
 *  - `write`: the matching Firebase write. Counters that already exist on the record are sent as
 *             server-side increments (`add`), so two devices selling or renting at the same time can't
 *             overwrite each other's changes. Legacy records (missing counters) or values that had to be
 *             clamped at 0 are sent as absolute values (`set`).
 */

export type StockSource = 'stock1' | 'stock2';

export interface StockLine {
  itemId: string;
  qty: number;
  stockSource?: StockSource;
  size?: string;
  color?: string;
}

export interface AtomicWrite {
  set: Record<string, number>;
  add: Record<string, number>;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const norm = (v: unknown) => String(v ?? '').trim();

function counterWrite(write: AtomicWrite, path: string, original: unknown, finalValue: number, requested: number) {
  if (requested === 0) return;
  if (isNum(original) && original + requested === finalValue) {
    write.add[path] = requested;
  } else {
    write.set[path] = finalValue;
  }
}

/** Total counter (`stock`) follows its two parts: increment only if both parts were incremented exactly. */
function totalWrite(
  write: AtomicWrite,
  prefix: string,
  originalTotal: unknown,
  finalTotal: number,
  requestedTotal: number
) {
  const partsAbsolute = `${prefix}stock1` in write.set || `${prefix}stock2` in write.set;
  if (requestedTotal === 0 && !partsAbsolute) return;
  if (!partsAbsolute && isNum(originalTotal) && originalTotal + requestedTotal === finalTotal) {
    if (requestedTotal !== 0) write.add[`${prefix}stock`] = requestedTotal;
  } else {
    write.set[`${prefix}stock`] = finalTotal;
  }
}

/** Index of the size/color variant a cart line refers to (-1 when the item has no matching variant). */
export function findVariantIndex(item: Pick<ClothItem, 'variants'>, size?: string, color?: string): number {
  if (!Array.isArray(item.variants) || item.variants.length === 0) return -1;
  const s = norm(size);
  const c = norm(color);
  if (!s || !c) return -1;
  return item.variants.findIndex(v => v && norm(v.size) === s && norm(v.color) === c);
}

/**
 * Applies sold (direction = -1) or restored (direction = +1) quantities to one item.
 * Also updates the matching size/color variant: the edit form recomputes the item stock from its
 * variants, so a sale that only touched the item totals was "undone" the next time the item was saved.
 */
export function applyStockLines(
  item: ClothItem,
  lines: StockLine[],
  direction: 1 | -1
): { next: ClothItem; write: AtomicWrite } {
  const write: AtomicWrite = { set: {}, add: {} };
  const split = isNum(item.stock1) && isNum(item.stock2) && isNum(item.stock);

  let s1 = isNum(item.stock1) ? item.stock1 : Number(item.stock) || 0;
  let s2 = isNum(item.stock2) ? item.stock2 : 0;
  let req1 = 0;
  let req2 = 0;

  const variants = Array.isArray(item.variants) ? item.variants.slice() : undefined;
  const variantRequests = new Map<number, { r1: number; r2: number }>();

  for (const line of lines) {
    const qty = Math.max(0, Number(line.qty) || 0);
    if (!qty) continue;
    const field: StockSource = line.stockSource === 'stock2' ? 'stock2' : 'stock1';
    const delta = direction * qty;

    if (field === 'stock2') {
      s2 = Math.max(0, s2 + delta);
      req2 += delta;
    } else {
      s1 = Math.max(0, s1 + delta);
      req1 += delta;
    }

    const vIdx = variants ? findVariantIndex({ variants }, line.size, line.color) : -1;
    if (variants && vIdx >= 0) {
      const v = variants[vIdx];
      let v1 = Number(v.stock1) || 0;
      let v2 = Number(v.stock2) || 0;
      if (field === 'stock2') v2 = Math.max(0, v2 + delta);
      else v1 = Math.max(0, v1 + delta);
      variants[vIdx] = { ...v, stock1: v1, stock2: v2, stock: v1 + v2 };
      const r = variantRequests.get(vIdx) || { r1: 0, r2: 0 };
      if (field === 'stock2') r.r2 += delta;
      else r.r1 += delta;
      variantRequests.set(vIdx, r);
    }
  }

  if (split) {
    counterWrite(write, 'stock1', item.stock1, s1, req1);
    counterWrite(write, 'stock2', item.stock2, s2, req2);
    totalWrite(write, '', item.stock, s1 + s2, req1 + req2);
  } else if (req1 !== 0 || req2 !== 0) {
    // Legacy record without split counters: same absolute write as before
    write.set.stock1 = s1;
    write.set.stock2 = s2;
    write.set.stock = s1 + s2;
  }

  if (variants) {
    variantRequests.forEach(({ r1, r2 }, vIdx) => {
      const original = item.variants![vIdx];
      const updated = variants[vIdx];
      const prefix = `variants/${vIdx}/`;
      counterWrite(write, `${prefix}stock1`, original.stock1, Number(updated.stock1) || 0, r1);
      counterWrite(write, `${prefix}stock2`, original.stock2, Number(updated.stock2) || 0, r2);
      totalWrite(write, prefix, original.stock, Number(updated.stock) || 0, r1 + r2);
    });
  }

  const next: ClothItem = { ...item, stock1: s1, stock2: s2, stock: s1 + s2 };
  if (variants) next.variants = variants;
  return { next, write };
}

/** rentedCount / inCleaningCount changes (e.g. { rentedCount: +1 } on handover, -1 on return). */
export function applyCounterDeltas(
  item: ClothItem,
  deltas: Partial<Record<'rentedCount' | 'inCleaningCount', number>>
): { next: ClothItem; write: AtomicWrite } {
  const write: AtomicWrite = { set: {}, add: {} };
  const next: ClothItem = { ...item };
  (Object.keys(deltas) as Array<'rentedCount' | 'inCleaningCount'>).forEach(field => {
    const requested = Number(deltas[field]) || 0;
    if (!requested) return;
    const original = item[field];
    const finalValue = Math.max(0, (Number(original) || 0) + requested);
    next[field] = finalValue;
    counterWrite(write, field, original, finalValue, requested);
  });
  return { next, write };
}

/**
 * Splits a total stock across `count` variants without losing the remainder
 * (e.g. 5 pieces over 2 variants -> 3 + 2, previously floor() gave 2 + 2 and one piece vanished).
 */
export function distributeEvenly(total: number, count: number, index: number): number {
  const t = Math.max(0, Math.floor(Number(total) || 0));
  const n = Math.max(1, Math.floor(count));
  const base = Math.floor(t / n);
  return base + (index < t % n ? 1 : 0);
}

/** Groups sale lines by item so each item gets a single local update and a single Firebase write. */
export function groupStockLinesByItem(lines: any[] | undefined): Map<string, StockLine[]> {
  const byItem = new Map<string, StockLine[]>();
  (lines || []).forEach(line => {
    if (!line || !line.itemId) return;
    const list = byItem.get(line.itemId) || [];
    list.push(line as StockLine);
    byItem.set(line.itemId, list);
  });
  return byItem;
}
