import type { FormatConfig, ParsedFile, CandidateRow, TagColumnMapping } from './types';

function formatDateValue(value: string): string {
  // xlsx returns ISO strings like "2026-08-22T07:00:00.000Z" — use UTC to avoid day shift
  try {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      const y = d.getUTCFullYear();
      return `${m}/${day}/${y}`;
    }
  } catch {}
  return value;
}

function todayFormatted(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}/${day}/${d.getFullYear()}`;
}

export function looksLikeDate(value: string): boolean {
  if (!value) return false;
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return true;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) return true;
  const d = new Date(value);
  return !isNaN(d.getTime()) && /\d{4}/.test(value) && value.length >= 8;
}

export function detectColumnType(
  headers: string[],
  rows: (string | number | Date | null | undefined)[][]
): Record<string, 'date' | 'value'> {
  const result: Record<string, 'date' | 'value'> = {};
  headers.forEach((h, i) => {
    const vals = rows.map((r) => r[i]).filter((v) => v != null && String(v).trim() !== '');
    if (vals.length === 0) { result[h] = 'value'; return; }
    const dateCount = vals.filter((v) => looksLikeDate(String(v))).length;
    result[h] = dateCount / vals.length >= 0.5 ? 'date' : 'value';
  });
  return result;
}

export async function readFileAsRows(file: File): Promise<ParsedFile> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'csv') {
    const Papa = (await import('papaparse')).default;
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (result) => {
          const rows = result.data as string[][];
          const headers = (rows[0] ?? []).map(String);
          resolve({ headers, rows: rows.slice(1), fileName: file.name });
        },
        error: reject,
      });
    });
  }

  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
  });
  const headers = ((rawRows[0] ?? []) as unknown[]).map(String);
  return { headers, rows: rawRows.slice(1) as (string | number | Date | null)[][], fileName: file.name };
}

export function extractCandidates(file: ParsedFile, config: FormatConfig): CandidateRow[] {
  const { headers, rows } = file;
  const today = todayFormatted();

  const fieldIndex = new Map<string, number>();
  for (const mapping of config.candidateFields) {
    if (mapping.inputColumn) {
      const idx = headers.indexOf(mapping.inputColumn);
      if (idx >= 0) fieldIndex.set(mapping.field, idx);
    }
  }

  // Auto-detect column type from actual file data
  const colTypes = detectColumnType(headers, rows);

  const tagCols = config.tagColumns
    .filter((tc) => tc.inputColumn)
    .map((tc) => ({ tc, idx: headers.indexOf(tc.inputColumn), isDate: colTypes[tc.inputColumn] === 'date' }))
    .filter((t) => t.idx >= 0);

  const emailIdx = fieldIndex.get('email') ?? -1;

  return rows
    .map((row) => {
      const get = (idx: number) => (idx >= 0 ? String(row[idx] ?? '').trim() : '');
      const tags: { label: string; date: string }[] = [];

      for (const { tc, idx, isDate } of tagCols) {
        const raw = row[idx];
        if (raw == null || String(raw).trim() === '') continue;
        const cellValue = String(raw).trim();

        if (isDate) {
          const group = tc.outputTagGroup?.trim();
          const name = tc.outputTagName?.trim() || tc.inputColumn;
          const label = group ? `${group} > ${name}` : name;
          tags.push({ label, date: formatDateValue(cellValue) });
        } else {
          const group = tc.outputTagGroup?.trim() || tc.inputColumn;
          const label = `${group} > ${cellValue}`;
          tags.push({ label, date: today });
        }
      }

      return {
        email: get(emailIdx),
        firstName: get(fieldIndex.get('firstName') ?? -1),
        lastName: get(fieldIndex.get('lastName') ?? -1),
        phone: get(fieldIndex.get('phone') ?? -1),
        tags,
      };
    })
    .filter((r) => r.email || r.firstName || r.lastName);
}
