import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpRequest, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { RoomPageComponent } from './room-page.component';
import { HOME_TODAY } from '../home';
import { RoomDto } from '../../../core/models/outputs/home-output-dto';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { provideReadOnlyUser } from '../../../testing/test-auth';
import {
  ITEM_ID,
  OFFICE_ID,
  ROOM_ID,
  testItem,
  testItemPage,
  testItemSummary,
  testRoom,
} from '../../../testing/test-home';

const GARAGE_ID = '0199f1a0-8888-7000-8000-000000000008';

function rooms(): RoomDto[] {
  return [
    testRoom({ id: OFFICE_ID, name: 'Office', sortOrder: 1, itemCount: 0, totalValue: 0 }),
    testRoom({ sortOrder: 2, itemCount: 2, totalValue: 1149.99 }),
    testRoom({ id: GARAGE_ID, name: 'Garage', sortOrder: 3, itemCount: 0, totalValue: 0 }),
  ];
}

describe('RoomPageComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let router: Router;

  const root = () => harness.routeNativeElement as HTMLElement;
  const text = (el: Element) => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
  // The item rows, without the "Move to…" list (T89).
  const rows = () =>
    Array.from(root().querySelectorAll('[data-testid="items"] > li app-item-row')).map(text);
  const button = (label: string) =>
    Array.from(root().querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => (b.getAttribute('aria-label') ?? b.textContent!.trim()) === label,
    )!;
  const confirmButton = (label: string) =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('app-confirm-dialog button')).find(
      (b) => b.textContent!.trim() === label,
    )!;
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

  async function answer(
    list = rooms(),
    items = [
      testItemSummary({ name: 'Dishwasher' }),
      testItemSummary({
        id: 'kettle',
        name: 'Kettle',
        brand: null,
        model: null,
        category: null,
        purchasePrice: 125,
        quantity: 2,
        value: 250,
        warrantyUntil: '2026-10-01',
      }),
    ],
  ): Promise<HttpRequest<unknown>> {
    TestBed.tick();
    http.expectOne('/api/home/rooms').flush(list);
    const request = http.expectOne(isItems);
    request.flush(testItemPage(items));
    await settle();
    return request.request;
  }

  async function start(extra: unknown[] = []): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'home/rooms/:id', component: RoomPageComponent },
          { path: 'home', children: [] },
          { path: 'home/items/:id', children: [] },
          { path: 'home/items/new', children: [] },
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

    it('shows the items of the room by name, with value and warranty state', async () => {
      await harness.navigateByUrl(`/home/rooms/${ROOM_ID}`, RoomPageComponent);
      const request = await answer();

      expect(request.params.get('room')).toBe(ROOM_ID);
      expect(request.params.get('pageSize')).toBe('100');
      expect(root().querySelector('h1')!.textContent!.trim()).toBe('Kitchen');
      expect(text(root().querySelector('[data-testid="room-totals"]')!)).toBe(
        '2 items · $1,149.99',
      );
      expect(rows()).toEqual([
        'Dishwasher Appliance · Bosch · SHX78 Under warranty until Nov 9, 2027 $899.99',
        'Kettle × 2 Ended Oct 1, 2026 $250.00',
      ]);
      expect(root().querySelector('a[href^="/home/items/new"]')!.getAttribute('href')).toBe(
        `/home/items/new?roomId=${ROOM_ID}`,
      );
      // A room with items cannot be deleted.
      expect(button('Delete').disabled).toBe(true);
      expect(root().querySelector('[data-testid="delete-note"]')).not.toBeNull();
    });

    it('renames the room', async () => {
      await harness.navigateByUrl(`/home/rooms/${ROOM_ID}`, RoomPageComponent);
      await answer();

      button('Rename').click();
      await settle();
      const input = root().querySelector<HTMLInputElement>('#room-name')!;
      expect(input.value).toBe('Kitchen');
      input.value = 'Galley';
      input.dispatchEvent(new Event('input'));
      button('Save').click();
      const put = http.expectOne({ method: 'PUT', url: `/api/home/rooms/${ROOM_ID}` });
      expect(put.request.body).toEqual({ name: 'Galley' });
      put.flush(testRoom({ name: 'Galley' }));
      await settle();

      expect(messages()).toEqual(['Renamed to “Galley”']);
      await answer(rooms().map((r) => (r.id === ROOM_ID ? { ...r, name: 'Galley' } : r)));
      expect(root().querySelector('h1')!.textContent!.trim()).toBe('Galley');
    });

    it('moves an item to another room, with all its details', async () => {
      await harness.navigateByUrl(`/home/rooms/${ROOM_ID}`, RoomPageComponent);
      await answer();

      const select = root().querySelector<HTMLSelectElement>(
        '[aria-label="Move Dishwasher to another room"]',
      )!;
      expect(Array.from(select.options).map((o) => o.text.trim())).toEqual([
        'Move to…',
        'Office',
        'Garage',
        'No room',
      ]);
      select.value = OFFICE_ID;
      select.dispatchEvent(new Event('change'));
      http.expectOne(`/api/home/items/${ITEM_ID}`).flush(testItem());
      const put = http.expectOne({ method: 'PUT', url: `/api/home/items/${ITEM_ID}` });
      expect(put.request.body.roomId).toBe(OFFICE_ID);
      expect(put.request.body.name).toBe('Dishwasher');
      put.flush(testItem({ roomId: OFFICE_ID }));
      await settle();

      expect(messages()).toEqual(['Moved “Dishwasher” to Office']);
      await answer();
    });

    it('moves the room up and down in the list', async () => {
      await harness.navigateByUrl(`/home/rooms/${ROOM_ID}`, RoomPageComponent);
      await answer();

      button('Move the room up in the list').click();
      const up = http.expectOne({ method: 'PUT', url: '/api/home/rooms/order' });
      expect(up.request.body).toEqual({ roomIds: [ROOM_ID, OFFICE_ID, GARAGE_ID] });
      up.flush([]);
      await settle();
      await answer();

      button('Move the room down in the list').click();
      const down = http.expectOne({ method: 'PUT', url: '/api/home/rooms/order' });
      expect(down.request.body).toEqual({ roomIds: [OFFICE_ID, GARAGE_ID, ROOM_ID] });
      down.flush([]);
      await settle();
      await answer();
    });

    it('cannot move the first room up', async () => {
      await harness.navigateByUrl(`/home/rooms/${OFFICE_ID}`, RoomPageComponent);
      await answer(rooms(), []);

      expect(button('Move the room up in the list').disabled).toBe(true);
      expect(button('Move the room down in the list').disabled).toBe(false);
      expect(root().querySelector('[data-testid="no-items"]')).not.toBeNull();
    });

    it('deletes an empty room after a confirmation, then goes to the Home page', async () => {
      await harness.navigateByUrl(`/home/rooms/${OFFICE_ID}`, RoomPageComponent);
      await answer(rooms(), []);

      button('Delete').click();
      await settle();
      confirmButton('Delete').click();
      http.expectOne({ method: 'DELETE', url: `/api/home/rooms/${OFFICE_ID}` }).flush(null);
      await settle();

      expect(router.url).toBe('/home');
      expect(messages()).toEqual(['Deleted the room “Office”']);
    });

    it('lists the items without a room, with no room actions', async () => {
      await harness.navigateByUrl('/home/rooms/none', RoomPageComponent);
      const request = await answer(rooms(), [testItemSummary({ roomId: null, roomName: null })]);

      expect(request.params.get('room')).toBe('none');
      expect(root().querySelector('h1')!.textContent!.trim()).toBe('No room');
      expect(text(root().querySelector('[data-testid="room-totals"]')!)).toBe('1 item · $899.99');
      expect(root().textContent).not.toContain('Rename');
      expect(root().querySelector('a[href="/home/items/new"]')).not.toBeNull();
    });

    it('says so when the room does not exist', async () => {
      await harness.navigateByUrl(`/home/rooms/${ROOM_ID}`, RoomPageComponent);
      await answer([], []);

      expect(root().textContent).toContain('This room does not exist any more.');
    });
  });

  describe('for a read-only user', () => {
    beforeEach(() => start([provideReadOnlyUser()]));

    it('shows the items without the room actions', async () => {
      await harness.navigateByUrl(`/home/rooms/${ROOM_ID}`, RoomPageComponent);
      await answer();

      expect(rows().length).toBe(2);
      expect(root().querySelectorAll('button').length).toBe(0);
      expect(root().querySelector('a[href^="/home/items/new"]')).toBeNull();
    });
  });
});
