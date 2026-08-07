'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { FormatConfig, ParsedFile, CandidateRow } from '@/lib/types';
import { getFormats, deleteFormat, defaultFormat } from '@/lib/storage';
import { readFileAsRows, extractCandidates } from '@/lib/transform';
import FormatSetup from '@/components/FormatSetup';

type ImportStatus = 'idle' | 'importing' | 'done';

function hasAllCandidateFields(fmt: FormatConfig): boolean {
  const required = ['email', 'firstName', 'lastName', 'phone'] as const;
  return required.every((field) =>
    fmt.candidateFields.some((m) => m.field === field && m.inputColumn.trim() !== '')
  );
}

export default function Page() {
  const [formats, setFormats] = useState<FormatConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [showSetup, setShowSetup] = useState(false);
  const [editingFmt, setEditingFmt] = useState<FormatConfig | null>(null);
  const [dragging, setDragging] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importedCount, setImportedCount] = useState(0);
  const [addIfNotExists, setAddIfNotExists] = useState(false);
  const [overwriteTags, setOverwriteTags] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reloadFormats = useCallback(() => {
    const all = getFormats();
    setFormats(all);
    return all;
  }, []);

  useEffect(() => {
    const all = reloadFormats();
    if (all.length > 0) setSelectedId(all[0].id);
  }, [reloadFormats]);

  const selectedFmt = formats.find((f) => f.id === selectedId) ?? null;
  const canAddNew = selectedFmt ? hasAllCandidateFields(selectedFmt) : false;

  useEffect(() => {
    if (parsedFile && selectedFmt) {
      setCandidates(extractCandidates(parsedFile, selectedFmt));
      setImportStatus('idle');
    } else {
      setCandidates([]);
    }
  }, [parsedFile, selectedFmt]);

  // Reset addIfNotExists if format no longer has all fields
  useEffect(() => {
    if (!canAddNew) setAddIfNotExists(false);
  }, [canAddNew]);

  const handleFile = async (file: File) => {
    try {
      const parsed = await readFileAsRows(file);
      setParsedFile(parsed);
      setImportStatus('idle');
    } catch {
      alert('Could not read file. Make sure it is a CSV or Excel file.');
    }
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const openNew = () => {
    setEditingFmt(defaultFormat());
    setShowSetup(true);
  };

  const openEdit = () => {
    if (selectedFmt) {
      setEditingFmt({ ...selectedFmt });
      setShowSetup(true);
    }
  };

  const handleSaved = (fmt: FormatConfig) => {
    reloadFormats();
    setSelectedId(fmt.id);
    setShowSetup(false);
    setEditingFmt(null);
    if (parsedFile) setCandidates(extractCandidates(parsedFile, fmt));
  };

  const handleDeleted = (id: string) => {
    deleteFormat(id);
    const all = reloadFormats();
    setSelectedId(all[0]?.id ?? '');
    setShowSetup(false);
    setEditingFmt(null);
  };

  const handleImport = () => {
    setImportStatus('importing');
    setTimeout(() => {
      setImportedCount(candidates.length);
      setImportStatus('done');
    }, 1400);
  };

  const resetImport = () => {
    setParsedFile(null);
    setCandidates([]);
    setImportStatus('idle');
    setImportedCount(0);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">AllStar Recruiter — Import</h1>
            <p className="text-sm text-slate-500 mt-0.5">Import candidates from agency spreadsheets</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Format selector */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">File Format</h2>
          <div className="flex items-center gap-3">
            {formats.length > 0 ? (
              <select
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedId}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setParsedFile(null);
                  setCandidates([]);
                  setImportStatus('idle');
                }}
              >
                {formats.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            ) : (
              <p className="flex-1 text-sm text-slate-400 italic">No formats configured yet</p>
            )}
            {selectedFmt && (
              <button
                onClick={openEdit}
                className="text-sm px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
              >
                Edit
              </button>
            )}
            <button
              onClick={openNew}
              className="text-sm px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + New format
            </button>
          </div>
        </div>

        {/* File upload + import options (shown together once a format is selected) */}
        {selectedFmt && importStatus === 'idle' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Drop zone */}
            <div
              className={`border-b border-slate-200 p-8 text-center cursor-pointer transition-colors ${
                dragging ? 'bg-blue-50 border-blue-300' : 'hover:bg-slate-50/60'
              }`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <div className="text-3xl mb-2">📂</div>
              <p className="text-sm font-medium text-slate-700">
                {parsedFile
                  ? `${parsedFile.fileName} loaded — drop another to replace`
                  : 'Drop a file here or click to upload'}
              </p>
              <p className="text-xs text-slate-400 mt-1">CSV, XLSX, or XLS</p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onFileInput} />
            </div>

            {/* Import options */}
            <div className="px-6 py-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Import Options</h3>
              <div className="space-y-3">
                <label className={`flex items-start gap-3 ${canAddNew ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}>
                  <input
                    type="checkbox"
                    className="mt-0.5 w-4 h-4 rounded accent-blue-600"
                    checked={addIfNotExists}
                    disabled={!canAddNew}
                    onChange={(e) => setAddIfNotExists(e.target.checked)}
                  />
                  <div>
                    <div className="text-sm font-medium text-slate-700">Add candidate if not in system</div>
                    <div className="text-xs text-slate-500">
                      {canAddNew
                        ? 'Creates a new candidate record when no match is found — requires email, first name, last name, and phone'
                        : 'Requires all four fields to be mapped in the format: email, first name, last name, and phone'}
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 w-4 h-4 rounded accent-blue-600"
                    checked={overwriteTags}
                    onChange={(e) => setOverwriteTags(e.target.checked)}
                  />
                  <div>
                    <div className="text-sm font-medium text-slate-700">Overwrite existing matching candidates</div>
                    <div className="text-xs text-slate-500">Update existing candidate records when a match is found — names, emails, and phone numbers are never overwritten</div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Candidates preview */}
        {candidates.length > 0 && importStatus !== 'done' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-semibold text-slate-700">Preview</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} from {parsedFile?.fileName}
                </p>
              </div>
              <div className="flex gap-3 items-center">
                <button
                  onClick={resetImport}
                  className="text-sm px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
                >
                  Clear
                </button>
                <button
                  onClick={handleImport}
                  disabled={importStatus === 'importing'}
                  className="text-sm px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                >
                  {importStatus === 'importing' ? 'Importing…' : 'Import'}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Email</th>
                    <th className="text-left px-4 py-2.5 font-medium">First</th>
                    <th className="text-left px-4 py-2.5 font-medium">Last</th>
                    <th className="text-left px-4 py-2.5 font-medium">Phone</th>
                    <th className="text-left px-4 py-2.5 font-medium">Tags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {candidates.slice(0, 100).map((row, i) => {
                    const qualifiesForAdd =
                      canAddNew &&
                      addIfNotExists &&
                      !!row.email && !!row.firstName && !!row.lastName && !!row.phone;
                    return (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 font-mono text-xs">
                          <span className={row.email ? 'text-slate-700' : 'text-slate-300'}>{row.email || '—'}</span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{row.firstName || <span className="text-slate-300">—</span>}</td>
                        <td className="px-4 py-2.5 text-slate-700">{row.lastName || <span className="text-slate-300">—</span>}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{row.phone || <span className="text-slate-300">—</span>}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1 items-center">
                            {addIfNotExists && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${qualifiesForAdd ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                                {qualifiesForAdd ? '+ add' : 'skip add'}
                              </span>
                            )}
                            {row.tags.length === 0 ? (
                              <span className="text-slate-300 text-xs">—</span>
                            ) : (
                              row.tags.map((t, j) => (
                                <span key={j} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full border border-blue-100">
                                  {t.label}
                                  {t.date && <span className="text-blue-400 text-[10px]">{t.date}</span>}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {candidates.length > 100 && (
                <p className="text-xs text-slate-400 text-center py-3 border-t border-slate-100">
                  Showing first 100 of {candidates.length} candidates
                </p>
              )}
            </div>
          </div>
        )}

        {/* Import success */}
        {importStatus === 'done' && (
          <div className="bg-white rounded-xl border border-green-200 p-8 text-center">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-lg font-semibold text-slate-800 mb-1">Import complete</h2>
            <p className="text-sm text-slate-500 mb-4">
              {importedCount} candidate{importedCount !== 1 ? 's' : ''} processed from {parsedFile?.fileName}
            </p>
            <div className="flex justify-center gap-4 text-xs text-slate-500 mb-6">
              <span className={addIfNotExists ? 'text-green-600' : 'text-slate-400'}>
                {addIfNotExists ? '✓' : '✗'} Added new candidates
              </span>
              <span className={overwriteTags ? 'text-green-600' : 'text-slate-400'}>
                {overwriteTags ? '✓' : '✗'} Overwrote existing matching candidates
              </span>
            </div>
            <button
              onClick={resetImport}
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Import another file
            </button>
          </div>
        )}

        {/* Empty state */}
        {!selectedFmt && formats.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <div className="text-4xl mb-3">📋</div>
            <h2 className="text-base font-semibold text-slate-700 mb-1">No formats yet</h2>
            <p className="text-sm text-slate-400 mb-4">
              Create a format to map your agency spreadsheet columns to AllStar Recruiter fields.
            </p>
            <button onClick={openNew} className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Create first format
            </button>
          </div>
        )}
      </main>

      {/* Format setup modal */}
      {showSetup && editingFmt && (
        <FormatSetup
          initial={editingFmt}
          onSave={handleSaved}
          onCancel={() => { setShowSetup(false); setEditingFmt(null); }}
          onDelete={handleDeleted}
        />
      )}
    </div>
  );
}
