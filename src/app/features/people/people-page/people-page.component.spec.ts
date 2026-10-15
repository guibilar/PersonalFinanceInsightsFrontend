import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { PeoplePageComponent } from './people-page.component';
import { PEOPLE_TODAY } from '../people';
import { PeopleSummaryDto } from '../../../core/models/outputs/people-output-dto';
import { provideReadOnlyUser } from '../../../testing/test-auth';
import {
  ANA_ID,
  PERSON_ID,
  testLoan,
  testPeoplePage,
  testPeopleSummary,
  testPersonSummary,
} from '../../../testing/test-people';

const PEOPLE = [
  testPersonSummary({
    id: ANA_ID,
    name: 'Ana Lima',
    relationship: null,
    lastContactOn: '2026-10-12',
  }),
  testPersonSummary(),
];

describe('PeoplePageComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  const root = () => harness.routeNativeElement as HTMLElement;
  const text = (el: Element) => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
  const rows = (testId: string) =>
    Array.from(root().querySelectorAll(`[data-testid="${testId}"] > li`)).map(text);

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    harness.fixture.detectChanges();
  }

  async function answer(
    summary: PeopleSummaryDto = testPeopleSummary(),
    people = PEOPLE,
    group?: string,
  ): Promise<void> {
    TestBed.tick();
    http.expectOne('/api/people/summary').flush(summary);
    http.expectOne('/api/people/groups').flush([
      { name: 'family', count: 1 },
      { name: 'gaming group', count: 1 },
    ]);
    http.expectOne((r) => r.url === '/api/people/loans').flush([testLoan()]);
    const list = http.expectOne((r) => r.url === '/api/people');
    expect(list.request.params.get('sort')).toBe('name');
    if (group) expect(list.request.params.get('group')).toBe(group);
    list.flush(testPeoplePage(people));
    await settle();
  }

  async function start(extra: unknown[] = []): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'people', component: PeoplePageComponent },
          { path: 'people/:id', children: [] },
        ]),
        provideLocationMocks(),
        { provide: PEOPLE_TODAY, useValue: () => '2026-10-14' },
        ...(extra as []),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  }

  afterEach(() => http.verify());

  it('shows reach out, upcoming birthdays, loans, and all people', async () => {
    await start();
    await harness.navigateByUrl('/people', PeoplePageComponent);
    await answer();

    expect(rows('reach-out')).toEqual(['MS Marco Silva Last contact 6 weeks ago']);
    expect(rows('upcoming')).toEqual([
      'NOV 2 Marco Silva’s birthday In 19 days · turns 36 · 2 gift ideas',
    ]);
    expect(rows('loans')).toEqual(['Camping stove Lent to Marco Silva · due Aug 1, 2026 Overdue']);
    expect(text(root().querySelector('[data-testid="all-heading"]')!)).toBe('All people · 2');
    expect(rows('people')).toEqual(['AL Ana Lima 2 days ago', 'MS Marco Silva Friend 6 weeks ago']);
    expect(root().querySelector('[data-testid="people"] a')!.getAttribute('href')).toBe(
      `/people/${ANA_ID}`,
    );
    expect(Array.from(root().querySelectorAll('[data-testid="groups"] a')).map(text)).toEqual([
      'All',
      'Family',
      'Gaming group',
    ]);
    expect(root().querySelector('a[href="/people/new"]')).not.toBeNull();
  });

  it('filters by the group in the address', async () => {
    await start();
    await harness.navigateByUrl('/people?group=family', PeoplePageComponent);
    await answer(testPeopleSummary(), [PEOPLE[0]], 'family');

    const family = root().querySelector('[data-testid="groups"] a[aria-pressed="true"]')!;
    expect(text(family)).toBe('Family');
    expect(rows('people')).toEqual(['AL Ana Lima 2 days ago']);
  });

  it('says when nobody matches, and when there is nobody yet', async () => {
    await start();
    await harness.navigateByUrl('/people?q=zed', PeoplePageComponent);
    await answer(testPeopleSummary({ reachOut: [], upcoming: [] }), []);

    expect(root().querySelector('[data-testid="no-results"]')).not.toBeNull();
    expect(root().querySelector('[data-testid="no-reach-out"]')).not.toBeNull();
    expect(root().querySelector('[data-testid="no-upcoming"]')).not.toBeNull();

    TestBed.inject(Router).navigateByUrl('/people');
    await settle();
    http.expectOne((r) => r.url === '/api/people').flush(testPeoplePage([]));
    await settle();
    expect(root().querySelector('[data-testid="no-people"]')).not.toBeNull();
  });

  it('has no "Add person" for a read-only user', async () => {
    await start([provideReadOnlyUser()]);
    await harness.navigateByUrl('/people', PeoplePageComponent);
    await answer();

    expect(root().querySelector('a[href="/people/new"]')).toBeNull();
    expect(rows('reach-out').length).toBe(1);
    expect(PERSON_ID).toBeTruthy();
  });
});
