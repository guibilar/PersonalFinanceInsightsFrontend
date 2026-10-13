/**
 * The Documents module of Hestia.Api (`/api/documents`). Written by hand from the contracts in HestiaBackend
 * (`Hestia.Modules.Documents.Contracts/DocumentDtos.cs`).
 */

/** What a document is. */
export type DocumentKind =
  'Receipt' | 'Warranty' | 'Lease' | 'Tax' | 'Insurance' | 'Manual' | 'Other';

/** All kinds, in the order the filters and the forms show them. */
export const DOCUMENT_KINDS: readonly DocumentKind[] = [
  'Receipt',
  'Warranty',
  'Lease',
  'Tax',
  'Insurance',
  'Manual',
  'Other',
];

/**
 * The text recognition. `Pending`: not run yet (it runs in the background, soon after the upload). `Done`: the text
 * is in `ocrText`. `Failed`: `ocrError` says why; it can run again. `NotNeeded`: OCR was off for this document.
 */
export type OcrStatus = 'Pending' | 'Done' | 'Failed' | 'NotNeeded';

/** One file of a document. Download it at `/api/documents/{documentId}/files/{id}`. */
export interface DocumentFileDto {
  id: string;
  fileName: string;
  /** The type that the host found in the file content: a PDF, JPEG, PNG, HEIC or WebP type. */
  contentType: string;
  /** In bytes. */
  size: number;
  sha256: string;
  addedAt: string;
}

/** The link kind of a finance transaction. */
export const MONEY_TRANSACTION_LINK = 'Money.Transaction';

/** A link from a document to something in another module, for example a transaction. */
export interface DocumentLinkDto {
  id: string;
  /** For example `Money.Transaction`. */
  kind: string;
  targetId: string;
  createdAt: string;
}

/** A document in a list: everything except the OCR text. */
export interface DocumentSummaryDto {
  id: string;
  title: string;
  kind: DocumentKind;
  /** In lower case. */
  tags: string[];
  /** A day, `yyyy-MM-dd`. */
  issuedOn: string | null;
  /** A day, `yyyy-MM-dd`. */
  expiresOn: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  ocrStatus: OcrStatus;
  files: DocumentFileDto[];
  links: DocumentLinkDto[];
}

/** One document, with its OCR text. */
export interface DocumentDto extends DocumentSummaryDto {
  ocrError: string | null;
  /** Null before the OCR. */
  ocrText: string | null;
}
