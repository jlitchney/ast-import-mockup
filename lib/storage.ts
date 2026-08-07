'use client';

import type { FormatConfig } from './types';

const KEY = 'ast_import_formats';

export function getFormats(): FormatConfig[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch { return []; }
}

export function saveFormat(fmt: FormatConfig): void {
  const all = getFormats();
  const idx = all.findIndex((f) => f.id === fmt.id);
  if (idx >= 0) all[idx] = fmt; else all.push(fmt);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function deleteFormat(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(getFormats().filter((f) => f.id !== id)));
}

export function newId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function defaultFormat(): FormatConfig {
  return {
    id: newId(),
    name: '',
    candidateFields: [{ field: 'email', inputColumn: '' }],
    tagColumns: [],
  };
}
