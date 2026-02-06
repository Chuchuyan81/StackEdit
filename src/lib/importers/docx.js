// Импорт DOCX → Markdown (через mammoth → HTML → turndown)

/**
 * Пытается загрузить mammoth (браузерную сборку) с несколькими вариантами путей.
 * @returns {Promise<any>}
 */
async function loadMammoth() {
  try {
    // В Vite/ESM mammoth.browser.js часто нужно грузить как файл
    const mod = await import('mammoth/mammoth.browser.js');
    // Mammoth в браузерной сборке часто вешает себя на window или экспортирует как default
    const mammoth = mod?.default ?? mod?.mammoth ?? (typeof window !== 'undefined' ? window.mammoth : mod);

    if (mammoth && typeof mammoth.convertToHtml === 'function') {
      return mammoth;
    }

    // Фолбэк на стандартный импорт если первый не сработал
    const stdMod = await import('mammoth');
    const stdMammoth = stdMod?.default ?? stdMod?.mammoth ?? stdMod;
    if (stdMammoth && typeof stdMammoth.convertToHtml === 'function') {
      return stdMammoth;
    }
  } catch (e) {
    console.error('Ошибка загрузки mammoth:', e);
    throw e;
  }
  throw new Error('Не удалось загрузить mammoth');
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
  // Исправляем способ извлечения плагина GFM
  let gfmPlugin = null;
  if (gfmModule.gfm) gfmPlugin = gfmModule.gfm;
  else if (gfmModule.default && gfmModule.default.gfm) gfmPlugin = gfmModule.default.gfm;
  else if (typeof gfmModule.default === 'function') gfmPlugin = gfmModule.default;
  else gfmPlugin = gfmModule;

  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*'
  });

  if (typeof gfmPlugin === 'function') {
    try {
      service.use(gfmPlugin);
    } catch (e) {
      console.warn('Не удалось применить GFM плагин:', e);
    }
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
    convertImage: mammoth.images.inline(function (element) {
      return element.read('base64').then(function (imageBuffer) {
        const mime = element.contentType || 'image/png';
        return { src: `data:${mime};base64,${imageBuffer}` };
      });
    })
  });
  const html = result?.value ?? '';
  const markdown = await htmlToMarkdown(html);
  return String(markdown || '').trim();
}


