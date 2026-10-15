import { TimelineDto, TimelineEntry } from '../core/models/outputs/timeline-output-dto';

export function testEntry(changes: Partial<TimelineEntry> = {}): TimelineEntry {
  return {
    id: 'money.transaction.t1',
    module: 'Money',
    kind: 'transaction',
    day: '2026-10-10',
    at: null,
    title: 'COSTCO',
    text: 'Groceries · CIBC Visa',
    amount: -142.18,
    link: '/money/transactions?id=t1',
    ...changes,
  };
}

/** Oct 4 to Oct 10, 2026: a transaction and a journal entry today, a document and a task done yesterday. */
export function testTimeline(changes: Partial<TimelineDto> = {}): TimelineDto {
  return {
    today: '2026-10-10',
    from: '2026-09-27',
    to: '2026-10-10',
    earlier: '2026-09-27',
    days: [
      {
        day: '2026-10-10',
        entries: [
          testEntry(),
          testEntry({
            id: 'journal.entry.e1',
            module: 'Journal',
            kind: 'entry',
            title: 'Journal',
            text: 'Finished the handouts.',
            amount: null,
            link: '/journal?day=2026-10-10',
          }),
        ],
      },
      {
        day: '2026-10-09',
        entries: [
          testEntry({
            id: 'documents.document-added.d1',
            module: 'Documents',
            kind: 'document-added',
            day: '2026-10-09',
            at: '2026-10-10T02:30:00Z',
            title: 'Car insurance policy',
            text: 'Insurance',
            amount: null,
            link: '/documents/d1',
          }),
        ],
      },
    ],
    modules: ['Documents', 'Home', 'Journal', 'Money', 'People', 'Tasks'].map((module) => ({
      module,
      status: 'Complete' as const,
    })),
    ...changes,
  };
}
