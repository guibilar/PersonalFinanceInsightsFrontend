/**
 * The People module of Hestia.Api (`/api/people`): people, contacts, gift ideas, and loans. Written by hand from the
 * contracts in HestiaBackend (`Hestia.Modules.People.Contracts/PeopleDtos.cs`). Days are `yyyy-MM-dd`; amounts are
 * numbers in the one app currency (CAD).
 */

/** The link kinds of a person. */
export const PERSON_DOCUMENT_LINK = 'Documents.Document';
export const PERSON_TRANSACTION_LINK = 'Money.Transaction';
export const PERSON_TASK_LINK = 'Tasks.Task';
export const PERSON_ITEM_LINK = 'Home.Item';
/** The link kind of a person, for the links of documents and tasks (`People.Person`, T93). */
export const PEOPLE_PERSON_LINK = 'People.Person';

/** A birthday: month and day, and the year when it is known. */
export interface BirthdayDto {
  month: number;
  day: number;
  year: number | null;
}

/** A person in a list. */
export interface PersonSummaryDto {
  id: string;
  name: string;
  nickname: string | null;
  relationship: string | null;
  /** In lower case, for example `gaming group`. */
  groups: string[];
  birthday: BirthdayDto | null;
  /** Today or later; February 29 is February 28 in other years. */
  nextBirthday: string | null;
  email: string | null;
  phone: string | null;
  /** The reach-out reminder in days, or null. */
  contactEveryDays: number | null;
  lastContactOn: string | null;
  /** With a reminder: the day to reach out (last contact, or the add day, plus the reminder). */
  contactDueOn: string | null;
  contactOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A contact with a person: a call, a coffee, a visit. */
export interface InteractionDto {
  id: string;
  personId: string;
  occurredOn: string;
  kind: string | null;
  note: string | null;
  createdAt: string;
}

/** A gift idea; with `givenOn`, a given gift. */
export interface GiftIdeaDto {
  id: string;
  personId: string;
  title: string;
  notes: string | null;
  price: number | null;
  occasion: string | null;
  givenOn: string | null;
  createdAt: string;
}

export type LoanDirection = 'Lent' | 'Borrowed';

/** A thing lent to the person, or borrowed from the person. Open while `returnedOn` is null. */
export interface LoanDto {
  id: string;
  personId: string;
  personName: string;
  itemName: string;
  direction: LoanDirection;
  lentOn: string;
  dueOn: string | null;
  returnedOn: string | null;
  overdue: boolean;
  notes: string | null;
  createdAt: string;
}

export interface PersonLinkDto {
  id: string;
  kind: string;
  targetId: string;
  createdAt: string;
}

/** One person, with the latest 20 contacts, the gift ideas, the loans, and the links. */
export interface PersonDto {
  person: PersonSummaryDto;
  notes: string | null;
  /** Newest first. */
  interactions: InteractionDto[];
  interactionCount: number;
  /** Ideas first, then given gifts (newest first). */
  giftIdeas: GiftIdeaDto[];
  /** Open loans first, then returned ones. */
  loans: LoanDto[];
  links: PersonLinkDto[];
  /** The documents and the tasks that link to the person (T93): documents first, each group by title. */
  linkedFrom: PersonLinkedFromDto[];
}

/** A document or a task that links to the person. The link belongs to it: it is removed there. */
export interface PersonLinkedFromDto {
  /** `Documents.Document` or `Tasks.Task`. */
  kind: string;
  targetId: string;
  title: string;
}

export interface GroupCountDto {
  name: string;
  count: number;
}

export interface UpcomingBirthdayDto {
  personId: string;
  name: string;
  date: string;
  /** 0 = today. */
  days: number;
  age: number | null;
  /** Open gift ideas. */
  giftIdeas: number;
}

/** The numbers of the People page. `date` is today on the server. */
export interface PeopleSummaryDto {
  date: string;
  peopleCount: number;
  /** Overdue reminders, most overdue first. */
  reachOut: PersonSummaryDto[];
  /** Birthdays in the next 30 days, soonest first. */
  upcoming: UpcomingBirthdayDto[];
  openLoans: number;
  overdueLoans: number;
}
