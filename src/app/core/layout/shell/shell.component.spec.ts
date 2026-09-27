import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ShellComponent } from './shell.component';
import { AuthService } from '../../auth/auth.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';

describe('ShellComponent', () => {
  beforeEach(() => {
    localStorage.removeItem('sidebar-collapsed');
    TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([
          { path: 'budgets', children: [] },
          { path: 'login', children: [] },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
  });

  afterEach(() => localStorage.removeItem('sidebar-collapsed'));

  it('renders a link per page', async () => {
    const fixture = TestBed.createComponent(ShellComponent);
    await fixture.whenStable();

    const labels = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.nav-list .label'),
    ).map((el) => el.textContent?.trim());
    expect(labels).toEqual(['Dashboard', 'Transactions', 'Budgets']);
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
