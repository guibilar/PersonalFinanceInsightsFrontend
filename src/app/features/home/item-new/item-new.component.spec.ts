import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { ItemNewComponent } from './item-new.component';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { provideReadOnlyUser } from '../../../testing/test-auth';
import { TX_ID, testPage, testTransaction } from '../../../testing/test-documents';
import { ITEM_ID, ROOM_ID, testItem, testRoom } from '../../../testing/test-home';

describe('ItemNewComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let router: Router;

  const root = () => harness.routeNativeElement as HTMLElement;
  const field = <T extends HTMLElement = HTMLInputElement>(name: string) =>
    root().querySelector<T>(`[formcontrolname="${name}"]`)!;
  const submit = () =>
    Array.from(root().querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent!.trim() === 'Add item',
    )!;
  const messages = () =>
    TestBed.inject(ToastService)
      .toasts()
      .map((t) => t.message);

  async function render(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    harness.fixture.detectChanges();
  }

  function type(name: string, value: string): void {
    const input = field(name);
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  async function start(extra: unknown[] = []): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'home/items/new', component: ItemNewComponent },
          { path: 'home/items/:id', children: [] },
          { path: 'home/rooms/:id', children: [] },
          { path: 'home', children: [] },
          { path: 'money/transactions', children: [] },
        ]),
        provideLocationMocks(),
        ...(extra as []),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  }

  afterEach(() => http.verify());

  it('adds an item with its details in a room, then opens it', async () => {
    await start();
    await harness.navigateByUrl(`/home/items/new?roomId=${ROOM_ID}`, ItemNewComponent);
    http.expectOne('/api/home/rooms').flush([testRoom()]);
    await render();
    const changes = TestBed.inject(DataChangesService).version();

    submit().click();
    await render();
    http.expectNone({ method: 'POST', url: '/api/home/items' });
    expect(root().querySelector('.invalid-feedback')!.textContent).toContain('Give it a name.');

    expect(field<HTMLSelectElement>('roomId').value).toBe(ROOM_ID);
    type('name', ' Stand mixer ');
    type('brand', 'KitchenAid');
    type('quantity', '1');
    type('purchasePrice', '499.99');
    type('warrantyUntil', '2027-03-01');
    type('tags', 'Gift, kitchen');
    await render();
    submit().click();

    const post = http.expectOne({ method: 'POST', url: '/api/home/items' });
    expect(post.request.body).toEqual({
      name: 'Stand mixer',
      roomId: ROOM_ID,
      category: null,
      brand: 'KitchenAid',
      model: null,
      serialNumber: null,
      quantity: 1,
      purchasedOn: null,
      purchasePrice: 499.99,
      currentValue: null,
      warrantyUntil: '2027-03-01',
      notes: null,
      tags: ['gift', 'kitchen'],
      links: [],
    });
    post.flush(testItem({ name: 'Stand mixer' }));
    await render();

    expect(router.url).toBe(`/home/items/${ITEM_ID}`);
    expect(messages()).toEqual(['Added “Stand mixer”']);
    expect(TestBed.inject(DataChangesService).version()).toBe(changes + 1);
  });

  it('does not save a price with more than cents', async () => {
    await start();
    await harness.navigateByUrl('/home/items/new', ItemNewComponent);
    http.expectOne('/api/home/rooms').flush([]);
    await render();

    type('name', 'Lamp');
    type('purchasePrice', '19.999');
    await render();
    submit().click();
    await render();

    http.expectNone({ method: 'POST', url: '/api/home/items' });
    expect(field('purchasePrice').classList).toContain('is-invalid');
  });

  it('starts from a transaction ("Add to inventory") and links the new item to it', async () => {
    await start();
    await harness.navigateByUrl(
      `/home/items/new?transactionId=${TX_ID}&name=COSTCO%20WHOLESALE&price=142.18&date=2026-10-03`,
      ItemNewComponent,
    );
    TestBed.tick();
    http.expectOne('/api/home/rooms').flush([testRoom()]);
    const lookup = http.expectOne('/api/Transaction/Filter');
    expect(lookup.request.body).toEqual({ transactionId: TX_ID, page: 1, pageSize: 1 });
    lookup.flush(testPage([testTransaction()]));
    await render();

    expect(root().querySelector('[data-testid="link-note"]')!.textContent).toContain(
      'COSTCO WHOLESALE',
    );
    expect(root().querySelector('a.back-link')!.getAttribute('href')).toBe(
      `/money/transactions?id=${TX_ID}`,
    );
    expect(field('name').value).toBe('COSTCO WHOLESALE');
    expect(field('purchasePrice').value).toBe('142.18');
    expect(field('purchasedOn').value).toBe('2026-10-03');

    type('name', 'Air fryer');
    submit().click();
    const post = http.expectOne({ method: 'POST', url: '/api/home/items' });
    expect(post.request.body).toEqual(
      expect.objectContaining({
        name: 'Air fryer',
        purchasePrice: 142.18,
        purchasedOn: '2026-10-03',
        roomId: null,
        links: [{ kind: 'Money.Transaction', targetId: TX_ID }],
      }),
    );
    post.flush(testItem({ name: 'Air fryer' }));
    await render();
    expect(router.url).toBe(`/home/items/${ITEM_ID}`);
  });

  it('ignores values in the address that are not valid', async () => {
    await start();
    await harness.navigateByUrl(
      '/home/items/new?transactionId=abc&roomId=kitchen&price=-3&date=yesterday',
      ItemNewComponent,
    );
    http.expectOne('/api/home/rooms').flush([]);
    await render();

    expect(root().querySelector('[data-testid="link-note"]')).toBeNull();
    expect(field('purchasePrice').value).toBe('');
    expect(field('purchasedOn').value).toBe('');
    expect(root().querySelector('a.back-link')!.getAttribute('href')).toBe('/home');
  });

  it('says why the server refused the item', async () => {
    await start();
    await harness.navigateByUrl('/home/items/new', ItemNewComponent);
    http.expectOne('/api/home/rooms').flush([]);
    await render();

    type('name', 'Lamp');
    submit().click();
    http
      .expectOne({ method: 'POST', url: '/api/home/items' })
      .flush(
        { errors: { roomId: ['The room does not exist.'] } },
        { status: 400, statusText: 'Bad Request' },
      );
    await render();
    expect(messages()).toEqual(['The room does not exist.']);
    expect(router.url).toBe('/home/items/new');
  });

  it('shows no form to a read-only user', async () => {
    await start([provideReadOnlyUser()]);
    await harness.navigateByUrl('/home/items/new', ItemNewComponent);
    http.expectOne('/api/home/rooms').flush([]);
    await render();

    expect(root().querySelector('[data-testid="read-only"]')!.textContent).toContain(
      'This account can only read the home inventory.',
    );
    expect(root().querySelector('form')).toBeNull();
  });
});
