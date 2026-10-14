import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpRequest, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { HomePageComponent } from './home-page.component';
import { HOME_TODAY } from '../home';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { HomeSummaryDto } from '../../../core/models/outputs/home-output-dto';
import { TaskSummaryDto } from '../../../core/models/outputs/task-output-dto';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { provideReadOnlyUser } from '../../../testing/test-auth';
import {
  ITEM_ID,
  OFFICE_ID,
  ROOM_ID,
  testHomeSummary,
  testItemPage,
  testItemSummary,
  testRoom,
} from '../../../testing/test-home';
import { testTaskPage, testTaskSummary } from '../../../testing/test-tasks';

const HOME_LINK = [{ id: 'l1', kind: 'Home.Item', targetId: ITEM_ID, createdAt: '' }];
const MONTHLY = { every: 1, unit: 'Months' as const, mode: 'FromCompletion' as const };

function summary(): HomeSummaryDto {
  return testHomeSummary({
    itemCount: 3,
    totalValue: 2150.5,
    warrantiesEnding: 2,
    rooms: [
      { roomId: ROOM_ID, name: 'Kitchen', itemCount: 2, totalValue: 1900.5 },
      { roomId: OFFICE_ID, name: 'Office', itemCount: 0, totalValue: 0 },
      { roomId: null, name: null, itemCount: 1, totalValue: 250 },
    ],
  });
}

function openTasks(): TaskSummaryDto[] {
  return [
    testTaskSummary({
      id: 'filter',
      title: 'Clean the dishwasher filter',
      dueOn: '2026-11-05',
      repeat: MONTHLY,
      links: HOME_LINK,
    }),
    testTaskSummary({
      id: 'smoke',
      title: 'Smoke detector batteries',
      dueOn: '2026-10-20',
      repeat: { every: 12, unit: 'Months', mode: 'FromDueDate' },
      links: HOME_LINK,
    }),
    testTaskSummary({ id: 'paper', title: 'Buy printer paper' }),
  ];
}

