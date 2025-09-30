// Импорт PDF → Markdown (best-effort через pdfjs-dist: извлечение текста)

async function loadPdfJs() {
  // Пробуем разные пути экспорта из pdfjs-dist в зависимости от версии
  const candidates = [
    () => import('pdfjs-dist'),
    () => import('pdfjs-dist/build/pdf'),
    () => import('pdfjs-dist/legacy/build/pdf')
  ];
  let lastError = null;
  for (const loader of candidates) {
    try {
      const mod = await loader();
      // В одних сборках API на default, в других — на самом модуле
      const lib = mod?.default ?? mod;
      if (lib?.getDocument) return lib;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error('Не удалось загрузить pdfjs-dist');
}

async function ensurePdfWorker(lib) {
  try {
    // Загружаем worker как URL-строку (Vite ?url)
    const workerUrlMod = await import('pdfjs-dist/build/pdf.worker.min.js?url');
    const workerSrc = workerUrlMod?.default ?? workerUrlMod;
    if (lib?.GlobalWorkerOptions) {
      lib.GlobalWorkerOptions.workerSrc = workerSrc;
    }
  } catch (e) {
    // Если не удалось — продолжим без явной установки (pdfjs сам попытается найти worker)
    // В худшем случае будет работать в режиме без воркера, что медленнее.
  }
}

/**
 * Преобразует массив строк в Markdown-параграфы.
 * Простая эвристика: сохраняем пустые строки, маркированные элементы и нумерацию.
 */
function linesToMarkdown(lines) {
  const out = [];
  let buffer = [];
  const flush = () => {
    if (buffer.length === 0) return;
    out.push(buffer.join(' '));
    buffer = [];
  };
  for (const rawLine of lines) {
    const line = String(rawLine ?? '').trim();
    if (line === '') {
      flush();
      out.push('');
      continue;
    }
    // Списки: оставляем как есть
    if (/^(\d+[\.|\)]\s+|[-*•]\s+)/.test(line)) {
      flush();
      out.push(line.replace(/^•\s+/, '- '));
      continue;
    }
    buffer.push(line);
  }
  flush();
  return out.join('\n');
}

/**
 * Конвертирует PDF (ArrayBuffer) в Markdown (best-effort: текст + списки).
 * @param {ArrayBuffer} arrayBuffer
 */
export async function convertPdfArrayBufferToMarkdown(arrayBuffer) {
  const pdfjs = await loadPdfJs();
  await ensurePdfWorker(pdfjs);
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = loadingTask.promise ? await loadingTask.promise : await loadingTask;
  const allLines = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent({ normalizeWhitespace: true });
    let line = '';
    for (const item of content.items) {
      const text = item?.str ?? '';
      if (!text) continue;
      line += (line ? ' ' : '') + text;
      if (item?.hasEOL) {
        allLines.push(line);
        line = '';
      }
    }
    if (line) {
      allLines.push(line);
    }
    allLines.push('');
  }
  const md = linesToMarkdown(allLines).trim();
  return md;
}


