import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

describe('ThemeService', () => {
  const html = document.documentElement;

  function create(stored: string | null, systemDark: boolean): ThemeService {
    if (stored === null) localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, stored);
    spyOn(window, 'matchMedia').and.returnValue({
      matches: systemDark,
      addEventListener: () => undefined,
    } as unknown as MediaQueryList);

    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const service = TestBed.inject(ThemeService);
    TestBed.tick();
    return service;
  }

  afterEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    html.removeAttribute('data-bs-theme');
  });

  it('follows the system preference until the user chooses', () => {
    const service = create(null, true);

    expect(service.theme()).toBe('dark');
    expect(html.getAttribute('data-bs-theme')).toBe('dark');
  });

  it('prefers a saved choice over the system preference', () => {
    const service = create('light', true);

    expect(service.theme()).toBe('light');
  });

  it('toggles, applies and remembers the theme', () => {
    const service = create(null, false);

    service.toggle();
    TestBed.tick();

    expect(service.theme()).toBe('dark');
    expect(html.getAttribute('data-bs-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('ignores unknown saved values', () => {
    const service = create('purple', false);

    expect(service.theme()).toBe('light');
  });
});
