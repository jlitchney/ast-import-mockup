'use client';

import { useState, useRef } from 'react';
import type { FormatConfig, CandidateFieldMapping } from '@/lib/types';
import { SYSTEM_FIELDS } from '@/lib/types';
import { saveFormat, newId } from '@/lib/storage';
import { readFileAsRows, detectColumnType } from '@/lib/transform';

interface Props {
  initial: FormatConfig;
  onSave: (fmt: FormatConfig) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
}

export default function FormatSetup({ initial, onSave, onCancel, onDelete }: Props) {
  const [fmt, setFmt] = useState<FormatConfig>(initial);
  const [detectedCols, setDetectedCols] = useState<string[]>([]);
  const [colTypes, setColTypes] = useState<Record<string, 'date' | 'value'>>({});
  const [detecting, setDetecting] = useState(false);
  const sampleRef = useRef<HTMLInputElement>(null);

  const updateFmt = (patch: Partial<FormatConfig>) => setFmt((f) => ({ ...f, ...patch }));

  const setCandidateField = (field: string, inputColumn: string) => {
    const existing = fmt.candidateFields.find((m) => m.field === field);
    if (existing) {
      updateFmt({
        candidateFields: fmt.candidateFields.map((m) =>
          m.field === field ? { ...m, inputColumn } : m
        ),
      });
    } else {
      updateFmt({
        candidateFields: [...fmt.candidateFields, { field: field as CandidateFieldMapping['field'], inputColumn }],
      });
    }
  };

  const getCandidateField = (field: string) =>
    fmt.candidateFields.find((m) => m.field === field)?.inputColumn ?? '';

  const addTagCol = () =>
    updateFmt({
      tagColumns: [
        ...fmt.tagColumns,
        { id: newId(), inputColumn: '', columnType: 'date', outputTagGroup: '', outputTagName: '' },
      ],
    });

  const updateTagCol = (id: string, patch: Partial<FormatConfig['tagColumns'][0]>) =>
    updateFmt({
      tagColumns: fmt.tagColumns.map((tc) => (tc.id === id ? { ...tc, ...patch } : tc)),
    });

  const removeTagCol = (id: string) =>
    updateFmt({ tagColumns: fmt.tagColumns.filter((tc) => tc.id !== id) });

  const detectFromFile = async (file: File) => {
    setDetecting(true);
    try {
      const parsed = await readFileAsRows(file);
      const cols = parsed.headers.filter(Boolean);
      const types = detectColumnType(parsed.headers, parsed.rows);
      setDetectedCols(cols);
      setColTypes(types);
    } finally {
      setDetecting(false);
    }
  };

  const handleColSelect = (id: string, inputColumn: string) => {
    const detectedType = colTypes[inputColumn] ?? 'date';
    updateTagCol(id, { inputColumn, columnType: detectedType });
  };

  const handleSave = () => {
    const trimmed = { ...fmt, name: fmt.name.trim() };
    if (!trimmed.name) return;
    saveFormat(trimmed);
    onSave(trimmed);
  };

  const ColSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    detectedCols.length > 0 ? (
      <select
        className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm bg-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— select column —</option>
        {detectedCols.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    ) : (
      <input
        className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm"
        placeholder="Column header name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 py-8 px-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">
            {initial.name ? 'Edit Format' : 'New Format'}
          </h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Format name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Format Name</label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Agency Weekly Report"
              value={fmt.name}
              onChange={(e) => updateFmt({ name: e.target.value })}
            />
          </div>

          {/* Detect columns from sample file */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-slate-700">Detect columns from a sample file</span>
              <button
                onClick={() => sampleRef.current?.click()}
                disabled={detecting}
                className="text-sm px-3 py-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 disabled:opacity-50"
              >
                {detecting ? 'Reading…' : 'Upload sample'}
              </button>
            </div>
            {detectedCols.length > 0 && (
              <p className="text-xs text-slate-500 mt-1">
                {detectedCols.length} columns detected — column types auto-identified
              </p>
            )}
            <input
              ref={sampleRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) detectFromFile(f); e.target.value = ''; }}
            />
          </div>

          {/* Candidate field mappings */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Candidate Fields</h3>
            <div className="space-y-2">
              {SYSTEM_FIELDS.map(({ field, label, required }) => (
                <div key={field} className="flex items-center gap-3">
                  <span className="w-28 text-sm text-slate-600 shrink-0">
                    {label}
                    {required && <span className="text-red-500 ml-0.5">*</span>}
                  </span>
                  <div className="flex-1">
                    <ColSelect
                      value={getCandidateField(field)}
                      onChange={(v) => setCandidateField(field, v)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tag columns */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Tag Columns</h3>
                <p className="text-xs text-slate-400 mt-0.5">Date columns: cell value = tag date. Value columns: cell value = tag name, today = date.</p>
              </div>
              <button
                onClick={addTagCol}
                className="text-sm px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shrink-0"
              >
                + Add column
              </button>
            </div>

            {fmt.tagColumns.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">
                No tag columns configured
              </p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_auto_1fr_1fr_auto] gap-2 text-xs font-medium text-slate-500 px-1">
                  <span>Input Column</span>
                  <span>Type</span>
                  <span>Tag Group</span>
                  <span>Tag Name</span>
                  <span />
                </div>
                {fmt.tagColumns.map((tc) => (
                  <div key={tc.id} className="grid grid-cols-[1fr_auto_1fr_1fr_auto] gap-2 items-center">
                    {/* Input column */}
                    <ColSelect
                      value={tc.inputColumn}
                      onChange={(v) => handleColSelect(tc.id, v)}
                    />

                    {/* Column type toggle */}
                    <div className="flex rounded-lg border border-slate-300 overflow-hidden text-xs shrink-0">
                      <button
                        onClick={() => updateTagCol(tc.id, { columnType: 'date' })}
                        className={`px-2 py-1.5 ${tc.columnType === 'date' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                      >
                        Date
                      </button>
                      <button
                        onClick={() => updateTagCol(tc.id, { columnType: 'value' })}
                        className={`px-2 py-1.5 border-l border-slate-300 ${tc.columnType === 'value' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                      >
                        Value
                      </button>
                    </div>

                    {/* Tag Group */}
                    <input
                      className="border border-slate-300 rounded px-2 py-1 text-sm"
                      placeholder={tc.columnType === 'value' ? tc.inputColumn || 'e.g. Status' : 'e.g. Exams'}
                      value={tc.outputTagGroup}
                      onChange={(e) => updateTagCol(tc.id, { outputTagGroup: e.target.value })}
                    />

                    {/* Tag Name */}
                    {tc.columnType === 'date' ? (
                      <input
                        className="border border-slate-300 rounded px-2 py-1 text-sm"
                        placeholder={tc.inputColumn || 'e.g. Oral Interview'}
                        value={tc.outputTagName}
                        onChange={(e) => updateTagCol(tc.id, { outputTagName: e.target.value })}
                      />
                    ) : (
                      <div className="border border-slate-200 rounded px-2 py-1 text-sm text-slate-400 bg-slate-50 italic">
                        from cell
                      </div>
                    )}

                    <button
                      onClick={() => removeTagCol(tc.id)}
                      className="text-slate-400 hover:text-red-500 text-lg leading-none px-1"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <div>
            {onDelete && initial.name && (
              <button
                onClick={() => { if (confirm('Delete this format?')) onDelete(initial.id); }}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Delete format
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onCancel} className="text-sm px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-700">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!fmt.name.trim()}
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save format
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
