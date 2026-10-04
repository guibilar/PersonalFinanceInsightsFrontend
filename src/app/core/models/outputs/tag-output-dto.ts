/** A tag on a transaction. */
export interface TagReference {
  id: string;
  name: string;
}

/** A tag, with how many visible transactions carry it. */
export interface TagOutputDto extends TagReference {
  transactionCount: number;
}
