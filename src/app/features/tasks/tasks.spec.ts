import { HttpErrorResponse } from '@angular/common/http';
import { TODAY, testTaskSummary } from '../../testing/test-tasks';
import {
  addDays,
  dueText,
  groupTasks,
  linkLabels,
  parseTags,
  renewDueOn,
  repeatRule,
  repeatText,
  taskError,
} from './tasks';

describe('tasks', () => {
  it('counts days across the end of a month', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('puts open tasks in their sections, and repeated ones also under Recurring', () => {
    const repeat = { every: 4, unit: 'Days' as const, mode: 'FromCompletion' as const };
    const tasks = [
      testTaskSummary({ id: 'late', dueOn: '2026-10-10' }),
      testTaskSummary({ id: 'late-repeat', dueOn: '2026-10-12', repeat }),
      testTaskSummary({ id: 'today', dueOn: TODAY }),
      testTaskSummary({ id: 'today-repeat', dueOn: TODAY, repeat }),
      testTaskSummary({ id: 'soon', dueOn: '2026-10-21' }),
      testTaskSummary({ id: 'soon-repeat', dueOn: '2026-10-16', repeat }),
      testTaskSummary({ id: 'later', dueOn: '2026-10-22' }),
      testTaskSummary({ id: 'no-date', dueOn: null }),
      testTaskSummary({ id: 'done', status: 'Done', dueOn: '2026-10-01' }),
    ];

    const sections = groupTasks(tasks, TODAY);

    const ids = (list: { id: string }[]) => list.map((t) => t.id);
    expect(ids(sections.overdue)).toEqual(['late', 'late-repeat']);
    expect(ids(sections.today)).toEqual(['today', 'today-repeat']);
    expect(ids(sections.upcoming)).toEqual(['soon']);
    expect(ids(sections.later)).toEqual(['later', 'no-date']);
    expect(ids(sections.recurring)).toEqual(['late-repeat', 'today-repeat', 'soon-repeat']);
  });

  it('says a repeat in plain words', () => {
    expect(repeatText({ every: 1, unit: 'Months', mode: 'FromDueDate' })).toBe('Every month');
    expect(repeatText({ every: 12, unit: 'Months', mode: 'FromDueDate' })).toBe('Every 12 months');
    expect(repeatRule({ every: 4, unit: 'Days', mode: 'FromCompletion' })).toBe(
      'Every 4 days, after each done',
    );
    expect(repeatRule({ every: 1, unit: 'Weeks', mode: 'FromDueDate' })).toBe(
      'Every week, on a fixed schedule',
    );
  });

  it('says when a task is due, from the server day', () => {
    expect(dueText(null, TODAY)).toBe('');
    expect(dueText('2026-10-13', TODAY)).toBe('Oct 13 · 1 day late');
    expect(dueText('2026-10-10', TODAY)).toBe('Oct 10 · 4 days late');
    expect(dueText(TODAY, TODAY)).toBe('Today');
    expect(dueText('2026-10-15', TODAY)).toBe('Tomorrow');
    expect(dueText('2026-10-16', TODAY)).toBe('Fri, Oct 16');
    expect(dueText('2026-11-03', TODAY)).toBe('Nov 3, 2026');
  });

  it('names the linked modules once each', () => {
    const link = (kind: string) => ({ id: kind, kind, targetId: 'x', createdAt: '' });
    expect(
      linkLabels(
        testTaskSummary({
          links: [
            link('Documents.Document'),
            link('Money.Transaction'),
            link('Documents.Document'),
          ],
        }),
      ),
    ).toEqual(['Documents', 'Money']);
  });

  it('reads tags as the API keeps them', () => {
    expect(parseTags(' Home, garden,,home ')).toEqual(['home', 'garden']);
  });

  it('starts a renewal 14 days before the expiry, but not in the past', () => {
    expect(renewDueOn('2026-11-30', TODAY)).toBe('2026-11-16');
    expect(renewDueOn('2026-10-20', TODAY)).toBe(TODAY);
  });

  it('explains a refused change', () => {
    const error = (status: number, body: unknown = null) =>
      new HttpErrorResponse({ status, error: body });
    expect(taskError(error(403), 'x')).toBe('This account can only read tasks.');
    expect(taskError(error(404), 'x')).toBe('This task does not exist any more.');
    expect(taskError(error(409, { detail: 'The task is done already.' }), 'x')).toBe(
      'The task is done already.',
    );
    expect(taskError(error(400, { errors: { title: ['Too long.'] } }), 'x')).toBe('Too long.');
    expect(taskError(error(500), 'Could not save.')).toBe('Could not save.');
  });
});
