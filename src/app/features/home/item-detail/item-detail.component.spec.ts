import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { ItemDetailComponent } from './item-detail.component';
import { HOME_TODAY } from '../home';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { ItemDto } from '../../../core/models/outputs/home-output-dto';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { testTask } from '../../../testing/test-tasks';
import { provideReadOnlyUser } from '../../../testing/test-auth';
import {
  DOC_ID,
  PHOTO_ID,
  TX_ID,
  testDocument,
  testPage,
  testTransaction,
} from '../../../testing/test-documents';
import { ITEM_ID, ROOM_ID, testItem, testRoom } from '../../../testing/test-home';

const TX_LINK = { id: 'link-tx', kind: 'Money.Transaction', targetId: TX_ID, createdAt: '' };
const DOC = { id: DOC_ID, title: 'Dishwasher warranty', kind: 'Warranty', expiresOn: '2026-11-09' };

describe('ItemDetailComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let router: Router;

  const root = () => harness.routeNativeElement as HTMLElement;
  const itemUrl = `/api/home/items/${ITEM_ID}`;
  const text = (selector: string) =>
    (root().querySelector(selector) as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
  const button = (label: string) =>
    Array.from(root().querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => (b.getAttribute('aria-label') ?? b.textContent!.trim()) === label,
    );
  const confirmButton = (label: string) =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('app-confirm-dialog button')).find(
      (b) => b.textContent!.trim() === label,
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

  async function answer(item: ItemDto = testItem()): Promise<void> {
    TestBed.tick();
    http.expectOne({ method: 'GET', url: itemUrl }).flush(item);
    await render();
  }

  async function open(item: ItemDto = testItem()): Promise<void> {
    await harness.navigateByUrl(`/home/items/${ITEM_ID}`, ItemDetailComponent);
    await answer(item);
  }

  /** The finance lookups of the linked purchases. */
  function lookups(): TestRequest[] {
    TestBed.tick();
    return http.match((r) => r.url === '/api/Transaction/Filter' && !!r.body?.transactionId);
  }

  async function start(extra: unknown[] = []): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'home/items/:id', component: ItemDetailComponent },
          { path: 'home/rooms/:id', children: [] },
          { path: 'home', children: [] },
          { path: 'documents/new', children: [] },
          { path: 'documents/:id', children: [] },
          { path: 'tasks/new', children: [] },
          { path: 'tasks/:id', children: [] },
          { path: 'money/transactions', children: [] },
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

    it('shows the details, the value and the warranty state', async () => {
      await open();

      expect(root().querySelector('h1')!.textContent!.trim()).toBe('Dishwasher');
      expect(text('[data-testid="item-value"]')).toBe('$899.99');
      expect(text('[data-testid="warranty"]')).toBe('Under warranty until Nov 9, 2027');
      const details = text('[data-testid="details"]');
      expect(details).toContain('Room Kitchen');
      expect(details).toContain('Brand and model Bosch · SHX78');
      expect(details).toContain('Serial number FD9901');
      expect(details).toContain('Bought on Nov 9, 2025');
      expect(details).toContain('Price (each) $899.99');
      expect(details).toContain('Value now (each) The price counts');
      expect(root().querySelector('a.back-link')!.getAttribute('href')).toBe(
        `/home/rooms/${ROOM_ID}`,
      );
    });

    it('shows a document with an image as a photo, and the maintenance with the next date', async () => {
      await open(
        testItem({
          documents: [DOC],
          maintenance: [
            {
              id: 'task-1',
              title: 'Clean the filter',
              status: 'Open',
              dueOn: '2026-10-20',
              repeatEvery: 1,
              repeatUnit: 'Months',
              lastDoneAt: null,
            },
          ],
        }),
      );
      http.expectOne(`/api/documents/${DOC_ID}`).flush(testDocument());
      await render();

      const photo = root().querySelector<HTMLImageElement>('[data-testid="item-documents"] img')!;
      expect(photo.getAttribute('src')).toBe(
        `/api/documents/${DOC_ID}/files/${PHOTO_ID}?inline=true`,
      );
      expect(text('[data-testid="item-documents"]')).toContain(
        'Dishwasher warranty Warranty · expires Nov 9, 2026',
      );
      const maintenance = root().querySelector<HTMLAnchorElement>(
        '[data-testid="item-maintenance"] a',
      )!;
      expect(maintenance.getAttribute('href')).toBe('/tasks/task-1');
      expect(maintenance.innerText.replace(/\s+/g, ' ').trim()).toBe(
        'Clean the filter Every month · Next: Oct 20, 2026 · 6 days',
      );
    });

    it('marks a maintenance task done from the item page', async () => {
      const task = {
        id: 'task-1',
        title: 'Clean the filter',
        status: 'Open',
        dueOn: '2026-10-20',
        repeatEvery: 1,
        repeatUnit: 'Months',
        lastDoneAt: null,
      };
      await open(testItem({ maintenance: [task] }));

      const check = root().querySelector<HTMLInputElement>(
        '[data-testid="item-maintenance"] input[type="checkbox"]',
      )!;
      expect(check.getAttribute('aria-label')).toBe('Mark done: Clean the filter');
      check.click();
      http
        .expectOne({ method: 'POST', url: '/api/tasks/task-1/done' })
        .flush(testTask({ id: 'task-1', title: 'Clean the filter', dueOn: '2026-11-20' }));
      await answer(testItem({ maintenance: [{ ...task, dueOn: '2026-11-20' }] }));
    });

    it('puts the tick back when the maintenance task could not be undone', async () => {
      const task = {
        id: 'task-1',
        title: 'Clean the filter',
        status: 'Done',
        dueOn: '2026-10-20',
        repeatEvery: null,
        repeatUnit: null,
        lastDoneAt: '2026-10-13T08:00:00Z',
      };
      await open(testItem({ maintenance: [task] }));
      const check = root().querySelector<HTMLInputElement>(
        '[data-testid="item-maintenance"] input[type="checkbox"]',
      )!;
      expect(check.checked).toBe(true);

      check.click();
      http
        .expectOne({ method: 'POST', url: '/api/tasks/task-1/undo' })
        .flush(null, { status: 500, statusText: 'Server Error' });
      await render();

      expect(messages()).toEqual(['Could not undo the done.']);
      expect(check.checked).toBe(true);
    });

    it('shows the purchase, which opens it in Money', async () => {
      await open(testItem({ links: [TX_LINK] }));
      const [lookup] = lookups();
      lookup.flush(testPage([testTransaction()]));
      await render();

      const link = root().querySelector<HTMLAnchorElement>('[data-testid="purchases"] a')!;
      expect(link.getAttribute('href')).toBe(`/money/transactions?id=${TX_ID}`);
      expect(text('[data-testid="purchases"]')).toContain('COSTCO WHOLESALE');
      expect(text('[data-testid="purchases"]')).toContain('-$142.18');
    });

    it('opens the upload and the new task with the link to the item', async () => {
      await open();

      expect(root().querySelector('[data-testid="add-document"]')!.getAttribute('href')).toBe(
        `/documents/new?homeItemId=${ITEM_ID}`,
      );
      expect(root().querySelector('[data-testid="add-maintenance"]')!.getAttribute('href')).toBe(
        `/tasks/new?homeItemId=${ITEM_ID}`,
      );
    });

    it('links the purchase, and fills the empty price and day from it', async () => {
      await open(testItem({ purchasePrice: null, purchasedOn: null, value: 0 }));
      const changes = TestBed.inject(DataChangesService).version();

      button('Link the purchase')!.click();
      await render();
      TestBed.tick();
      http
        .expectOne((r) => r.url === '/api/Transaction/Filter')
        .flush(testPage([testTransaction()]));
      await render();
      document
        .querySelector<HTMLButtonElement>('[data-testid="picker-transactions"] button')!
        .click();

      const post = http.expectOne({ method: 'POST', url: `${itemUrl}/links` });
      expect(post.request.body).toEqual({ kind: 'Money.Transaction', targetId: TX_ID });
      post.flush(TX_LINK);
      const put = http.expectOne({ method: 'PUT', url: itemUrl });
      expect(put.request.body).toEqual(
        expect.objectContaining({
          name: 'Dishwasher',
          roomId: ROOM_ID,
          purchasePrice: 142.18,
          purchasedOn: '2026-10-03',
          warrantyUntil: '2027-11-09',
        }),
      );
      put.flush(testItem());
      await render();

      expect(messages()).toEqual(['Linked “COSTCO WHOLESALE”, with its price and day']);
      expect(TestBed.inject(DataChangesService).version()).toBe(changes + 1);
      await answer(testItem({ links: [TX_LINK] }));
      lookups()[0].flush(testPage([testTransaction()]));
      await render();
    });

    it('links a document picked from the recent ones', async () => {
      await open();

      button('Link a document')!.click();
      await render();
      TestBed.tick();
      http
        .expectOne((r) => r.url === '/api/documents')
        .flush(testPage([{ ...testDocument(), id: 'doc-2', title: 'Manual' }]));
      await render();
      document.querySelector<HTMLButtonElement>('[data-testid="picker-documents"] button')!.click();

      const post = http.expectOne({ method: 'POST', url: `${itemUrl}/links` });
      expect(post.request.body).toEqual({ kind: 'Documents.Document', targetId: 'doc-2' });
      post.flush({ id: 'l2', kind: 'Documents.Document', targetId: 'doc-2', createdAt: '' });
      await render();
      expect(messages()).toEqual(['Linked “Manual”']);
      await answer();
    });

    it('unlinks a document from the side that has the link', async () => {
      // The document links to the item (Home.Item), not the item to the document.
      await open(testItem({ documents: [DOC] }));
      http.expectOne(`/api/documents/${DOC_ID}`).flush(
        testDocument({
          links: [{ id: 'doc-link', kind: 'Home.Item', targetId: ITEM_ID, createdAt: '' }],
        }),
      );
      await render();

      button('Unlink “Dishwasher warranty”')!.click();
      await render();
      confirmButton('Unlink').click();
      http
        .expectOne({ method: 'DELETE', url: `/api/documents/${DOC_ID}/links/doc-link` })
        .flush(null);
      await render();
      expect(messages()).toEqual(['Unlinked']);
      await answer();
    });

    it('unlinks a document that the item links to', async () => {
      const own = { id: 'own', kind: 'Documents.Document', targetId: DOC_ID, createdAt: '' };
      await open(testItem({ documents: [DOC], links: [own] }));
      http.expectOne(`/api/documents/${DOC_ID}`).flush(testDocument());
      await render();

      button('Unlink “Dishwasher warranty”')!.click();
      await render();
      confirmButton('Unlink').click();
      http.expectOne({ method: 'DELETE', url: `${itemUrl}/links/own` }).flush(null);
      await render();
      await answer();
    });

    it('edits the details and saves them all', async () => {
      await open();

      button('Edit')!.click();
      TestBed.tick();
      http.expectOne('/api/home/rooms').flush([testRoom()]);
      await render();
      const value = root().querySelector<HTMLInputElement>('[formcontrolname="currentValue"]')!;
      value.value = '400';
      value.dispatchEvent(new Event('input'));
      button('Save')!.click();

      const put = http.expectOne({ method: 'PUT', url: itemUrl });
      expect(put.request.body).toEqual({
        name: 'Dishwasher',
        roomId: ROOM_ID,
        category: 'Appliance',
        brand: 'Bosch',
        model: 'SHX78',
        serialNumber: 'FD9901',
        quantity: 1,
        purchasedOn: '2025-11-09',
        purchasePrice: 899.99,
        currentValue: 400,
        warrantyUntil: '2027-11-09',
        notes: null,
        tags: [],
      });
      put.flush(testItem({ currentValue: 400, value: 400 }));
      await render();
      expect(messages()).toEqual(['Saved “Dishwasher”']);
      await answer(testItem({ currentValue: 400, value: 400 }));
      expect(text('[data-testid="item-value"]')).toBe('$400.00');
    });

    it('deletes after a confirmation, then goes back to the room', async () => {
      await open();

      button('Delete')!.click();
      await render();
      confirmButton('Delete').click();
      http.expectOne({ method: 'DELETE', url: itemUrl }).flush(null);
      await render();

      expect(router.url).toBe(`/home/rooms/${ROOM_ID}`);
      expect(messages()).toEqual(['Deleted “Dishwasher”']);
    });

    it('says so when the item does not exist', async () => {
      await harness.navigateByUrl(`/home/items/${ITEM_ID}`, ItemDetailComponent);
      TestBed.tick();
      http.expectOne(itemUrl).flush(null, { status: 404, statusText: 'Not Found' });
      await render();

      expect(root().textContent).toContain('This item does not exist any more.');
    });
  });

  describe('for a read-only user', () => {
    beforeEach(() => start([provideReadOnlyUser()]));

    it('shows the item without change actions', async () => {
      await open(testItem({ links: [TX_LINK] }));
      lookups()[0].flush(testPage([testTransaction()]));
      await render();

      expect(root().querySelectorAll('button').length).toBe(0);
      expect(root().querySelector('[data-testid="add-document"]')).toBeNull();
      expect(root().querySelector('[data-testid="add-maintenance"]')).toBeNull();
      expect(text('[data-testid="purchases"]')).toContain('COSTCO WHOLESALE');
    });
  });
});
