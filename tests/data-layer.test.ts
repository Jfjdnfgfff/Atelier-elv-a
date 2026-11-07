import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  normalizeSearchText,
  tokenizeSearchText,
  buildItemTokens,
  buildSearchIndexRecord,
  buildLocalSearchIndex,
  searchLocalIndex,
  searchIndexRecords,
  type SearchIndexRecord
} from '../src/utils/searchIndexCore';
import {
  CACHE_SCHEMA_VERSION,
  evaluateCacheFreshness,
  makeCacheStamp
} from '../src/utils/cachePolicy';
import {
  missingRecords,
  isLayoutComplete
} from '../src/data/layoutCore';
import {
  clearJournal,
  clearJournalEntry,
  getJournalEntries,
  isCloudNewerThanJournal,
  journalDelete,
  journalSave,
  journalSize,
  journalUpdate
} from '../src/utils/durableJournal';
import {
  pageMeta,
  paginate,
  pageNumbers,
  clampPage,
  pageCount
} from '../src/utils/paginationCore';

// ---------------------------------------------------------------------------
// 1) فهرس البحث في المخزون
// ---------------------------------------------------------------------------

test('search text normalization unifies arabic variants, diacritics and digits', () => {
  assert.equal(normalizeSearchText('فُسْتَان أحمر'), 'فستان احمر');
  assert.equal(normalizeSearchText('إبرة   تطريز'), 'ابره تطريز');
  assert.equal(normalizeSearchText('مقاس ٤٢'), 'مقاس 42');
  assert.equal(normalizeSearchText('Caftan Élégant'), 'caftan elegant');
  assert.deepEqual(tokenizeSearchText('  فستان   سهرة '), ['فستان', 'سهره']);
  assert.deepEqual(tokenizeSearchText(''), []);
});

test('item tokens cover name, barcode, colors, sizes and variant codes', () => {
  const tokens = buildItemTokens({
    id: 'c1',
    name: 'فستان سهرة',
    barcode: 'FS-100',
    category: 'فساتين كراء',
    color: 'أحمر',
    colors: ['أحمر', 'ذهبي'],
    size: 'M',
    sizes: ['M', 'L'],
    variants: [{ code: 'FS-100-M' }]
  });

  for (const expected of ['فستان', 'سهره', 'fs', '100', 'احمر', 'ذهبي', 'm', 'l', 'فساتين']) {
    assert.ok(tokens.includes(expected), `missing token: ${expected}`);
  }
});

test('local inverted index matches word prefixes and ranks exact names first', () => {
  const clothes = [
    { id: 'a', name: 'فستان سهرة أحمر', barcode: 'A-1', color: 'أحمر', size: 'M' },
    { id: 'b', name: 'قفطان مطرز', barcode: 'B-2', color: 'أخضر', size: 'L' },
    { id: 'c', name: 'فستان', barcode: 'C-3', color: 'أسود', size: 'S' }
  ];
  const index = buildLocalSearchIndex(clothes);

  assert.deepEqual(searchLocalIndex(index, 'سهرة'), ['a']);
  assert.deepEqual(searchLocalIndex(index, 'فس'), ['c', 'a']);
  assert.deepEqual(searchLocalIndex(index, 'قفطان'), ['b']);
  assert.deepEqual(searchLocalIndex(index, 'b-2'), ['b']);
  assert.deepEqual(searchLocalIndex(index, 'مقاس'), []);
  assert.deepEqual(searchLocalIndex(index, ''), []);
});

test('compact index records are searchable without loading full stock records', () => {
  const records: SearchIndexRecord[] = [
    buildSearchIndexRecord({ id: 'a', name: 'فستان سهرة أحمر', barcode: 'A-1', category: 'فساتين كراء' }, 10),
    buildSearchIndexRecord({ id: 'b', name: 'قفطان مطرز', barcode: 'B-2', category: 'قفاطين' }, 20)
  ];

  assert.deepEqual(searchIndexRecords(records, 'سهر').map(r => r.id), ['a']);
  assert.deepEqual(searchIndexRecords(records, 'a-1').map(r => r.id), ['a']);
  assert.deepEqual(searchIndexRecords(records, 'قفطان').map(r => r.id), ['b']);
  assert.deepEqual(searchIndexRecords(records, 'غير موجود'), []);

  const record = records[0];
  assert.equal(record.id, 'a');
  assert.ok(record.t.length > 0);
  assert.equal(record.u, 10);
});