describe('HomePageComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let router: Router;

  const root = () => harness.routeNativeElement as HTMLElement;
  const text = (el: Element) => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
  const rows = (testId: string) =>
    Array.from(root().querySelectorAll(`[data-testid="${testId}"] > li`)).map(text);
  const messages = () =>
    TestBed.inject(ToastService)
      .toasts()
      .map((t) => t.message);
  const isItems = (r: HttpRequest<unknown>) => r.url === '/api/home/items';

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    harness.fixture.detectChanges();
  }

  async function answer(body: HomeSummaryDto = summary(), tasks = openTasks()): Promise<void> {
    TestBed.tick();
    http.expectOne('/api/home/summary').flush(body);
    const list = http.expectOne((r) => r.url === '/api/tasks');
    expect(list.request.params.get('status')).toBe('Open');
    list.flush(testTaskPage(tasks));
    await settle();
  }

  async function open(url = '/home'): Promise<void> {
    await harness.navigateByUrl(url, HomePageComponent);
    await answer();
  }

  async function start(extra: unknown[] = []): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'home', component: HomePageComponent },
          { path: 'home/rooms/:id', children: [] },
          { path: 'home/items/:id', children: [] },
          { path: 'tasks/:id', children: [] },
        ]),
        provideLocationMocks(),
        { provide: HOME_TODAY, useValue: () => '2026-10-14' },
        ...(extra as []),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  }

  afterEach(() => http.verify());

  describe('for a user who can write', () => {
    beforeEach(() => start());

    it('shows the inventory, the rooms, and the export for insurance', async () => {
      await open();

      expect(text(root().querySelector('[data-testid="inventory-count"]')!)).toBe(
        'Inventory · 3 items',
      );
      expect(text(root().querySelector('[data-testid="total-value"]')!)).toBe('$2,150.50');
      const ending = root().querySelector<HTMLAnchorElement>('[data-testid="warranties-ending"]')!;
      expect(text(ending)).toBe('2 warranties end in the next 30 days');
      expect(ending.getAttribute('href')).toBe('/home?warranty=expiring');

      expect(rows('rooms')).toEqual([
        'Kitchen 2 items $1,900.50',
        'Office 0 items $0.00',
        'No room 1 item $250.00',
      ]);
      const links = Array.from(
        root().querySelectorAll<HTMLAnchorElement>('[data-testid="rooms"] a'),
      ).map((a) => a.getAttribute('href'));
      expect(links).toEqual([
        `/home/rooms/${ROOM_ID}`,
        `/home/rooms/${OFFICE_ID}`,
        '/home/rooms/none',
      ]);

      const exportLink = root().querySelector<HTMLAnchorElement>('[data-testid="export"]')!;
      expect(exportLink.getAttribute('href')).toBe('/api/home/items/export.csv');
      expect(exportLink.hasAttribute('download')).toBe(true);
      expect(root().querySelector('a[href="/home/items/new"]')).not.toBeNull();
    });

    it('lists the repeated tasks of items, soonest first, with the days left', async () => {
      await open();

      expect(rows('maintenance')).toEqual([
        'Smoke detector batteries Every 12 months 6 days',
        'Clean the dishwasher filter Every month 22 days',
      ]);
      expect(root().querySelector('[data-testid="maintenance"] a')!.getAttribute('href')).toBe(
        '/tasks/smoke',
      );
    });

    it('marks a maintenance task done, and loads the page again', async () => {
      await open();
      const changes = TestBed.inject(DataChangesService).version();

      root().querySelector<HTMLInputElement>('[data-testid="maintenance"] input')!.click();
      http
        .expectOne({ method: 'POST', url: '/api/tasks/smoke/done' })
        .flush({ ...openTasks()[1], dueOn: '2027-10-20', completions: [] });
      await settle();

      expect(TestBed.inject(DataChangesService).version()).toBe(changes + 1);
      expect(messages()).toEqual(['Done: “Smoke detector batteries”. Next: Oct 20, 2027.']);
      await answer();
    });

    it('says so when there is no maintenance and no room', async () => {
      await harness.navigateByUrl('/home', HomePageComponent);
      await answer(testHomeSummary({ itemCount: 0, totalValue: 0, rooms: [] }), []);

      expect(root().querySelector('[data-testid="no-maintenance"]')).not.toBeNull();
      expect(root().querySelector('[data-testid="no-rooms"]')).not.toBeNull();
      expect(root().querySelector('[data-testid="warranties-ending"]')).toBeNull();
    });

    it('searches all items from the address, and shows the room of each', async () => {
      await open('/home?q=bosch');
      const request = http.expectOne(isItems);
      expect(request.request.params.get('q')).toBe('bosch');
      request.flush(testItemPage([testItemSummary()]));
      await settle();

      expect(root().textContent).toContain('Items that match “bosch”');
      expect(rows('results')).toEqual([
        'Dishwasher Kitchen · Appliance · Bosch · SHX78 Under warranty until Nov 9, 2027 $899.99',
      ]);
      expect(root().querySelector('[data-testid="results"] a')!.getAttribute('href')).toBe(
        `/home/items/${ITEM_ID}`,
      );
    });

    it('puts a typed search in the address', async () => {
      await open();
      const input = root().querySelector<HTMLInputElement>('#home-search')!;
      input.value = 'tv';
      input.dispatchEvent(new Event('input'));
      await new Promise((resolve) => setTimeout(resolve, 400));
      await settle();

      expect(router.url).toBe('/home?q=tv');
      http.expectOne(isItems).flush(testItemPage([]));
      await settle();
      expect(root().querySelector('[data-testid="no-results"]')).not.toBeNull();
    });

    it('lists the warranties that end soon', async () => {
      await open('/home?warranty=expiring');
      const request = http.expectOne(isItems);
      expect(request.request.params.get('warranty')).toBe('expiring');
      expect(request.request.params.has('q')).toBe(false);
      request.flush(testItemPage([testItemSummary({ warrantyUntil: '2026-10-26' })]));
      await settle();

      expect(root().textContent).toContain('Warranties that end in the next 30 days');
      expect(text(root().querySelector('[data-testid="warranty"]')!)).toBe('Ends in 12 days');
    });

    it('adds a room', async () => {
      await open();
      const changes = TestBed.inject(DataChangesService).version();
      Array.from(root().querySelectorAll<HTMLButtonElement>('button'))
        .find((b) => b.textContent!.trim() === 'Add room')!
        .click();
      await settle();

      const input = root().querySelector<HTMLInputElement>('#new-room')!;
      input.value = ' Garage ';
      input.dispatchEvent(new Event('input'));
      root().querySelector<HTMLButtonElement>('form button[type="submit"]')!.click();
      const post = http.expectOne({ method: 'POST', url: '/api/home/rooms' });
      expect(post.request.body).toEqual({ name: 'Garage' });
      post.flush(testRoom({ name: 'Garage' }));
      await settle();

      expect(messages()).toEqual(['Added the room “Garage”']);
      expect(TestBed.inject(DataChangesService).version()).toBe(changes + 1);
      expect(root().querySelector('#new-room')).toBeNull();
      await answer();
    });

    it('shows why a room was not added', async () => {
      await open();
      Array.from(root().querySelectorAll<HTMLButtonElement>('button'))
        .find((b) => b.textContent!.trim() === 'Add room')!
        .click();
      await settle();
      const input = root().querySelector<HTMLInputElement>('#new-room')!;
      input.value = 'kitchen';
      input.dispatchEvent(new Event('input'));
      root().querySelector<HTMLButtonElement>('form button[type="submit"]')!.click();
      http
        .expectOne({ method: 'POST', url: '/api/home/rooms' })
        .flush(
          { detail: 'A room with the name "kitchen" exists.' },
          { status: 409, statusText: 'Conflict' },
        );
      await settle();

      expect(messages()).toEqual(['A room with the name "kitchen" exists.']);
    });

    it('shows an error with a retry when the inventory does not load', async () => {
      await harness.navigateByUrl('/home', HomePageComponent);
      TestBed.tick();
      http.expectOne('/api/home/summary').flush(null, { status: 500, statusText: 'Error' });
      http.expectOne((r) => r.url === '/api/tasks').flush(testTaskPage([]));
      await settle();

      expect(root().textContent).toContain('Could not load the inventory.');
      Array.from(root().querySelectorAll<HTMLButtonElement>('button'))
        .find((b) => b.textContent!.trim() === 'Retry')!
        .click();
      TestBed.tick();
      http.expectOne('/api/home/summary').flush(summary());
      await settle();
      expect(rows('rooms').length).toBe(3);
    });
  });

  describe('for a read-only user', () => {
    beforeEach(() => start([provideReadOnlyUser()]));

    it('shows no add or room actions and no done, but the export works', async () => {
      await open();

      expect(root().querySelector('a[href="/home/items/new"]')).toBeNull();
      expect(root().textContent).not.toContain('Add room');
      expect(
        root().querySelector<HTMLInputElement>('[data-testid="maintenance"] input')!.disabled,
      ).toBe(true);
      expect(root().querySelector('[data-testid="export"]')!.getAttribute('href')).toBe(
        '/api/home/items/export.csv',
      );
    });
  });
});
