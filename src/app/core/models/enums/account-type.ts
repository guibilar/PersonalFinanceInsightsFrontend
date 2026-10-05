/** The kind of an account; each account has one and it can't change. */
export enum AccountType {
  Chequing = 'Chequing',
  Savings = 'Savings',
  CreditCard = 'CreditCard',
  /** Its value moves with the market, not only with its transactions. */
  Investment = 'Investment',
}
