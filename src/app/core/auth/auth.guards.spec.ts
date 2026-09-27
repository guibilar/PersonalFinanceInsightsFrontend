import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { authGuard, signedOutGuard } from './auth.guards';

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class Page {}

describe('auth guards', () => {
  let router: Router;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'login', component: Page, canActivate: [signedOutGuard] },
          { path: 'budgets', component: Page, canActivate: [authGuard] },
          { path: '', component: Page, canActivate: [authGuard] },
        ]),
      ],
    });
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
  });

  async function navigate(url: string, me: object | null) {
    const done = router.navigateByUrl(url);
    await Promise.resolve();
    const request = http.expectOne('/api/Auth/me');
    if (me) request.flush(me);
    else request.flush(null, { status: 401, statusText: 'Unauthorized' });
    await done;
  }

  it('sends signed-out users to /login with the page to come back to', async () => {
    await navigate('/budgets', null);
    expect(router.url).toBe('/login?returnUrl=%2Fbudgets');
  });

  it('lets signed-in users through', async () => {
    await navigate('/budgets', { username: 'alex' });
    expect(router.url).toBe('/budgets');
  });

  it('skips the login page when already signed in', async () => {
    await navigate('/login', { username: 'alex' });
    expect(router.url).toBe('/');
  });
});
