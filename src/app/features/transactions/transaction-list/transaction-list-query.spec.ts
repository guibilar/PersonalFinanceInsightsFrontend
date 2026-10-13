import { TRANSACTION_ID_KEY, transactionLink } from './transaction-list-query';

describe('transactionLink', () => {
  it('opens the transactions page on one transaction, by its id', () => {
    expect(transactionLink('t9')).toEqual({
      route: '/money/transactions',
      queryParams: { [TRANSACTION_ID_KEY]: 't9' },
    });
    expect(TRANSACTION_ID_KEY).toBe('id');
  });
});
