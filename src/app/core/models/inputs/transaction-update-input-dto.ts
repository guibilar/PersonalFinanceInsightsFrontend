import { Flow } from '../enums/flow';

/** The parts of an imported transaction that can be corrected by hand. */
export interface TransactionUpdateInputDto {
  description: string;
  categoryId: string;
  /** Omitted: unchanged. A new flow is then kept when the rules are re-applied. */
  flow?: Flow;
  /** Omitted: unchanged. Empty: cleared. */
  note?: string;
  /** The full set of tags. Omitted: unchanged. */
  tagIds?: string[];
}
