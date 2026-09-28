import { Category } from '../enums/category';
import { Flow } from '../enums/flow';

/** The parts of an imported transaction that can be corrected by hand. */
export interface TransactionUpdateInputDto {
  description: string;
  category: Category;
  /** Omitted: unchanged. A new flow is then kept when the rules are re-applied. */
  flow?: Flow;
}
