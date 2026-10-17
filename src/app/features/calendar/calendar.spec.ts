import {
  addDays,
  addMonths,
  dayHeading,
  itemsOn,
  joinRepeat,
  monthTitle,
  monthWeeks,
  repeatText,
  splitRepeat,
  whenText,
} from './calendar';
import { testCalendarItem } from '../../testing/test-calendar';

describe('calendar helpers', () => {
  it('makes whole weeks for a month, Sunday first', () => {
    const weeks = monthWeeks('2026-10-16');

    expect(weeks.length).toBe(5);
    expect(weeks[0][0]).toBe('2026-09-27');
    expect(weeks[4][6]).toBe('2026-10-31');
    expect(monthWeeks('2026-08-01').length).toBe(6);
    expect(monthTitle('2026-10-16')).toBe('October 2026');
  });

  it('moves days and months over their ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-31', -1)).toBe('2025-12-01');
  });

  it('finds the items of a day, also those of several days', () => {
    const trip = testCalendarItem({
      id: 'trip',
      allDay: true,
      startDate: '2026-10-14',
      endDate: '2026-10-17',
    });
    const dentist = testCalendarItem();

    expect(itemsOn([trip, dentist], '2026-10-16').map((i) => i.id)).toEqual(['trip']);
    expect(itemsOn([trip, dentist], '2026-10-20').map((i) => i.id)).toEqual(['calendar.event.ev1']);
  });

  it('says when an item is', () => {
    expect(whenText(testCalendarItem({ allDay: true, startsAt: null, endsAt: null }))).toBe(
      'All day',
    );
    expect(
      whenText(
        testCalendarItem({ allDay: true, startsAt: null, endsAt: null, endDate: '2026-10-22' }),
      ),
    ).toBe('All day · until Thu, Oct 22');
    expect(whenText(testCalendarItem({ endsAt: '2026-10-20T15:00:00Z' }))).toMatch(
      /^\d{1,2}:00 [AP]M$/,
    );
  });

  it('names the day: today, tomorrow, or the date', () => {
    expect(dayHeading('2026-10-16', '2026-10-16')).toBe('Today');
    expect(dayHeading('2026-10-17', '2026-10-16')).toBe('Tomorrow');
    expect(dayHeading('2026-10-20', '2026-10-16')).toBe('Tuesday, October 20');
    expect(dayHeading('2027-01-02', '2026-10-16')).toBe('Saturday, January 2, 2027');
  });

  it('splits and joins a repeat with its end day', () => {
    expect(splitRepeat('FREQ=WEEKLY;INTERVAL=2;UNTIL=20261231T235959Z', 'UTC')).toEqual({
      rule: 'FREQ=WEEKLY;INTERVAL=2',
      until: '2026-12-31',
    });
    expect(joinRepeat('FREQ=WEEKLY', '2026-12-31', false, 'UTC')).toBe(
      'FREQ=WEEKLY;UNTIL=20261231T235959Z',
    );
    expect(joinRepeat('FREQ=YEARLY', '2030-01-01', true)).toBe('FREQ=YEARLY;UNTIL=20300101');
    expect(joinRepeat('', '2030-01-01', true)).toBeNull();
    expect(repeatText('FREQ=MONTHLY')).toBe('Every month');
    expect(repeatText('FREQ=WEEKLY;BYDAY=TU,TH')).toBe('Repeats (custom)');
    expect(repeatText(null)).toBeNull();
  });

  it("ends a repeat at the end of the browser's day", () => {
    // 11:59:59 PM in Toronto on Dec 31 is 4:59:59 AM UTC on Jan 1: the 8 PM event of Dec 31 is still in the series.
    const rule = joinRepeat('FREQ=WEEKLY', '2026-12-31', false, 'America/Toronto');
    expect(rule).toBe('FREQ=WEEKLY;UNTIL=20270101T045959Z');
    expect(splitRepeat(rule, 'America/Toronto')).toEqual({
      rule: 'FREQ=WEEKLY',
      until: '2026-12-31',
    });
    // In summer time, and east of Greenwich.
    expect(joinRepeat('FREQ=DAILY', '2026-07-01', false, 'America/Toronto')).toBe(
      'FREQ=DAILY;UNTIL=20260702T035959Z',
    );
    expect(joinRepeat('FREQ=DAILY', '2026-07-01', false, 'Asia/Tokyo')).toBe(
      'FREQ=DAILY;UNTIL=20260701T145959Z',
    );
    // The end of a UTC day is still that day in Toronto; an all-day end is the day wherever the browser is.
    expect(splitRepeat('FREQ=WEEKLY;UNTIL=20261231T235959Z', 'America/Toronto').until).toBe(
      '2026-12-31',
    );
    expect(splitRepeat('FREQ=YEARLY;UNTIL=20300101', 'Asia/Tokyo').until).toBe('2030-01-01');
    expect(joinRepeat('FREQ=YEARLY', '2030-01-01', true, 'America/Toronto')).toBe(
      'FREQ=YEARLY;UNTIL=20300101',
    );
  });
});
