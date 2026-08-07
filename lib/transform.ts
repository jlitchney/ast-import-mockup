import type { FormatConfig, ParsedFile, CandidateRow, TagColumnMapping } from './types';

function buildTagLabel(tc: TagColumnMapping): string {
  const group = tc.outputTagGroup?.trim();
  const name = tc.outputTagName?.trim() || tc.inputColumn;
  return group ? `${group} > ${name}` : name;
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

  const fieldIndex = new Map<string, number>();
  for (const mapping of config.candidateFields) {
    if (mapping.inputColumn) {
      const idx = headers.indexOf(mapping.inputColumn);
      if (idx >= 0) fieldIndex.set(mapping.field, idx);
    }
  }

  const tagCols = config.tagColumns
    .filter((tc) => tc.inputColumn)
    .map((tc) => ({ tc, idx: headers.indexOf(tc.inputColumn), label: buildTagLabel(tc) }))
    .filter((t) => t.idx >= 0);

  const emailIdx = fieldIndex.get('email') ?? -1;

  return rows
    .map((row) => {
      const get = (idx: number) => (idx >= 0 ? String(row[idx] ?? '').trim() : '');
      const tags = tagCols
        .filter(({ idx }) => row[idx] != null && String(row[idx]).trim() !== '')
        .map(({ label, idx }) => ({ label, date: String(row[idx]).trim() }));

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
