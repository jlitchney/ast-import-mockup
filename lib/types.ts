export type SystemField = 'email' | 'firstName' | 'lastName' | 'phone';

export const SYSTEM_FIELDS: { field: SystemField; label: string; required?: boolean }[] = [
  { field: 'email',     label: 'Email',      required: true },
  { field: 'firstName', label: 'First Name' },
  { field: 'lastName',  label: 'Last Name' },
  { field: 'phone',     label: 'Phone' },
];

export interface CandidateFieldMapping {
  field: SystemField;
  inputColumn: string;
}

export interface TagColumnMapping {
  id: string;
  inputColumn: string;
  outputTagGroup: string;
  outputTagName: string;
}

export interface FormatConfig {
  id: string;
  name: string;
  candidateFields: CandidateFieldMapping[];
  tagColumns: TagColumnMapping[];
}

export interface ParsedFile {
  headers: string[];
  rows: (string | number | Date | null | undefined)[][];
  fileName: string;
}

export interface CandidateRow {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  tags: { label: string; date: string }[];
}
