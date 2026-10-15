import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { PersonNewComponent } from './person-new.component';
import { provideReadOnlyUser } from '../../../testing/test-auth';
import { PERSON_ID, testPerson } from '../../../testing/test-people';

describe('PersonNewComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  const root = () => harness.routeNativeElement as HTMLElement;

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    harness.fixture.detectChanges();
  }

  function type(selector: string, value: string): void {
    const input = root().querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input'));
  }

  async function start(extra: unknown[] = []): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'people/new', component: PersonNewComponent },
          { path: 'people/:id', children: [] },
          { path: 'people', children: [] },
        ]),
        provideLocationMocks(),
        ...(extra as []),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/new', PersonNewComponent);
    await settle();
  }

  afterEach(() => http.verify());

  it('adds a person with groups, a birthday, and a reminder, then opens the person', async () => {
    await start();
    type('#person-name', '  Marco Silva ');
    type('#person-groups', 'Friends, Gaming group');
    type('#person-birth-month', '11: 11');
    type('#person-birth-day', '2');
    type('#person-reminder', '4: 42');
    await settle();

    root().querySelector<HTMLFormElement>('form')!.requestSubmit();

    const request = http.expectOne({ method: 'POST', url: '/api/people' });
    expect(request.request.body).toEqual({
      name: 'Marco Silva',
      nickname: null,
      relationship: null,
      groups: ['friends', 'gaming group'],
      birthday: { month: 11, day: 2, year: null },
      email: null,
      phone: null,
      notes: null,
      contactEveryDays: 42,
    });
    request.flush(testPerson());
    await settle();
    expect(TestBed.inject(Router).url).toBe(`/people/${PERSON_ID}`);
  });

  it('sends nothing without a name, or with a day that the month does not have', async () => {
    await start();
    root().querySelector<HTMLFormElement>('form')!.requestSubmit();
    await settle();
    expect(root().querySelector('#person-name.is-invalid')).not.toBeNull();

    type('#person-name', 'Ana');
    type('#person-birth-month', '2: 2');
    type('#person-birth-day', '30');
    await settle();
    root().querySelector<HTMLFormElement>('form')!.requestSubmit();
    await settle();
    expect(root().querySelector('[data-testid="birthday-error"]')).not.toBeNull();
    http.expectNone('/api/people');
  });

  it('shows a note and no form to a read-only user', async () => {
    await start([provideReadOnlyUser()]);
    expect(root().querySelector('[data-testid="read-only"]')).not.toBeNull();
    expect(root().querySelector('form')).toBeNull();
  });
});
