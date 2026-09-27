import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

/** Key shared with the inline script in index.html that applies the theme before Angular starts. */
export const THEME_STORAGE_KEY = 'theme';

/**
 * Light/dark colour mode via Bootstrap's data-bs-theme attribute. Follows the OS setting until the
 * user picks a theme, which is then remembered.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly media = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');

  private readonly systemTheme = signal<Theme>(this.media?.matches ? 'dark' : 'light');
  private readonly chosenTheme = signal<Theme | null>(readStoredTheme());

  readonly theme = computed<Theme>(() => this.chosenTheme() ?? this.systemTheme());

  constructor() {
    this.media?.addEventListener('change', (event) =>
      this.systemTheme.set(event.matches ? 'dark' : 'light'),
    );
    effect(() => this.document.documentElement.setAttribute('data-bs-theme', this.theme()));
  }

  toggle(): void {
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    this.chosenTheme.set(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the choice then lasts for this visit only.
    }
  }
}

function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
}
