export type PngSource = {
  src: string;
  filename: string;
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function toPngFileName(name: string): string {
  const cleaned = (name || 'صورة')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'صورة';
  return /\.png$/i.test(cleaned) ? cleaned : `${cleaned}.png`;
}

function uniquePngNames(items: PngSource[]): PngSource[] {
  const used = new Map<string, number>();
  return items.map((item) => {
    const base = toPngFileName(item.filename);
    const count = used.get(base) || 0;
    used.set(base, count + 1);
    if (count === 0) return { ...item, filename: base };
    return {
      ...item,
      filename: base.replace(/\.png$/i, `_${count + 1}.png`),
    };
  });
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function assertPng(blob: Blob): Promise<void> {
  const header = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
  const ok = PNG_SIGNATURE.every((byte, index) => header[index] === byte);
  if (!ok) throw new Error('الملف الناتج ليس صورة PNG');
}

function loadImage(src: string, crossOrigin?: 'anonymous'): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('تعذر تحميل الصورة'));
    img.src = src;
  });
}

async function drawableImage(src: string): Promise<{ img: HTMLImageElement; revoke?: () => void }> {
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    return { img: await loadImage(src) };
  }

  try {
    return { img: await loadImage(src, 'anonymous') };
  } catch {
    const response = await fetch(src);
    if (!response.ok) throw new Error('تعذر قراءة الصورة لتحويلها إلى PNG');
    const objectUrl = URL.createObjectURL(await response.blob());
    const img = await loadImage(objectUrl);
    return { img, revoke: () => URL.revokeObjectURL(objectUrl) };
  }
}

export async function imageSourceToPngBlob(src: string): Promise<Blob> {
  if (!src) throw new Error('لا توجد صورة للتنزيل');

  if (src.startsWith('data:image/png')) {
    const blob = await (await fetch(src)).blob();
    const png = blob.type === 'image/png' ? blob : new Blob([await blob.arrayBuffer()], { type: 'image/png' });
    await assertPng(png);
    return png;
  }

  const { img, revoke } = await drawableImage(src);
  try {
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) throw new Error('الصورة فارغة');

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('تعذر إنشاء الصورة');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), 'image/png');
    });
    if (!blob) throw new Error('تعذر تحويل الصورة إلى PNG');
    await assertPng(blob);
    return blob.type === 'image/png' ? blob : new Blob([await blob.arrayBuffer()], { type: 'image/png' });
  } finally {
    revoke?.();
  }
}

async function preparePngFiles(items: PngSource[]): Promise<{ blob: Blob; filename: string }[]> {
  const files: { blob: Blob; filename: string }[] = [];
  for (const item of items) {
    files.push({
      blob: await imageSourceToPngBlob(item.src),
      filename: item.filename,
    });
  }
  return files;
}

export async function downloadImagesAsPng(items: PngSource[]): Promise<{ count: number; asZip: boolean }> {
  const ready = uniquePngNames(items.filter((item) => item.src));
  if (ready.length === 0) throw new Error('لا توجد صور لتنزيلها');

  const files = await preparePngFiles(ready);
  files.forEach((file) => triggerBlobDownload(file.blob, file.filename));
  if (files.length === 1) return { count: 1, asZip: false };

  const zip = await buildPngZip(files);
  triggerBlobDownload(zip, `صور_PNG_${new Date().toISOString().slice(0, 10)}.zip`);
  return { count: files.length, asZip: true };
}

export async function downloadElementAsPng(element: HTMLElement, filename: string): Promise<void> {
  const html2canvas = (await import('html2canvas-pro')).default;
  const width = Math.max(element.scrollWidth, element.getBoundingClientRect().width, 1);
  const height = Math.max(element.scrollHeight, element.getBoundingClientRect().height, 1);
  const scale = width * height > 1_800_000 ? 1 : 2;

  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    width,
    height,
    windowWidth: Math.max(width, document.documentElement.clientWidth),
    windowHeight: Math.max(height, document.documentElement.clientHeight),
  });

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), 'image/png');
  });
  if (!blob) throw new Error('تعذر إنشاء صورة PNG');
  await assertPng(blob);
  triggerBlobDownload(
    blob.type === 'image/png' ? blob : new Blob([await blob.arrayBuffer()], { type: 'image/png' }),
    toPngFileName(filename)
  );
}

function dosTime(date: Date): { time: number; date: number } {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: day };
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    out.set(chunk, offset);
    offset += chunk.length;
  });
  return out;
}

export async function buildPngZip(files: { blob: Blob; filename: string }[]): Promise<Blob> {
  const now = dosTime(new Date());
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.filename);
    const data = new Uint8Array(await file.blob.arrayBuffer());
    const crc = crc32(data);
    const local = new Uint8Array(30);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(10, now.time, true);
    localView.setUint16(12, now.date, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    locals.push(local, nameBytes, data);

    const central = new Uint8Array(46);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(12, now.time, true);
    centralView.setUint16(14, now.date, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }

  const centralSize = centrals.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  const bytes = concatBytes([...locals, ...centrals, end]);
  return new Blob([bytes], { type: 'application/zip' });
}
