import { CategoryReference } from './category-output-dto';

export interface CategoryRuleOutputDto {
  id: string;
  keyword: string;
  category: CategoryReference;
  /** 0 is checked first; positions always run 0..n-1. */
  position: number;
}
