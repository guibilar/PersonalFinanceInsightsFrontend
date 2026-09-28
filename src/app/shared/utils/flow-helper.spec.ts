import { FLOW_LABELS, FLOW_RULE_FLOWS, flowsFor } from './flow-helper';
import { Flow } from '../../core/models/enums/flow';
import { TransactionType } from '../../core/models/enums/transaction-type';

describe('flow helper', () => {
  it('allows only the flows that fit the direction', () => {
    expect(flowsFor(TransactionType.Debit)).toEqual([Flow.Spending, Flow.Transfer, Flow.Ignored]);
    expect(flowsFor(TransactionType.Credit)).toEqual([
      Flow.Refund,
      Flow.Income,
      Flow.Transfer,
      Flow.Ignored,
    ]);
    expect(flowsFor(undefined)).toEqual(Object.values(Flow));
  });

  it('has a label for every flow and no Spending rules', () => {
    expect(Object.values(Flow).every((flow) => FLOW_LABELS[flow])).toBe(true);
    expect(FLOW_RULE_FLOWS).not.toContain(Flow.Spending);
  });
});
