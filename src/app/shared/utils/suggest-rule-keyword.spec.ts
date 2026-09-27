import { suggestRuleKeyword } from './suggest-rule-keyword';

describe('suggestRuleKeyword', () => {
  it.each([
    ['SQ *CORNER STORE #123 TORONTO ON', 'CORNER STORE'],
    ['SQ*CORNER STORE', 'CORNER STORE'],
    ['TST-PIZZA PLACE 4411 OSHAWA', 'PIZZA PLACE'],
    ['TST* Sushi Bar #2', 'SUSHI BAR'],
    ['PAYPAL *STEAMGAMES 4029357733', 'STEAMGAMES'],
    ['SP RAINBOW SOCKS 12', 'RAINBOW SOCKS'],
    ['  tim hortons #55  ', 'TIM HORTONS'],
    ['WAL-MART #3059', 'WAL-MART'],
    ['NETFLIX.COM', 'NETFLIX.COM'],
    // Nothing before the first number: the whole description.
    ['7-ELEVEN 3321', '7-ELEVEN 3321'],
  ])('%s → %s', (description, keyword) => {
    expect(suggestRuleKeyword(description)).toBe(keyword);
  });

  it('keeps within the keyword limit', () => {
    expect(suggestRuleKeyword('A'.repeat(150))).toHaveLength(100);
  });
});
