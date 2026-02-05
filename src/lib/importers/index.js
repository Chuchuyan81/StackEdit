// Расширение импорта: агрегатор форматов → Markdown
// Все сообщения и комментарии — на русском языке.

/**
 * Определяет тип импортируемого файла по расширению.
 * @param {string} fileName
 * @returns {"docx"|"doc"|"xls"|"xlsx"|"pdf"|null}
 */
export function detectImportFormat(fileName) {
  if (!fileName) return null;
  const lower = String(fileName).toLowerCase();
  if (lower.endsWith('.docx')) return 'docx';
  if (lower.endsWith('.doc')) return 'doc';
  if (lower.endsWith('.xlsx')) return 'xlsx';
  if (lower.endsWith('.xls')) return 'xls';
  if (lower.endsWith('.pdf')) return 'pdf';
  return null;
}

/**
 * Проверяет, поддерживается ли импорт для файла.
 * @param {string} fileName
 */
export function isSupportedImportFile(fileName) {
  return detectImportFormat(fileName) !== null;
}

/**
 * Читает файл как ArrayBuffer.
 * @param {File} file
 * @returns {Promise<ArrayBuffer>}
 */
async function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (e) => reject(e);
      reader.readAsArrayBuffer(file);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Декодирует файл как текст с указанием кодировки (фолбэк для неподдерживаемых форматов).
 * @param {File} file
 * @param {string} encodingLabel
 * @returns {Promise<string>}
 */
async function readFileAsTextWithEncoding(file, encodingLabel) {
  const normalized = normalizeEncodingLabel(encodingLabel);
  const buffer = await readFileAsArrayBuffer(file);
  try {
    return new TextDecoder(normalized).decode(buffer);
  } catch (e) {
    console.warn('Выбранная кодировка не поддерживается, используем UTF-8 по умолчанию');
    return new TextDecoder('utf-8').decode(buffer);
  }
}

/**
 * Нормализует метку кодировки.
 * @param {string} label
 */
function normalizeEncodingLabel(label) {
  if (!label) return 'utf-8';
  const lower = String(label).toLowerCase();
  if (lower.includes('1251')) return 'windows-1251';
  return 'utf-8';
}

/**
 * Импортирует произвольный поддерживаемый документ в Markdown.
 * В случае ошибки выполняет фолбэк (опционально) — вернуть простой текст из файла.
 * @param {File} file
 * @param {{ encoding?: string, fallbackToPlainText?: boolean }} options
 * @returns {Promise<{ markdown: string, warnings: string[] }>} 
 */
export async function importFileToMarkdown(file, options = {}) {
  const { encoding = 'utf-8', fallbackToPlainText = false } = options;
  if (!file) throw new Error('Файл не передан');

  const format = detectImportFormat(file.name);
  console.log('Импорт файла:', file.name, 'формат:', format);
  if (!format) {
    throw new Error('Формат файла не поддерживается для импорта');
  }

  const warnings = [];

  try {
    if (format === 'xlsx' || format === 'xls') {
      const module = await import('./xlsx.js');
      const convertSpreadsheetArrayBufferToMarkdown = module.convertSpreadsheetArrayBufferToMarkdown;
      if (typeof convertSpreadsheetArrayBufferToMarkdown !== 'function') {
        throw new Error('Функция конвертации Excel не найдена');
      }
      const buffer = await readFileAsArrayBuffer(file);
      const markdown = await convertSpreadsheetArrayBufferToMarkdown(buffer);
      return { markdown, warnings };
    }

    if (format === 'docx') {
      const module = await import('./docx.js');
      const convertDocxArrayBufferToMarkdown = module.convertDocxArrayBufferToMarkdown;
      if (typeof convertDocxArrayBufferToMarkdown !== 'function') {
        throw new Error('Функция конвертации Word не найдена');
      }
      const buffer = await readFileAsArrayBuffer(file);
      const markdown = await convertDocxArrayBufferToMarkdown(buffer);
      return { markdown, warnings };
    }

    if (format === 'pdf') {
      const { convertPdfArrayBufferToMarkdown } = await import('./pdf.js');
      const buffer = await readFileAsArrayBuffer(file);
      const markdown = await convertPdfArrayBufferToMarkdown(buffer);
      return { markdown, warnings };
    }

    if (format === 'doc') {
      // DOC (старый формат) в браузере надёжно не конвертируется без сервера.
      // Сообщаем о невозможности и предлагаем фолбэк на простой текст.
      warnings.push('Формат .doc не поддерживается движком импорта. Рекомендуется сохранить документ как .docx.');
      if (fallbackToPlainText) {
        const text = await readFileAsTextWithEncoding(file, encoding);
        return { markdown: text, warnings };
      }
      throw new Error('Формат .doc не поддерживается. Сохраните файл как .docx и попробуйте снова.');
    }

    throw new Error('Неизвестный формат файла');
  } catch (error) {
    if (fallbackToPlainText) {
      try {
        const text = await readFileAsTextWithEncoding(file, encoding);
        warnings.push('Выполнен фолбэк: импорт как простой текст.');
        return { markdown: text, warnings };
      } catch (e) {
        throw error;
      }
    }
    throw error;
  }
}


