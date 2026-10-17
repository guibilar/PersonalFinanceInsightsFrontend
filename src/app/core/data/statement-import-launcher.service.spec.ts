import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { StatementImportLauncher } from './statement-import-launcher.service';

describe('StatementImportLauncher', () => {
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

  it('closes the panel when the session ends, so it does not open again for the next person', async () => {
    const loaded = auth.ensureLoaded();
    http.expectOne('/api/Auth/me').flush({ username: 'alex' });
    await loaded;
    const launcher = TestBed.inject(StatementImportLauncher);
    launcher.open();

    auth.sessionEnded();
    auth.login({ username: 'sam', password: 'secret', rememberMe: false }).subscribe();
    http.expectOne('/api/Auth/login').flush({ username: 'sam' });

    expect(launcher.isOpen()).toBe(false);
  });
});
