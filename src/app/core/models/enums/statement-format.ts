/** How a bank lays out its statement files; each account has one, which decides how its imports are read. */
export enum StatementFormat {
  Cibc = 'Cibc',
  Neo = 'Neo',
}
