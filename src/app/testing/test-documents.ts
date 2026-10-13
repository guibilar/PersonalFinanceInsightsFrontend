import { DocumentDto, DocumentSummaryDto } from '../core/models/outputs/document-output-dto';
import { PaginatedResult } from '../core/models/outputs/paginated-result-output-dto';
import { TransactionOutputDto } from '../core/models/outputs/transaction-output-dto';
import { AccountType } from '../core/models/enums/account-type';
import { Flow } from '../core/models/enums/flow';

export const DOC_ID = '0199f1a0-1111-7000-8000-000000000001';
export const PDF_ID = '0199f1a0-2222-7000-8000-000000000002';
export const PHOTO_ID = '0199f1a0-3333-7000-8000-000000000003';
export const TX_ID = '0199f0a2-7c3e-7d41-9a51-3f6e2b8c1d07';

/** A warranty with a PDF and a photo, its text read. */
export function testDocument(changes: Partial<DocumentDto> = {}): DocumentDto {
  return {
    id: DOC_ID,
    title: 'Dishwasher warranty',
    kind: 'Warranty',
    tags: ['kitchen', 'appliances'],
    issuedOn: '2024-11-09',
    expiresOn: '2026-11-09',
    notes: 'Bought at Costco',
    createdAt: '2026-10-01T15:00:00Z',
    updatedAt: '2026-10-01T15:00:00Z',
    ocrStatus: 'Done',
    ocrError: null,
    ocrText: 'LIMITED WARRANTY two years',
    files: [
      {
        id: PDF_ID,
        fileName: 'warranty.pdf',
        contentType: 'application/pdf',
        size: 820_000,
        sha256: 'a'.repeat(64),
        addedAt: '2026-10-01T15:00:00Z',
      },
      {
        id: PHOTO_ID,
        fileName: 'label.jpg',
        contentType: 'image/jpeg',
        size: 2_400_000,
        sha256: 'b'.repeat(64),
        addedAt: '2026-10-01T15:00:00Z',
      },
    ],
    links: [],
    ...changes,
  };
}

export function testSummary(changes: Partial<DocumentSummaryDto> = {}): DocumentSummaryDto {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { ocrError, ocrText, ...summary } = testDocument();
  return { ...summary, ...changes };
}

export function testPage<T>(items: T[], page = 1, totalCount = items.length): PaginatedResult<T> {
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  return {
    items,
    page,
    pageSize,
    totalCount,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  };
}

export function testTransaction(changes: Partial<TransactionOutputDto> = {}): TransactionOutputDto {
  return {
    id: TX_ID,
    date: '2026-10-03T00:00:00Z',
    amount: -142.18,
    description: 'COSTCO WHOLESALE',
    category: { id: 'c-home', name: 'Home', color: '#888888' },
    categoryLocked: false,
    accountId: 'a-visa',
    accountName: 'Visa',
    accountType: AccountType.CreditCard,
    flow: Flow.Spending,
    flowLocked: false,
    budgetId: '',
    ...changes,
  };
}
