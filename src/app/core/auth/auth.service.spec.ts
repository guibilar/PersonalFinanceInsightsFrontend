import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService, canWrite, safeReturnUrl } from './auth.service';

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'login', children: [] },
          { path: 'budgets', children: [] },
        ]),
      ],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks the API once who is signed in', async () => {
    const first = auth.ensureLoaded();
    const second = auth.ensureLoaded();
    http.expectOne('/api/Auth/me').flush({ username: 'alex' });

    expect(await first).toEqual({ username: 'alex' });
    expect(await second).toEqual({ username: 'alex' });
    expect(auth.user()).toEqual({ username: 'alex' });
  });

  it('can write unless the server says the scope is read-only', async () => {
    expect(auth.canWrite()).toBe(true); // nobody signed in yet: the server decides

    const loaded = auth.ensureLoaded();
    http.expectOne('/api/Auth/me').flush({ username: 'read-only token', scope: 'read-only' });
    await loaded;
    expect(auth.canWrite()).toBe(false);

    auth.login({ username: 'alex', password: 'pw', rememberMe: false }).subscribe();
    http.expectOne('/api/Auth/login').flush({ username: 'alex', scope: 'full' });
    expect(auth.canWrite()).toBe(true);
  });

  it('counts a missing scope (an old server) as full', () => {
    expect(canWrite({ username: 'alex' })).toBe(true);
    expect(canWrite({ username: 'alex', scope: 'full' })).toBe(true);
    expect(canWrite({ username: 'bot', scope: 'read-only' })).toBe(false);
    expect(canWrite(null)).toBe(true);
  });

  it('treats 401 as signed out', async () => {
    const loaded = auth.ensureLoaded();
    http.expectOne('/api/Auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(await loaded).toBeNull();
    await auth.ensureLoaded(); // answered from memory: no second request
  });

  it('asks again after a server error instead of assuming signed out', async () => {
    const failed = auth.ensureLoaded();
    http.expectOne('/api/Auth/me').flush(null, { status: 503, statusText: 'Unavailable' });
    await expect(failed).rejects.toThrow();

    const retried = auth.ensureLoaded();
    http.expectOne('/api/Auth/me').flush({ username: 'alex' });
    expect(await retried).toEqual({ username: 'alex' });
  });

  it('login and logout update the user', async () => {
    auth.login({ username: 'alex', password: 'pw', rememberMe: false }).subscribe();
    const login = http.expectOne({ method: 'POST', url: '/api/Auth/login' });
    expect(login.request.body).toEqual({ username: 'alex', password: 'pw', rememberMe: false });
    login.flush({ username: 'alex' });
    expect(auth.user()).toEqual({ username: 'alex' });
    expect(await auth.ensureLoaded()).toEqual({ username: 'alex' });

    auth.logout().subscribe();
    http.expectOne({ method: 'POST', url: '/api/Auth/logout' }).flush(null);
    await new Promise((resolve) => setTimeout(resolve)); // let the navigation to /login finish
    expect(auth.user()).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('sends the user to sign in again, remembering the page, when the session ends', async () => {
    const router = TestBed.inject(Router);
    auth.login({ username: 'alex', password: 'pw', rememberMe: false }).subscribe();
    http.expectOne('/api/Auth/login').flush({ username: 'alex' });
    await router.navigateByUrl('/budgets');

    auth.sessionEnded();
    await new Promise((resolve) => setTimeout(resolve));

    expect(auth.user()).toBeNull();
    expect(router.url).toBe('/login?returnUrl=%2Fbudgets');
  });

  it('only follows return URLs inside the app', () => {
    expect(safeReturnUrl('/budgets?x=1')).toBe('/budgets?x=1');
    expect(safeReturnUrl('//evil.example')).toBe('/');
    expect(safeReturnUrl('/\\evil.example')).toBe('/');
    expect(safeReturnUrl('https://evil.example')).toBe('/');
    expect(safeReturnUrl(undefined)).toBe('/');
  });
});
