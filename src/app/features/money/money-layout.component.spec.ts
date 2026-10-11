import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MoneyLayoutComponent } from './money-layout.component';
import { StatementImportLauncher } from '../../core/data/statement-import-launcher.service';

describe('MoneyLayoutComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MoneyLayoutComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    });
  });

  it('keeps the finance sidebar groups as the Money sub-menu, under /money', async () => {
    const fixture = TestBed.createComponent(MoneyLayoutComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    const groups = Array.from(root.querySelectorAll('.money-group')).map((group) => [
      group.querySelector('.money-group-label')!.textContent!.trim(),
      Array.from(group.querySelectorAll<HTMLAnchorElement>('.money-item')).map((link) => [
        link.textContent!.trim(),
        link.getAttribute('href'),
      ]),
    ]);
    expect(groups).toEqual([
      [
        'Overview',
        [
          ['Dashboard', '/money'],
          ['Net worth', '/money/net-worth'],
          ['Review', '/money/review'],
        ],
      ],
      [
        'Spending',
        [
          ['Transactions', '/money/transactions'],
          ['Budgets', '/money/budgets'],
          ['Subscriptions', '/money/subscriptions'],
        ],
      ],
      [
        'Setup',
        [
          ['Accounts', '/money/accounts'],
          ['Categories', '/money/categories'],
          ['Tags', '/money/tags'],
          ['Rules', '/money/rules'],
        ],
      ],
    ]);
  });

  it('opens the statement import', async () => {
    const fixture = TestBed.createComponent(MoneyLayoutComponent);
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.import-button')!
      .click();

    expect(TestBed.inject(StatementImportLauncher).isOpen()).toBe(true);
  });
});
