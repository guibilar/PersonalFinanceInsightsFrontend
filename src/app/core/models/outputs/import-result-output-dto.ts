export interface ImportResultOutputDto {
  read: number;
  added: number;
  /** Rows already stored by an earlier import. */
  skipped: number;
}
