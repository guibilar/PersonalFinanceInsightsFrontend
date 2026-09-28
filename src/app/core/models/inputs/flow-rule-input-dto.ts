import { Flow } from '../enums/flow';

export interface FlowRuleInputDto {
  /** Matched anywhere in a description, ignoring case; the API stores it trimmed and upper-case. */
  keyword: string;
  /** Anything but Spending, which is what money out is without a rule. */
  flow: Flow;
}