// ---------------------------------------------------------------------------
// 2) سياسة الكاش وإبطاله
// ---------------------------------------------------------------------------

test('cache is fresh only with matching schema, revision and age', () => {
  const now = 1_000_000;
  const stamp = makeCacheStamp(500, now);

  assert.equal(evaluateCacheFreshness(stamp, 500, now + 1000, 60_000).fresh, true);
  assert.equal(evaluateCacheFreshness(stamp, 500, now + 1000, 60_000).reason, 'ok');

  const newerRemote = evaluateCacheFreshness(stamp, 501, now + 1000, 60_000, CACHE_SCHEMA_VERSION);
  assert.equal(newerRemote.fresh, false);
  assert.equal(newerRemote.reason, 'revision');

  const expired = evaluateCacheFreshness(stamp, 500, now + 120_000, 60_000);
  assert.equal(expired.fresh, false);
  assert.equal(expired.reason, 'expired');

  const oldSchema = evaluateCacheFreshness(stamp, 500, now, 60_000, CACHE_SCHEMA_VERSION + 1);
  assert.equal(oldSchema.fresh, false);
  assert.equal(oldSchema.reason, 'schema');

  assert.equal(evaluateCacheFreshness(null, 1, now, 60_000).reason, 'missing');
});

test('remote revision never invalidates when it equals or is older than the local stamp', () => {
  const now = 2_000_000;
  const stamp = makeCacheStamp(900, now);
  assert.equal(evaluateCacheFreshness(stamp, 900, now + 10).fresh, true);
  assert.equal(evaluateCacheFreshness(stamp, 800, now + 10).fresh, true);
  assert.equal(evaluateCacheFreshness(stamp, null, now + 10).fresh, true);
});

// ---------------------------------------------------------------------------
// 3) تقسيم الصفحات
// ---------------------------------------------------------------------------

test('pagination meta reports correct ranges and boundaries', () => {
  assert.equal(pageCount(0, 12), 1);
  assert.equal(pageCount(25, 12), 3);
  assert.equal(clampPage(9, 25, 12), 3);
  assert.equal(clampPage(-2, 25, 12), 1);

  const first = pageMeta(25, 1, 12);
  assert.deepEqual(
    { start: first.start, end: first.end, pages: first.pages, hasPrev: first.hasPrev, hasNext: first.hasNext },
    { start: 1, end: 12, pages: 3, hasPrev: false, hasNext: true }
  );

  const last = pageMeta(25, 3, 12);
  assert.deepEqual(
    { start: last.start, end: last.end, hasPrev: last.hasPrev, hasNext: last.hasNext },
    { start: 25, end: 25, hasPrev: true, hasNext: false }
  );

  const empty = pageMeta(0, 4, 12);
  assert.deepEqual({ start: empty.start, end: empty.end, pages: empty.pages }, { start: 0, end: 0, pages: 1 });
});

