import { TagOutputDto } from '../core/models/outputs/tag-output-dto';

/** Tags as the API lists them, by name. */
export const TEST_TAGS: TagOutputDto[] = [
  { id: 'g-tax', name: 'Tax deductible', transactionCount: 1 },
  { id: 'g-trip', name: 'Vacation 2026', transactionCount: 3 },
];
