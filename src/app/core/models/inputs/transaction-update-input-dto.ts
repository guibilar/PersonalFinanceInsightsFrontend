import { Category } from '../enums/category';

/** The parts of an imported transaction that can be corrected by hand. */
export interface TransactionUpdateInputDto {
  description: string;
  category: Category;
}
