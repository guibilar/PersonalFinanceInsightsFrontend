export interface ImportResultOutputDto {
  read: number;
  added: number;
  /** Rows already stored by an earlier import. */
  skipped: number;
  /** The account's value at the end of the statement's period, saved as its balance that day (Wealthsimple statements). */
  balance?: number | null;
  /** The day of {@link balance}, at midnight UTC. */
  balanceDate?: string | null;
}
