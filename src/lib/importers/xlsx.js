// Импорт XLS/XLSX → Markdown-таблицы (через xlsx)

/**
 * Загружает библиотеку xlsx динамически.
 */
async function loadXlsx() {
  const mod = await import('xlsx');
  return mod?.default ?? mod;
}

/**
 * Преобразует AOA-матрицу в Markdown-таблицу.
 * @param {any[][]} aoa
 */
function aoaToMarkdownTable(aoa) {
  const rows = Array.isArray(aoa) ? aoa : [];
  if (rows.length === 0) return '';
  const width = rows.reduce((w, r) => Math.max(w, (Array.isArray(r) ? r.length : 0)), 0);
  const normalize = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    return str.replace(/\|/g, '\\|');
  };
  const line = (cells) => `| ${cells.join(' | ')} |`;

  const header = Array.from({ length: width }, (_, i) => normalize(rows[0]?.[i] ?? ''));
  const sep = Array.from({ length: width }, () => '---');
  const body = rows.slice(1).map((r) => {
    const cells = Array.from({ length: width }, (_, i) => normalize(r?.[i] ?? ''));
    return line(cells);
  });

  return [
    line(header),
    line(sep),
    ...body
  ].join('\n');
}

/**
 * Конвертирует Excel-книгу (ArrayBuffer) в Markdown по листам.
 * @param {ArrayBuffer} arrayBuffer
 */
export async function convertSpreadsheetArrayBufferToMarkdown(arrayBuffer) {
  const XLSX = await loadXlsx();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const out = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, blankrows: false });
    const mdTable = aoaToMarkdownTable(aoa);
    if (mdTable) {
      out.push(`## ${sheetName}`);
      out.push('');
      out.push(mdTable);
      out.push('');
    }
  }
  return out.join('\n');
}


