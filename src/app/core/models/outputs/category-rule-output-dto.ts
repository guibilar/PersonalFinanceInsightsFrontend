import { Category } from '../enums/category';

export interface CategoryRuleOutputDto {
  id: string;
  keyword: string;
  category: Category;
  /** 0 is checked first; positions always run 0..n-1. */
  position: number;
}
