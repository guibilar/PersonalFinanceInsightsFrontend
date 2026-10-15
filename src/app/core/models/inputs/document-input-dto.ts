import { DocumentKind } from '../outputs/document-output-dto';

/**
 * The details of a document: for an upload (with the files), and for `PUT /api/documents/{id}`. A `PUT` replaces all
 * of them: a value that is not sent becomes empty.
 */
export interface DocumentDetailsInputDto {
  title: string;
  kind: DocumentKind;
  tags: string[];
  /** A day, `yyyy-MM-dd`, or null. */
  issuedOn: string | null;
  /** A day, `yyyy-MM-dd`, or null. */
  expiresOn: string | null;
  notes: string | null;
}

/** The filters of the document list (`GET /api/documents`). Empty values are not sent. */
export interface DocumentListQuery {
  kind?: DocumentKind | null;
  tag?: string | null;
  /** Full-text search in the title, tags, notes and OCR text. */
  q?: string | null;
  /** `yyyy-MM-dd`, included. */
  expiresFrom?: string | null;
  /** `yyyy-MM-dd`, included. */
  expiresTo?: string | null;
  /** `soon`: from the server's today to `Documents:Expiry:SoonDays` ahead (T86). */
  expiring?: 'soon' | null;
  page?: number;
  pageSize?: number;
}
