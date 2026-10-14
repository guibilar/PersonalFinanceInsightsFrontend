import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { LinkedItemsComponent, LinkedItemsOwner, OwnerLink } from './linked-items.component';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { ItemSummaryDto } from '../../../core/models/outputs/home-output-dto';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { provideReadOnlyUser } from '../../../testing/test-auth';
import { ITEM_ID, testItemPage, testItemSummary } from '../../../testing/test-home';

const OWNER_ID = '0199f1a0-9999-7000-8000-000000000009';

@Component({
  imports: [LinkedItemsComponent],
  template: `<app-linked-items
    [kind]="kind()"
    [ownerId]="ownerId"
    [ownerLinks]="links()"
    (changed)="changes = changes + 1"
  />`,
})
class HostComponent {
  readonly kind = signal<LinkedItemsOwner>('Documents.Document');
  readonly ownerId = OWNER_ID;
  readonly links = signal<OwnerLink[]>([]);
  changes = 0;
}

describe('LinkedItemsComponent', () => {
  let http: HttpTestingController;

  const messages = () =>
    TestBed.inject(ToastService)
      .toasts()
      .map((t) => t.message);
  const confirmButton = (label: string) =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('app-confirm-dialog button')).find(
      (b) => b.textContent!.trim() === label,
    )!;

  /** Lets the page update; `whenStable` would wait for a pending request. */
  async function settle(fixture: { detectChanges(): void }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    fixture.detectChanges();
  }

  async function create(kind: LinkedItemsOwner, links: OwnerLink[], items: ItemSummaryDto[]) {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.kind.set(kind);
    fixture.componentInstance.links.set(links);
    TestBed.tick();
    const request = http.expectOne((r) => r.url === '/api/home/items/by-link');
    expect(request.request.params.get('kind')).toBe(kind);
    expect(request.request.params.get('id')).toBe(OWNER_ID);
    request.flush(items);
    await settle(fixture);
    return fixture;
  }

  function configure(extra: unknown[] = []): void {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        ...(extra as []),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  }

  afterEach(() => http.verify());

  it('shows the linked items, each opening its page', async () => {
    configure();
    const fixture = await create('Documents.Document', [], [testItemSummary()]);
    const root = fixture.nativeElement as HTMLElement;

    const row = root.querySelector<HTMLElement>('[data-testid="linked-items"] li')!;
    expect(row.innerText.replace(/\s+/g, ' ').trim()).toContain('Dishwasher Kitchen $899.99');
    expect(row.querySelector('a')!.getAttribute('href')).toBe(`/home/items/${ITEM_ID}`);
  });

  it('links an item from a document, with the kind Home.Item', async () => {
    configure();
    const fixture = await create('Documents.Document', [], []);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="no-items"]')).not.toBeNull();
    const changes = TestBed.inject(DataChangesService).version();

    root.querySelector<HTMLButtonElement>('button')!.click();
    await settle(fixture);
    TestBed.tick();
    http.expectOne((r) => r.url === '/api/home/items').flush(testItemPage([testItemSummary()]));
    await settle(fixture);
    document.querySelector<HTMLButtonElement>('[data-testid="picker-items"] button')!.click();

    const post = http.expectOne({ method: 'POST', url: `/api/documents/${OWNER_ID}/links` });
    expect(post.request.body).toEqual({ kind: 'Home.Item', targetId: ITEM_ID });
    post.flush({ id: 'l1', kind: 'Home.Item', targetId: ITEM_ID, createdAt: '' });
    await settle(fixture);

    expect(messages()).toEqual(['Linked to “Dishwasher”']);
    expect(fixture.componentInstance.changes).toBe(1);
    expect(TestBed.inject(DataChangesService).version()).toBe(changes + 1);
    TestBed.tick();
    http.expectOne((r) => r.url === '/api/home/items/by-link').flush([testItemSummary()]);
  });

  it('links an item from a task', async () => {
    configure();
    const fixture = await create('Tasks.Task', [], []);
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector<HTMLButtonElement>('button')!.click();
    await settle(fixture);
    TestBed.tick();
    http.expectOne((r) => r.url === '/api/home/items').flush(testItemPage([testItemSummary()]));
    await settle(fixture);
    document.querySelector<HTMLButtonElement>('[data-testid="picker-items"] button')!.click();

    const post = http.expectOne({ method: 'POST', url: `/api/tasks/${OWNER_ID}/links` });
    expect(post.request.body).toEqual({ kind: 'Home.Item', targetId: ITEM_ID });
    post.flush({ id: 'l1', kind: 'Home.Item', targetId: ITEM_ID, createdAt: '' });
    await settle(fixture);
    TestBed.tick();
    http.expectOne((r) => r.url === '/api/home/items/by-link').flush([testItemSummary()]);
  });

  it('unlinks a link of the task itself', async () => {
    configure();
    const own = { id: 'own', kind: 'Home.Item', targetId: ITEM_ID };
    const fixture = await create('Tasks.Task', [own], [testItemSummary()]);
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector<HTMLButtonElement>('[aria-label="Unlink Dishwasher"]')!.click();
    await settle(fixture);
    confirmButton('Unlink').click();
    http.expectOne({ method: 'DELETE', url: `/api/tasks/${OWNER_ID}/links/own` }).flush(null);
    await settle(fixture);

    expect(messages()).toEqual(['Unlinked']);
    TestBed.tick();
    http.expectOne((r) => r.url === '/api/home/items/by-link').flush([]);
  });

  it('unlinks a link that the item has to the document', async () => {
    configure();
    const item = testItemSummary({
      links: [{ id: 'item-link', kind: 'Documents.Document', targetId: OWNER_ID, createdAt: '' }],
    });
    const fixture = await create('Documents.Document', [], [item]);
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector<HTMLButtonElement>('[aria-label="Unlink Dishwasher"]')!.click();
    await settle(fixture);
    confirmButton('Unlink').click();
    http
      .expectOne({ method: 'DELETE', url: `/api/home/items/${ITEM_ID}/links/item-link` })
      .flush(null);
    await settle(fixture);
    TestBed.tick();
    http.expectOne((r) => r.url === '/api/home/items/by-link').flush([]);
  });

  it('shows the items without link or unlink to a read-only user', async () => {
    configure([provideReadOnlyUser()]);
    const fixture = await create('Documents.Document', [], [testItemSummary()]);
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="linked-items"]')).not.toBeNull();
    expect(root.querySelectorAll('button').length).toBe(0);
  });
});
