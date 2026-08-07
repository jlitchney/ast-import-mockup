import type { FormatConfig, ParsedFile, CandidateRow, TagColumnMapping } from './types';

function formatDateValue(value: string | number | Date | null | undefined): string {
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${m}/${day}/${value.getUTCFullYear()}`;
  }
  const s = String(value ?? '').trim();
  if (!s) return s;
  // ISO string fallback (e.g. from CSV or older XLSX paths)
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    try {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${m}/${day}/${d.getUTCFullYear()}`;
      }
    } catch {}
  }
  return s;
}

function todayFormatted(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}/${day}/${d.getFullYear()}`;
}

export function looksLikeDate(value: unknown): boolean {
  if (value instanceof Date) return !isNaN(value.getTime());
  if (value == null) return false;
  const s = String(value).trim();
  if (!s || !/\d/.test(s)) return false;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return true;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return true;
  const d = new Date(s);
  return !isNaN(d.getTime()) && /\d{4}/.test(s) && s.length >= 8;
}

export function detectColumnType(
  headers: string[],
  rows: (string | number | Date | null | undefined)[][]
): Record<string, 'date' | 'value'> {
  const result: Record<string, 'date' | 'value'> = {};
  headers.forEach((h, i) => {
    const vals = rows.map((r) => r[i]).filter((v) => v != null && String(v).trim() !== '');
    if (vals.length === 0) { result[h] = 'value'; return; }
    const dateCount = vals.filter((v) => looksLikeDate(v)).length;
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
  // cellDates: true → date cells become Date objects; raw: true → keep them as-is (not re-formatted as strings)
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
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

        if (isDate) {
          const group = tc.outputTagGroup?.trim();
          const name = tc.outputTagName?.trim() || tc.inputColumn;
          const label = group ? `${group} > ${name}` : name;
          tags.push({ label, date: formatDateValue(raw) });
        } else {
          const cellValue = String(raw).trim();
          const group = tc.outputTagGroup?.trim() || tc.inputColumn;
          tags.push({ label: `${group} > ${cellValue}`, date: today });
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
