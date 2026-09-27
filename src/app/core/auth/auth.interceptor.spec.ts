import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let sessionEnded: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    sessionEnded = spyOn(TestBed.inject(AuthService), 'sessionEnded');
  });

  function unauthorized(url: string) {
    let failed = false;
    http.post(url, {}).subscribe({ error: () => (failed = true) });
    backend.expectOne(url).flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(failed).withContext('the caller still gets the error').toBeTrue();
  }

  it('ends the session on a 401 from the API', () => {
    unauthorized('/api/Budget/Filter');
    expect(sessionEnded).toHaveBeenCalledTimes(1);
  });

  it('leaves 401s from signing in and "who am I" to their callers', () => {
    unauthorized('/api/Auth/login');
    unauthorized('/api/Auth/me');
    expect(sessionEnded).not.toHaveBeenCalled();
  });

  it('ignores other errors', () => {
    http.get('/api/Budget/x').subscribe({ error: () => undefined });
    backend.expectOne('/api/Budget/x').flush(null, { status: 500, statusText: 'Error' });
    expect(sessionEnded).not.toHaveBeenCalled();
  });
});
