/** How a bank lays out its statement files; each account has one, which decides how its imports are read. */
export enum StatementFormat {
  Cibc = 'Cibc',
  Neo = 'Neo',
  /** Monthly PDF statements from Wealthsimple (TFSA, RRSP, FHSA, non-registered). */
  Wealthsimple = 'Wealthsimple',
  /** The bank offers no export: transactions are added by hand. */
  Manual = 'Manual',
}
