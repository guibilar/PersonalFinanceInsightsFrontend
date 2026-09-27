import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ShellComponent } from './shell.component';

describe('ShellComponent', () => {
  beforeEach(() => {
    localStorage.removeItem('sidebar-collapsed');
    TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([{ path: 'budgets', children: [] }]),
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

    expect(shell.collapsed()).toBeTrue();
    expect(localStorage.getItem('sidebar-collapsed')).toBe('true');
  });

  it('closes the mobile menu after navigating', async () => {
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.componentInstance.mobileOpen.set(true);

    await TestBed.inject(Router).navigateByUrl('/budgets');

    expect(fixture.componentInstance.mobileOpen()).toBeFalse();
  });
});
