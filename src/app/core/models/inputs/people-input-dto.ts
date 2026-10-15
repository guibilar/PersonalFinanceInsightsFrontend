import { BirthdayDto, LoanDirection } from '../outputs/people-output-dto';

/** The details of a person (`POST /api/people` and `PUT /api/people/{id}`). `PUT` replaces all of them. */
export interface PersonDetailsInputDto {
  name: string;
  nickname: string | null;
  relationship: string | null;
  groups: string[];
  birthday: BirthdayDto | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  contactEveryDays: number | null;
}

export interface PersonLinkInputDto {
  kind: string;
  targetId: string;
}

export interface CreatePersonInputDto extends PersonDetailsInputDto {
  links?: PersonLinkInputDto[];
}

/** A contact. Without `occurredOn`: today on the server. */
export interface InteractionInputDto {
  occurredOn: string | null;
  kind: string | null;
  note: string | null;
}

export interface GiftIdeaInputDto {
  title: string;
  notes: string | null;
  price: number | null;
  occasion: string | null;
  givenOn: string | null;
}

/** A loan. Without `lentOn`: today on the server. */
export interface LoanInputDto {
  itemName: string;
  direction: LoanDirection;
  lentOn: string | null;
  dueOn: string | null;
  returnedOn: string | null;
  notes: string | null;
}

export type PeopleSort = 'name' | 'contact';

export interface PersonListQuery {
  group?: string | null;
  q?: string | null;
  sort?: PeopleSort | null;
  page?: number;
  pageSize?: number;
}

export type LoanStatus = 'open' | 'returned' | 'all';
