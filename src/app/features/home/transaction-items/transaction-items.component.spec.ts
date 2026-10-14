import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TransactionItemsComponent } from './transaction-items.component';
import { provideReadOnlyUser } from '../../../testing/test-auth';
import { TX_ID, testTransaction } from '../../../testing/test-documents';
import { ITEM_ID, testItemSummary } from '../../../testing/test-home';

@Component({
  imports: [TransactionItemsComponent],
  template: `<app-transaction-items [transaction]="transaction" />`,
})
class HostComponent {
  readonly transaction = testTransaction({ description: 'COSTCO WHOLESALE #521 ' });
}

describe('TransactionItemsComponent', () => {
  let http: HttpTestingController;

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

  async function create(items = [testItemSummary()]) {
    const fixture = TestBed.createComponent(HostComponent);
    TestBed.tick();
    const request = http.expectOne((r) => r.url === '/api/home/items/by-link');
    expect(request.request.params.get('kind')).toBe('Money.Transaction');
    expect(request.request.params.get('id')).toBe(TX_ID);
    request.flush(items);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => http.verify());

  it('lists the items of the transaction, and adds one with its name, price and day', async () => {
    configure();
    const root = await create();

    const item = root.querySelector<HTMLAnchorElement>('[data-testid="transaction-items"] a')!;
    expect(item.getAttribute('href')).toBe(`/home/items/${ITEM_ID}`);
    expect(item.textContent).toContain('Dishwasher');

    const add = root.querySelector<HTMLAnchorElement>('[data-testid="add-to-inventory"]')!;
    const url = new URL(add.href);
    expect(url.pathname).toBe('/home/items/new');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      transactionId: TX_ID,
      name: 'COSTCO WHOLESALE #521',
      price: '142.18',
      date: '2026-10-03',
    });
  });

  it('shows no add action to a read-only user', async () => {
    configure([provideReadOnlyUser()]);
    const root = await create([]);

    expect(root.querySelector('[data-testid="add-to-inventory"]')).toBeNull();
    expect(root.textContent).toContain('Not in the home inventory.');
  });
});
