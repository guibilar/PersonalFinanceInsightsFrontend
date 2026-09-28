import { Flow } from '../enums/flow';

export interface FlowRuleOutputDto {
  id: string;
  keyword: string;
  flow: Flow;
}
