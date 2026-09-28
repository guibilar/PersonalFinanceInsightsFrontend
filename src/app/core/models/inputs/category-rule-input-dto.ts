import { Category } from '../enums/category';

export interface CategoryRuleInputDto {
  /** Matched anywhere in a description, ignoring case; the API stores it trimmed and upper-case. */
  keyword: string;
  category: Category;
  /** Where to insert a new rule (0 is checked first); at the end when omitted. Ignored on update. */
  position?: number;
}
