import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { TransactionAddLauncher } from './transaction-add-launcher.service';

describe('TransactionAddLauncher', () => {
  let http: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        // The end of a session goes to the sign-in page.
        provideRouter([{ path: 'login', children: [] }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => http.verify());

  it("forgets the open panel, the receipt and the last account when the session ends: not the next person's", async () => {
    const loaded = auth.ensureLoaded();
    http.expectOne('/api/Auth/me').flush({ username: 'alex' });
    await loaded;
    const launcher = TestBed.inject(TransactionAddLauncher);
    launcher.open({ description: 'Pharmacy', amount: 12.5, date: '2026-10-14', documentId: 'd1' });
    launcher.lastAdded.set({ date: '2026-10-14', accountId: 'a1' });

    auth.sessionEnded();
    auth.login({ username: 'sam', password: 'secret', rememberMe: false }).subscribe();
    http.expectOne('/api/Auth/login').flush({ username: 'sam' });

    expect(launcher.isOpen()).toBe(false);
    expect(launcher.prefill()).toBeNull();
    expect(launcher.lastAdded()).toBeNull();
  });
});
