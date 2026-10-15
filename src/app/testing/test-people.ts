import {
  LoanDto,
  PeopleSummaryDto,
  PersonDto,
  PersonSummaryDto,
} from '../core/models/outputs/people-output-dto';
import { PaginatedResult } from '../core/models/outputs/paginated-result-output-dto';

export const PERSON_ID = '0199f1a0-8888-7000-8000-000000000008';
export const ANA_ID = '0199f1a0-9999-7000-8000-000000000009';
export const LOAN_ID = '0199f1a0-aaaa-7000-8000-00000000000a';
export const PEOPLE_TODAY = '2026-10-14';

/** Marco: a friend in the gaming group, birthday Nov 2, 1990, a 6-week reminder, last contact Aug 28 (overdue). */
export function testPersonSummary(changes: Partial<PersonSummaryDto> = {}): PersonSummaryDto {
  return {
    id: PERSON_ID,
    name: 'Marco Silva',
    nickname: null,
    relationship: 'Friend',
    groups: ['gaming group'],
    birthday: { month: 11, day: 2, year: 1990 },
    nextBirthday: '2026-11-02',
    email: 'marco@example.com',
    phone: null,
    contactEveryDays: 42,
    lastContactOn: '2026-08-28',
    contactDueOn: '2026-10-09',
    contactOverdue: true,
    createdAt: '2026-01-10T15:00:00Z',
    updatedAt: '2026-08-28T15:00:00Z',
    ...changes,
  };
}

export function testLoan(changes: Partial<LoanDto> = {}): LoanDto {
  return {
    id: LOAN_ID,
    personId: PERSON_ID,
    personName: 'Marco Silva',
    itemName: 'Camping stove',
    direction: 'Lent',
    lentOn: '2026-07-04',
    dueOn: '2026-08-01',
    returnedOn: null,
    overdue: true,
    notes: null,
    createdAt: '2026-07-04T15:00:00Z',
    ...changes,
  };
}

/** Marco with one contact, two gift ideas and one given gift, and one open loan. */
export function testPerson(changes: Partial<PersonDto> = {}): PersonDto {
  return {
    person: testPersonSummary(),
    notes: null,
    interactions: [
      {
        id: 'c1',
        personId: PERSON_ID,
        occurredOn: '2026-08-28',
        kind: 'Coffee',
        note: 'Talked about his new job.',
        createdAt: '2026-08-28T15:00:00Z',
      },
    ],
    interactionCount: 1,
    giftIdeas: [
      {
        id: 'g1',
        personId: PERSON_ID,
        title: 'Pour-over coffee kettle',
        notes: null,
        price: 49.5,
        occasion: 'Birthday',
        givenOn: null,
        createdAt: '2026-09-01T15:00:00Z',
      },
      {
        id: 'g2',
        personId: PERSON_ID,
        title: 'Hiking day pack',
        notes: null,
        price: null,
        occasion: null,
        givenOn: null,
        createdAt: '2026-09-02T15:00:00Z',
      },
      {
        id: 'g3',
        personId: PERSON_ID,
        title: 'Board game',
        notes: null,
        price: 64,
        occasion: 'Christmas',
        givenOn: '2025-12-25',
        createdAt: '2025-12-01T15:00:00Z',
      },
    ],
    loans: [testLoan()],
    links: [],
    ...changes,
  };
}

export function testPeopleSummary(changes: Partial<PeopleSummaryDto> = {}): PeopleSummaryDto {
  return {
    date: PEOPLE_TODAY,
    peopleCount: 2,
    reachOut: [testPersonSummary()],
    upcoming: [
      {
        personId: PERSON_ID,
        name: 'Marco Silva',
        date: '2026-11-02',
        days: 19,
        age: 36,
        giftIdeas: 2,
      },
    ],
    openLoans: 1,
    overdueLoans: 1,
    ...changes,
  };
}

export function testPeoplePage(items: PersonSummaryDto[]): PaginatedResult<PersonSummaryDto> {
  return {
    items,
    page: 1,
    pageSize: 100,
    totalCount: items.length,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  };
}