test('paginate slices items without mutating the source list', () => {
  const items = Array.from({ length: 25 }, (_, index) => index + 1);
  const page2 = paginate(items, 2, 10);
  assert.deepEqual(page2.items, [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  assert.equal(items.length, 25);
  assert.deepEqual(paginate(items, 99, 10).items.slice(0, 1), [21]);
});

test('page numbers include first/last and ellipsis gaps', () => {
  assert.deepEqual(pageNumbers(1, 3), [1, 2, 3]);
  assert.deepEqual(pageNumbers(5, 10), [1, '…', 4, 5, 6, '…', 10]);
  assert.deepEqual(pageNumbers(1, 1), [1]);
});

// ---------------------------------------------------------------------------
// 4) ترحيل المسارات (نسخ فقط، قابل للاستئناف)
// ---------------------------------------------------------------------------

test('layout migration copies only missing records and resumes partial copies', () => {
  const legacy = {
    c1: { id: 'c1', name: 'فستان' },
    c2: { id: 'c2', name: 'قفطان' },
    c3: { name: 'بدون معرف' }
  };
  const canonicalPartial = { c1: { id: 'c1', name: 'فستان' } };

  const missing = missingRecords(legacy, canonicalPartial);
  assert.deepEqual(Object.keys(missing).sort(), ['c2', 'c3']);
  assert.deepEqual(missingRecords(legacy, legacy), {});
  assert.deepEqual(missingRecords(null, legacy), {});
});

test('layout is complete only when every collection is recorded under the current version', () => {
  const collections = ['clothes', 'sales'];
  assert.equal(isLayoutComplete(null, 'namespaced-v1', collections), false);
  assert.equal(isLayoutComplete({ layout: 'namespaced-v1', collections: ['clothes'] }, 'namespaced-v1', collections), false);
  assert.equal(isLayoutComplete({ layout: 'namespaced-v1', collections: ['clothes', 'sales'] }, 'namespaced-v1', collections), true);
  assert.equal(isLayoutComplete({ layout: 'legacy-flat', collections: ['clothes', 'sales'] }, 'namespaced-v1', collections), false);
});

// ---------------------------------------------------------------------------
// 5) السجل الدائم (Durability): كتابة قبل الشبكة + قاعدة التعارض
// ---------------------------------------------------------------------------

test('durable journal keeps the latest intent per record and merges pending edits', () => {
  clearJournal();

  journalSave('clothes', { id: 'c1', name: 'فستان', stock: 2 });
  assert.equal(journalSize(), 1);

  // تعديل بعد إضافة معلّقة: يجب أن يُدمج داخل السجل الكامل لا أن يستبدله
  journalUpdate('clothes', 'c1', { stock: 3, updatedAt: '2026-11-07T10:00:00.000Z' });
  const [entry] = getJournalEntries();
  assert.equal(entry.op, 'save');
  assert.equal(entry.item?.stock, 3);
  assert.equal(entry.item?.name, 'فستان');

  // تعديلات متتالية على نفس السجل تبقى عملية واحدة مدمجة
  journalUpdate('clothes', 'c2', { price: 100 });
  journalUpdate('clothes', 'c2', { price: 120 });
  assert.equal(journalSize(), 2);
  assert.equal(getJournalEntries().find(e => e.id === 'c2')?.updates?.price, 120);

  // الحذف هو آخر نيّة ويُلغي ما قبله
  journalDelete('clothes', 'c1');
  assert.equal(journalSize(), 2);
  assert.equal(getJournalEntries().find(e => e.id === 'c1')?.op, 'delete');

  clearJournalEntry('clothes', 'c2');
  assert.equal(journalSize(), 1);
  clearJournal();
  assert.equal(journalSize(), 0);
});

test('journal trims oversized image fields so a power cut cannot lose the record', () => {
  clearJournal();
  const bigImage = 'data:image/png;base64,' + 'A'.repeat(50_000);
  journalSave('clothes', { id: 'c9', name: 'فستان بصورة', imageUrl: bigImage, stock: 1 });
  const [entry] = getJournalEntries();
  assert.equal(entry.trimmed, true);
  assert.equal(entry.item?.imageUrl, undefined);
  assert.equal(entry.item?.name, 'فستان بصورة');
  clearJournal();
});

test('a newer cloud version wins over a stale journal intent', () => {
  const journalAt = Date.parse('2026-11-07T10:00:00.000Z');
  assert.equal(isCloudNewerThanJournal('2026-11-07T10:00:30.000Z', journalAt), true);
  assert.equal(isCloudNewerThanJournal('2026-11-07T09:59:00.000Z', journalAt), false);
  assert.equal(isCloudNewerThanJournal(undefined, journalAt), false);
  assert.equal(isCloudNewerThanJournal('not-a-date', journalAt), false);
});
