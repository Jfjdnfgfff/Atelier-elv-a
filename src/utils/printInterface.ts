import { downloadElementAsPng, downloadImagesAsPng, toPngFileName, type PngSource } from './pngDownload';

export type PrintImage = PngSource & {
  caption?: string;
};

export type OpenPrintInterfaceOptions = {
  title: string;
  fileName: string;
  sourceElement?: HTMLElement | null;
  html?: string;
  images?: PrintImage[];
};

const HOST_ID = 'app-print-interface';
let escapeHandler: ((event: KeyboardEvent) => void) | null = null;
let previousOverflow = '';
let ignoreEscape = false;

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildSimplePrintHtml(options: {
  heading: string;
  subtitle?: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}): string {
  const head = options.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
  const body = options.rows.map((row) => (
    `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`
  )).join('');
  return `
    <article class="print-document">
      <header class="print-document-head">
        <p>بوتيك مانجر برو</p>
        <h1>${escapeHtml(options.heading)}</h1>
        ${options.subtitle ? `<p>${escapeHtml(options.subtitle)}</p>` : ''}
      </header>
      <table class="print-table">
        <thead><tr>${head}</tr></thead>
        <tbody>${body || '<tr><td colspan="99">لا توجد بيانات للطباعة</td></tr>'}</tbody>
      </table>
    </article>
  `;
}

export function closePrintInterface(): void {
  ignoreEscape = false;
  document.getElementById(HOST_ID)?.remove();
  document.body.classList.remove('print-interface-open');
  document.body.style.overflow = previousOverflow;
  if (escapeHandler) {
    document.removeEventListener('keydown', escapeHandler);
    escapeHandler = null;
  }
}

function setStatus(text: string): void {
  const status = document.querySelector<HTMLElement>('#print-interface-status');
  if (status) status.textContent = text;
}

function printNow(): void {
  const previousTitle = document.title;
  const sheetTitle = document.querySelector<HTMLElement>('#print-interface-doc-title')?.textContent || 'طباعة';
  document.title = sheetTitle;
  ignoreEscape = true;
  const restore = () => {
    document.title = previousTitle;
    ignoreEscape = false;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  window.setTimeout(() => {
    ignoreEscape = false;
  }, 1500);
  window.print();
}

export function openPrintInterface(options: OpenPrintInterfaceOptions): void {
  closePrintInterface();
  previousOverflow = document.body.style.overflow;

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.setAttribute('dir', 'rtl');
  host.setAttribute('lang', 'ar');
  host.innerHTML = `
    <div class="print-toolbar">
      <div class="print-toolbar-copy">
        <strong>واجهة الطباعة</strong>
        <span id="print-interface-doc-title">${escapeHtml(options.title)}</span>
        <span id="print-interface-status">جاهز للطباعة أو لتنزيل الصور بصيغة PNG</span>
      </div>
      <div class="print-toolbar-actions">
        <button type="button" data-action="download">تنزيل صور PNG</button>
        <button type="button" data-action="print" class="print-primary">طباعة الآن</button>
        <button type="button" data-action="close">رجوع</button>
      </div>
    </div>
    <div class="print-scroll">
      <div id="print-sheet" class="print-sheet"></div>
    </div>
  `;

  const sheet = host.querySelector<HTMLElement>('#print-sheet');
  if (!sheet) return;

  if (options.images?.length) {
    const single = options.images.length === 1;
    sheet.innerHTML = `
      <section class="${single ? 'print-single' : 'print-gallery'}">
        <header class="print-document-head">
          <p>بوتيك مانجر برو</p>
          <h1>${escapeHtml(options.title)}</h1>
          <p>${options.images.length} صورة • تُحفظ بصيغة PNG</p>
        </header>
        ${options.images.map((image) => `
          <figure>
            <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.caption || image.filename)}" />
            <figcaption>${escapeHtml(image.caption || image.filename)}</figcaption>
          </figure>
        `).join('')}
      </section>
    `;
  } else if (options.html) {
    sheet.innerHTML = options.html;
  } else if (options.sourceElement) {
    const clone = options.sourceElement.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.no-print, button, input, select, textarea').forEach((node) => node.remove());
    clone.removeAttribute('id');
    clone.style.maxHeight = 'none';
    clone.style.overflow = 'visible';
    clone.style.height = 'auto';
    sheet.appendChild(clone);
  } else {
    sheet.innerHTML = '<p class="print-empty">لا يوجد محتوى للطباعة.</p>';
  }

  host.querySelector('[data-action="close"]')?.addEventListener('click', closePrintInterface);
  host.querySelector('[data-action="print"]')?.addEventListener('click', () => {
    setStatus('جاري فتح نافذة الطباعة...');
    printNow();
  });
  host.querySelector('[data-action="download"]')?.addEventListener('click', () => {
    void downloadFromInterface(options, sheet);
  });

  document.body.appendChild(host);
  document.body.classList.add('print-interface-open');
  document.body.style.overflow = 'hidden';

  escapeHandler = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !ignoreEscape) closePrintInterface();
  };
  document.addEventListener('keydown', escapeHandler);
  host.querySelector<HTMLButtonElement>('[data-action="print"]')?.focus();

  let printStarted = false;
  const launchSystemPrint = () => {
    if (printStarted || !document.getElementById(HOST_ID)) return;
    printStarted = true;
    window.setTimeout(() => {
      if (!document.getElementById(HOST_ID)) return;
      setStatus('تم فتح واجهة الطباعة');
      try {
        printNow();
      } catch {
        setStatus('اضغط «طباعة الآن» لفتح نافذة الطباعة');
      }
    }, 220);
  };

  const pendingImages = [...sheet.querySelectorAll('img')].filter((img) => !img.complete);
  if (pendingImages.length === 0) {
    launchSystemPrint();
  } else {
    let remaining = pendingImages.length;
    const done = () => {
      remaining -= 1;
      if (remaining <= 0) launchSystemPrint();
    };
    pendingImages.forEach((img) => {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
    window.setTimeout(launchSystemPrint, 1200);
  }
}

async function downloadFromInterface(options: OpenPrintInterfaceOptions, sheet: HTMLElement): Promise<void> {
  const button = document.querySelector<HTMLButtonElement>('#app-print-interface [data-action="download"]');
  if (button) button.disabled = true;
  setStatus('جاري تجهيز الصور بصيغة PNG...');
  try {
    if (options.images?.length) {
      const result = await downloadImagesAsPng(options.images.map((image) => ({
        src: image.src,
        filename: image.filename || image.caption || options.fileName,
      })));
      setStatus(result.count === 1
        ? 'تم تنزيل الصورة بصيغة PNG'
        : `تم تنزيل ${result.count} صورة بصيغة PNG${result.asZip ? '، مع ملف يجمعها إذا منع المتصفح التحميل المتعدد' : ''}`);
      return;
    }
    await downloadElementAsPng(sheet, toPngFileName(options.fileName));
    setStatus('تم تنزيل الصورة بصيغة PNG');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'تعذر تنزيل الصورة';
    setStatus(message);
  } finally {
    if (button) button.disabled = false;
  }
}
