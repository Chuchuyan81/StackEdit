// Импорт DOCX → Markdown (через mammoth → HTML → turndown)

/**
 * Пытается загрузить mammoth (браузерную сборку) с несколькими вариантами путей.
 * @returns {Promise<any>}
 */
async function loadMammoth() {
  const candidates = [
    () => import('mammoth/mammoth.browser.js'),
    () => import('mammoth/mammoth.browser'),
    () => import('mammoth')
  ];
  let lastError = null;
  for (const loader of candidates) {
    try {
      // Некоторые сборки экспортируют по-разному: default или именованный объект
      const mod = await loader();
      const mammoth = mod?.default ?? mod?.mammoth ?? mod;
      if (mammoth && typeof mammoth.convertToHtml === 'function') {
        return mammoth;
      }
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error('Не удалось загрузить mammoth');
}

/**
 * Преобразует HTML в Markdown с помощью turndown + GFM.
 * @param {string} html
 * @returns {Promise<string>}
 */
async function htmlToMarkdown(html) {
  const TurndownServiceModule = await import('turndown');
  const TurndownService = TurndownServiceModule?.default ?? TurndownServiceModule;
  const gfmModule = await import('turndown-plugin-gfm');
  const gfm = gfmModule?.gfm ?? gfmModule?.default ?? gfmModule;

  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*'
  });
  if (gfm) {
    service.use(gfm);
  }

  // Сохраняем переносы строк из параграфов более аккуратно
  service.addRule('preserve-line-breaks', {
    filter: ['br'],
    replacement: () => '  \n'
  });

  return service.turndown(String(html ?? ''));
}

/**
 * Конвертирует DOCX (ArrayBuffer) в Markdown.
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<string>}
 */
export async function convertDocxArrayBufferToMarkdown(arrayBuffer) {
  const mammoth = await loadMammoth();
  const result = await mammoth.convertToHtml({ arrayBuffer }, {
    // Встраиваем изображения как base64, чтобы turndown сохранил ссылки
    convertImage: mammoth.images.inline(function(element) {
      return element.read('base64').then(function(imageBuffer) {
        const mime = element.contentType || 'image/png';
        return { src: `data:${mime};base64,${imageBuffer}` };
      });
    })
  });
  const html = result?.value ?? '';
  const markdown = await htmlToMarkdown(html);
  return String(markdown || '').trim();
}


