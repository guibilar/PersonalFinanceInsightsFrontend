import { InjectionToken } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { IconName } from '../../shared/ui/icon/icon.component';
import { validationDetail } from '../../shared/utils/problem-detail';
import { isoDay } from '../../shared/utils/date-presets';
import {
  DocumentFileDto,
  DocumentKind,
  OcrStatus,
} from '../../core/models/outputs/document-output-dto';

/**
 * How the detail page follows a document while its text is read: it loads it again every `intervalMs`, for at most
 * `maxMs` after the upload or a retry. Tests make it faster.
 */
export const DOCUMENT_POLLING = new InjectionToken<{ intervalMs: number; maxMs: number }>(
  'DOCUMENT_POLLING',
  { providedIn: 'root', factory: () => ({ intervalMs: 3000, maxMs: 120_000 }) },
);

/** The limits of the Documents module (HestiaBackend, `Documents` settings and the domain). */
export const DOCUMENT_LIMITS = {
  /** One file: 25 MB. */
  fileBytes: 25 * 1024 * 1024,
  /** One upload, all files and the form together: 100 MB (also the nginx limit for `/api/documents`). */
  uploadBytes: 100 * 1024 * 1024,
  /** Room left in the upload for the form fields and the multipart envelope. */
  envelopeBytes: 64 * 1024,
  files: 10,
  title: 200,
  notes: 4000,
  tags: 20,
  tag: 50,
} as const;

/** The file types the host accepts. It finds the type in the content; the browser checks the name and type first. */
const ACCEPTED: readonly { type: string; extensions: readonly string[] }[] = [
  { type: 'application/pdf', extensions: ['pdf'] },
  { type: 'image/jpeg', extensions: ['jpg', 'jpeg'] },
  { type: 'image/png', extensions: ['png'] },
  { type: 'image/heic', extensions: ['heic', 'heif'] },
  { type: 'image/webp', extensions: ['webp'] },
];

/** For the file input: the types and extensions to offer. */
export const ACCEPTED_FILES = ACCEPTED.flatMap((a) => [
  a.type,
  ...a.extensions.map((e) => `.${e}`),
]).join(',');

/** Plural labels for the kind filters. */
export const KIND_FILTER_LABELS: Record<DocumentKind, string> = {
  Receipt: 'Receipts',
  Warranty: 'Warranties',
  Lease: 'Leases',
  Tax: 'Tax',
  Insurance: 'Insurance',
  Manual: 'Manuals',
  Other: 'Other',
};

/** The short label of an OCR state that needs a look, or null when there is nothing to say. */
export function ocrLabel(status: OcrStatus): string | null {
  return status === 'Pending' ? 'Reading text…' : status === 'Failed' ? 'Text not read' : null;
}

/** Whether the browser can show the file itself. HEIC is not shown by most browsers: it is a download. */
export function previewKind(file: DocumentFileDto): 'image' | 'pdf' | null {
  if (file.contentType === 'application/pdf') return 'pdf';
  if (['image/jpeg', 'image/png', 'image/webp'].includes(file.contentType)) return 'image';
  return null;
}

export function fileIcon(file: DocumentFileDto): IconName {
  return file.contentType.startsWith('image/') ? 'image' : 'file-text';
}

/** "820 KB", "20.5 MB". */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** The problems with the chosen files, as sentences; empty when they can go. */
export function checkFiles(files: readonly File[]): string[] {
  const problems: string[] = [];
  if (files.length > DOCUMENT_LIMITS.files) {
    problems.push(`A document can have at most ${DOCUMENT_LIMITS.files} files.`);
  }
  for (const file of files) {
    if (!accepted(file)) {
      problems.push(`“${file.name}” is not a PDF, JPEG, PNG, HEIC or WebP file.`);
    } else if (file.size > DOCUMENT_LIMITS.fileBytes) {
      problems.push(`“${file.name}” is larger than 25 MB.`);
    } else if (file.size === 0) {
      problems.push(`“${file.name}” is empty.`);
    }
  }
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > DOCUMENT_LIMITS.uploadBytes - DOCUMENT_LIMITS.envelopeBytes) {
    problems.push('The files together are larger than 100 MB. Upload them as two documents.');
  }
  return problems;
}

function accepted(file: File): boolean {
  const extension = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  // Some systems give no type for HEIC: then the name decides.
  return ACCEPTED.some((a) => a.type === file.type || a.extensions.includes(extension));
}

/** A title from a file name: "Kettle receipt.pdf" gives "Kettle receipt". */
export function titleFromFileName(name: string): string {
  const dot = name.lastIndexOf('.');
  return (dot > 0 ? name.slice(0, dot) : name).slice(0, DOCUMENT_LIMITS.title);
}

/** Tags typed as "kitchen, appliances": trimmed, without empties and repeats, in lower case (as the API keeps them). */
export function parseTags(text: string): string[] {
  const tags = text
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag !== '');
  return [...new Set(tags)];
}

/** Whole days from today to a day (`yyyy-MM-dd`): 0 today, negative when it is past. */
export function daysUntil(day: string, today: Date): number {
  const target = new Date(`${day.slice(0, 10)}T00:00:00`);
  const start = new Date(`${isoDay(today)}T00:00:00`);
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

/** "Expires today", "in 1 day", "in 22 days", "expired 3 days ago". */
export function expiryText(days: number): string {
  if (days === 0) return 'Expires today';
  if (days > 0) return `In ${days} ${days === 1 ? 'day' : 'days'}`;
  return `Expired ${-days} ${days === -1 ? 'day' : 'days'} ago`;
}

/**
 * What to say when the API refuses a change: its reason for invalid input (400), the read-only account (403), a
 * document that is gone (404), finance down for a link (502), or the fallback.
 */
export function changeError(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 403) return 'This account can only read documents.';
    if (error.status === 404) return 'This document does not exist any more.';
    if (error.status === 413) return 'The upload is larger than the server accepts (100 MB).';
    if (error.status === 502) return 'The server could not check with Money. Try again later.';
  }
  return validationDetail(error, fallback);
}

/** The "Expire soon" window: from today to 30 days ahead. */
export function expirySoonRange(today: Date): { expiresFrom: string; expiresTo: string } {
  const end = new Date(today);
  end.setDate(end.getDate() + 30);
  return { expiresFrom: isoDay(today), expiresTo: isoDay(end) };
}
