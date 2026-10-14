import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { CurrentUser } from './core/auth/auth.models';
import { LEGACY_FINANCE_PATHS } from './features/money/money-paths';

describe('app routes', () => {
  let user: CurrentUser | null;

  beforeEach(() => {
    user = { username: 'alex' };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        // No outlet: the router resolves each address (redirects, guards, lazy routes) without drawing the pages.
        provideRouter(routes),
        { provide: AuthService, useValue: { ensureLoaded: () => Promise.resolve(user) } },
      ],
    });
  });

  async function open(url: string): Promise<string> {
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    return router.url;
  }

  it('opens Today at the home address', async () => {
    expect(await open('/')).toBe('/today');
  });

  it('opens Today for an unknown address', async () => {
    expect(await open('/no-such-page')).toBe('/today');
  });

  it.each([...LEGACY_FINANCE_PATHS])('opens the old /%s under Money', async (path) => {
    expect(await open(`/${path}`)).toBe(`/money/${path}`);
  });

  it('keeps the filters of an old Transactions link', async () => {
    const query =
      'categoryId=c-dining&startDate=2026-09-01&endDate=2026-09-30&interval=Week&overTime=1';

    expect(await open(`/transactions?${query}`)).toBe(`/money/transactions?${query}`);
  });

  it('keeps the query string and the fragment of other old links', async () => {
    expect(await open('/review?year=2025&month=3')).toBe('/money/review?year=2025&month=3');
    expect(await open('/rules?tab=flows#unsorted')).toBe('/money/rules?tab=flows#unsorted');
  });

  it('opens the Dashboard as the Money home', async () => {
    expect(await open('/money')).toBe('/money');
  });

  it('opens the Money home for an unknown page under Money', async () => {
    expect(await open('/money/no-such-page')).toBe('/money');
  });

  it.each(['/today', '/timeline', '/capture', '/modules', '/search'])('opens %s', async (url) => {
    expect(await open(url)).toBe(url);
  });

  it.each(['/documents', '/documents/new', '/documents/0199f1a0-1111-7000-8000-000000000001'])(
    'opens %s in the Documents module',
    async (url) => {
      expect(await open(url)).toBe(url);
    },
  );

  it.each([
    '/tasks',
    '/tasks?due=overdue',
    '/tasks/new',
    '/tasks/0199f1a0-4444-7000-8000-000000000004',
  ])('opens %s in the Tasks module', async (url) => {
    expect(await open(url)).toBe(url);
  });

  it('signs in first, then returns to the new address of an old link', async () => {
    user = null;

    expect(await open('/budgets?status=Active')).toBe(
      '/login?returnUrl=%2Fmoney%2Fbudgets%3Fstatus%3DActive',
    );
  });
});
