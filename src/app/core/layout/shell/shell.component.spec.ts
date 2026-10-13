import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ShellComponent } from './shell.component';
import { AuthService } from '../../auth/auth.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { DataChangesService } from '../../data/data-changes.service';
import { StatementImportLauncher } from '../../data/statement-import-launcher.service';
import { TransactionAddLauncher } from '../../data/transaction-add-launcher.service';
import { AccountType } from '../../models/enums/account-type';
import { Flow } from '../../models/enums/flow';
import { TransactionType } from '../../models/enums/transaction-type';
import { TEST_CATEGORIES } from '../../../testing/test-categories';
import { PRIVACY_STORAGE_KEY, amountsHidden } from '../../../shared/utils/privacy';

describe('ShellComponent', () => {
  beforeEach(() => {
    localStorage.removeItem('sidebar-collapsed');
    TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([
          { path: 'budgets', children: [] },
          { path: 'today', children: [] },
          { path: 'money', children: [] },
          { path: 'login', children: [] },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
  });

  afterEach(() => {
    localStorage.removeItem('sidebar-collapsed');
    localStorage.removeItem(PRIVACY_STORAGE_KEY);
  });

  it('renders the main menu, then the active modules', async () => {
    const fixture = TestBed.createComponent(ShellComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const labels = (selector: string) =>
      Array.from(root.querySelectorAll(selector)).map((el) => el.textContent!.trim());

    expect(labels('.sidebar .main-menu .label')).toEqual([
      'Today',
      'Timeline',
      'Capture',
      'Modules',
      'Search',
    ]);
    expect(labels('.sidebar .nav-group .nav-group-label')).toEqual(['Modules']);
    expect(labels('.sidebar .nav-group .nav-list .label')).toEqual(['Money', 'Documents']);
    expect(
      Array.from(root.querySelectorAll('.sidebar .nav-group .nav-item')).map((item) =>
        item.getAttribute('href'),
      ),
    ).toEqual(['/money', '/documents']);
  });

  it('has the main menu as a bottom bar for small screens, with Capture as its centre action', async () => {
    const fixture = TestBed.createComponent(ShellComponent);
    await fixture.whenStable();
    const items = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>(
        'app-bottom-bar .bottom-item',
      ),
    );

    expect(items.map((item) => item.getAttribute('href'))).toEqual([
      '/today',
      '/timeline',
      '/capture',
      '/modules',
      '/search',
    ]);
    expect(items.map((item) => item.classList.contains('primary'))).toEqual([
      false,
      false,
      true,
      false,
      false,
    ]);
  });

  it('imports statements over any page, and says so to the page showing them', async () => {
    const fixture = TestBed.createComponent(ShellComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const changes = TestBed.inject(DataChangesService);
    const before = changes.version();

    // Money and Capture open it.
    TestBed.inject(StatementImportLauncher).open();
    TestBed.tick();
    // The form's accounts: answered before waiting, or the page never settles.
    TestBed.inject(HttpTestingController).expectOne('/api/Accounts').flush([]);
    await fixture.whenStable();
    expect(root.querySelector('app-statement-import')).not.toBeNull();

    fixture.componentInstance.onImported({ files: 2, read: 5, added: 4, skipped: 1 });
    await fixture.whenStable();

    expect(root.querySelector('app-statement-import')).toBeNull();
    expect(TestBed.inject(StatementImportLauncher).isOpen()).toBe(false);
    expect(changes.version()).toBe(before + 1);
    expect(TestBed.inject(ToastService).toasts()[0].message).toBe(
      'Imported 4 new transactions from 2 files (1 already imported)',
    );
  });

  it('adds a transaction over any page, and links to it', async () => {
    const fixture = TestBed.createComponent(ShellComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const changes = TestBed.inject(DataChangesService);
    const before = changes.version();
    const adder = TestBed.inject(TransactionAddLauncher);

    // Capture opens it.
    adder.open();
    TestBed.tick();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/Accounts').flush([]);
    http.expectOne('/api/Categories').flush([]);
    await fixture.whenStable();
    expect(root.querySelector('app-transaction-add-panel')).not.toBeNull();

    fixture.componentInstance.onTransactionAdded({
      id: 't9',
      date: '2026-10-09',
      amount: 24.5,
      description: 'Farmers market',
      category: TEST_CATEGORIES.other,
      categoryLocked: false,
      transactionType: TransactionType.Debit,
      accountId: 'a1',
      accountName: 'Visa',
      accountType: AccountType.CreditCard,
      flow: Flow.Spending,
      flowLocked: false,
      budgetId: '',
    });
    await fixture.whenStable();

    expect(root.querySelector('app-transaction-add-panel')).toBeNull();
    expect(adder.isOpen()).toBe(false);
    expect(adder.lastAdded()).toEqual({ date: '2026-10-09', accountId: 'a1' });
    expect(changes.version()).toBe(before + 1);
    const toast = TestBed.inject(ToastService).toasts()[0];
    expect(toast.message).toBe('Added “Farmers market” to Visa');
    expect(toast.link).toEqual({
      label: 'View',
      route: '/money/transactions',
      queryParams: { id: 't9' },
    });
  });

  it('hides and shows the amounts from the sidebar', async () => {
    const fixture = TestBed.createComponent(ShellComponent);
    await fixture.whenStable();
    const toggle = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.sidebar .privacy-toggle',
    )!;

    toggle.click();
    await fixture.whenStable();

    expect(amountsHidden()).toBe(true);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    toggle.click();
    await fixture.whenStable();
    expect(amountsHidden()).toBe(false);
  });

  it('remembers the collapsed state', () => {
    const shell = TestBed.createComponent(ShellComponent).componentInstance;

    shell.toggleCollapsed();

    expect(shell.collapsed()).toBe(true);
    expect(localStorage.getItem('sidebar-collapsed')).toBe('true');
  });

  it('closes the mobile menu after navigating', async () => {
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.componentInstance.mobileOpen.set(true);

    await TestBed.inject(Router).navigateByUrl('/budgets');

    expect(fixture.componentInstance.mobileOpen()).toBe(false);
  });

  it('shows who is signed in and signs out', async () => {
    const http = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthService);
    const loaded = auth.ensureLoaded();
    http.expectOne('/api/Auth/me').flush({ username: 'alex' });
    await loaded;
    const fixture = TestBed.createComponent(ShellComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.signed-in-as')?.textContent).toContain('alex');

    const signOut = Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Sign out',
    )!;
    signOut.click();
    http.expectOne({ method: 'POST', url: '/api/Auth/logout' }).flush(null);
    await fixture.whenStable();

    expect(auth.user()).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/login');
    http.verify();
  });

  it('opens the change-password panel', async () => {
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.componentInstance.changingPassword.set(true);
    await fixture.whenStable();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('app-change-password-form'),
    ).not.toBeNull();
  });

  it('signs out the other devices after confirming, and says how many', async () => {
    const fixture = TestBed.createComponent(ShellComponent);
    const shell = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    const toasts = TestBed.inject(ToastService);

    shell.confirmingSignOutOthers.set(true);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Sign out other devices?');
    http.expectNone('/api/Auth/sign-out-others');

    shell.signOutOtherDevices();
    http.expectOne({ method: 'POST', url: '/api/Auth/sign-out-others' }).flush({ count: 2 });
    shell.signOutOtherDevices();
    http.expectOne('/api/Auth/sign-out-others').flush({ count: 0 });

    expect(shell.confirmingSignOutOthers()).toBe(false);
    expect(toasts.toasts().map((t) => t.message)).toEqual([
      'Signed out 2 other sessions',
      'No other devices were signed in',
    ]);
  });
});
