import { HttpErrorResponse } from '@angular/common/http';
import {
  amountOrNull,
  dayOrNull,
  daysLeftText,
  guidOrNull,
  homeError,
  maintenanceRule,
  maintenanceTasks,
  warrantyOf,
} from './home';
import { testTaskSummary } from '../../testing/test-tasks';

const today = '2026-10-14';

describe('home helpers', () => {
  it('names the state of a warranty', () => {
    expect(warrantyOf(null, today)).toBeNull();
    expect(warrantyOf('2027-11-09', today)).toEqual({
      state: 'active',
      text: 'Under warranty until Nov 9, 2027',
    });
    expect(warrantyOf('2026-10-26', today)).toEqual({ state: 'ending', text: 'Ends in 12 days' });
    expect(warrantyOf('2026-10-15', today)?.text).toBe('Ends in 1 day');
    expect(warrantyOf('2026-10-14', today)?.text).toBe('Ends today');
    expect(warrantyOf('2026-10-01', today)).toEqual({ state: 'ended', text: 'Ended Oct 1, 2026' });
  });

  it('says the days left to a due date', () => {
    expect(daysLeftText(null, today)).toBe('');
    expect(daysLeftText('2026-10-14', today)).toBe('Today');
    expect(daysLeftText('2026-10-15', today)).toBe('1 day');
    expect(daysLeftText('2026-10-20', today)).toBe('6 days');
    expect(daysLeftText('2026-10-11', today)).toBe('3 days late');
  });

  it('keeps the open repeated tasks of items, soonest first', () => {
    const home = [{ id: 'l', kind: 'Home.Item', targetId: 'i', createdAt: '' }];
    const repeat = { every: 1, unit: 'Months' as const, mode: 'FromDueDate' as const };
    const later = testTaskSummary({ id: 'a', dueOn: '2026-11-05', repeat, links: home });
    const soon = testTaskSummary({ id: 'b', dueOn: '2026-10-20', repeat, links: home });
    const once = testTaskSummary({ id: 'c', links: home });
    const other = testTaskSummary({ id: 'd', repeat });
    const done = testTaskSummary({ id: 'e', repeat, links: home, status: 'Done' });

    expect(maintenanceTasks([later, once, other, soon, done]).map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('describes the repeat of a maintenance task', () => {
    const task = {
      id: 't',
      title: 'Clean the filter',
      status: 'Open',
      dueOn: null,
      repeatEvery: 3,
      repeatUnit: 'Months',
      lastDoneAt: null,
    };
    expect(maintenanceRule(task)).toBe('Every 3 months');
    expect(maintenanceRule({ ...task, repeatEvery: null, repeatUnit: null })).toBe('Once');
  });

  it('reads values from the address only when they are valid', () => {
    expect(guidOrNull('0199f1a0-5555-7000-8000-000000000005')).not.toBeNull();
    expect(guidOrNull('kitchen')).toBeNull();
    expect(dayOrNull('2026-10-03')).toBe('2026-10-03');
    expect(dayOrNull('Oct 3')).toBeNull();
    expect(amountOrNull('142.18')).toBe(142.18);
    expect(amountOrNull('-5')).toBeNull();
    expect(amountOrNull('1.234')).toBeNull();
  });

  it('explains a refused change', () => {
    const error = (status: number, body: unknown = null) =>
      new HttpErrorResponse({ status, error: body });
    expect(homeError(error(403), 'x')).toBe('This account can only read the home inventory.');
    expect(homeError(error(409, { detail: 'The room has items.' }), 'x')).toBe(
      'The room has items.',
    );
    expect(homeError(error(400, { errors: { name: ['Give it a name.'] } }), 'x')).toBe(
      'Give it a name.',
    );
    expect(homeError(error(500), 'Could not save.')).toBe('Could not save.');
  });
});
