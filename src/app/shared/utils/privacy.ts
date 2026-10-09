import { signal } from '@angular/core';

/** Remembered across visits, so a page opened in public doesn't flash the amounts before the switch is found. */
export const PRIVACY_STORAGE_KEY = 'hide-amounts';

const hidden = signal(readHidden());

/**
 * Privacy mode: every amount the app shows reads "$•••••" while it's on. A signal, so the formatters that read it
 * (and the templates and charts built from them) redraw when it's switched.
 */
export const amountsHidden = hidden.asReadonly();

export function setAmountsHidden(value: boolean): void {
  hidden.set(value);
  try {
    localStorage.setItem(PRIVACY_STORAGE_KEY, String(value));
  } catch {
    // Not remembered when storage is unavailable.
  }
}

export function toggleAmountsHidden(): void {
  setAmountsHidden(!hidden());
}

function readHidden(): boolean {
  try {
    return localStorage.getItem(PRIVACY_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}
