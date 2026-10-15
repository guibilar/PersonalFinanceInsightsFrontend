import {
  agoText,
  birthdayText,
  dateBadge,
  groupLabel,
  inDaysText,
  initialsOf,
  lastContactText,
  parseGroups,
  reminderText,
} from './people';

describe('people helpers', () => {
  it('makes initials from the first and the last word', () => {
    expect(initialsOf('Marco Silva')).toBe('MS');
    expect(initialsOf('  ana  maria lima ')).toBe('AL');
    expect(initialsOf('Priya')).toBe('P');
    expect(initialsOf('')).toBe('?');
  });

  it('shows groups with a capital first letter, and reads typed groups', () => {
    expect(groupLabel('gaming group')).toBe('Gaming group');
    expect(parseGroups(' Family, gaming   Group ,family,, ')).toEqual(['family', 'gaming group']);
  });

  it('says how long ago a day was', () => {
    expect(agoText('2026-10-14', '2026-10-14')).toBe('today');
    expect(agoText('2026-10-13', '2026-10-14')).toBe('yesterday');
    expect(agoText('2026-10-09', '2026-10-14')).toBe('5 days ago');
    expect(agoText('2026-09-02', '2026-10-14')).toBe('6 weeks ago');
    expect(agoText('2026-07-14', '2026-10-14')).toBe('3 months ago');
    expect(agoText('2023-10-14', '2026-10-14')).toBe('3 years ago');
    expect(lastContactText(null, '2026-10-14')).toBe('No contact yet');
    expect(lastContactText('2026-09-02', '2026-10-14')).toBe('Last contact 6 weeks ago');
  });

  it('writes reminders, birthdays, and days to a birthday', () => {
    expect(reminderText(42)).toBe('Every 6 weeks');
    expect(reminderText(21)).toBe('Every 3 weeks');
    expect(reminderText(10)).toBe('Every 10 days');
    expect(reminderText(null)).toBe('None');
    expect(birthdayText({ month: 11, day: 2, year: null })).toBe('Nov 2');
    expect(birthdayText({ month: 2, day: 29, year: 1996 })).toBe('Feb 29, 1996');
    expect(inDaysText(0)).toBe('Today');
    expect(inDaysText(1)).toBe('Tomorrow');
    expect(inDaysText(23)).toBe('In 23 days');
    expect(dateBadge('2026-11-02')).toEqual({ month: 'NOV', day: 2 });
  });
});
