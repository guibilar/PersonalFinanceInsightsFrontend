import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationError, Router, provideRouter } from '@angular/router';
import { NavigationFailureService } from './navigation-failure';
import { ToastService } from '../../shared/ui/toast/toast.service';

describe('NavigationFailureService', () => {
  let service: NavigationFailureService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter([{ path: '**', children: [] }])],
    });
    service = TestBed.inject(NavigationFailureService);
    router = TestBed.inject(Router);
  });

  const failure = (error: unknown, url = '/budgets') => new NavigationError(1, url, error);

  it('offers to try again when the first page could not open (the API down)', async () => {
    service.handle(failure(new Error('Http failure response: 502')));
    expect(service.failedUrl()).toBe('/budgets');

    service.retry();
    await router.navigateByUrl('/budgets');
    expect(service.failedUrl()).toBeNull();
  });

  it('says so in a toast once a page is showing, keeping it', async () => {
    await router.navigateByUrl('/');
    service.handle(failure(new Error('Http failure response: 502')));

    expect(service.failedUrl()).toBeNull();
    expect(TestBed.inject(ToastService).toasts()[0].message).toContain("Couldn't open that page");
  });
});
