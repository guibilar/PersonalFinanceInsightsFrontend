import { Injectable, inject, signal } from '@angular/core';
import { NavigationError, Router } from '@angular/router';
import { ToastService } from '../../shared/ui/toast/toast.service';

/**
 * The page a reload was last tried for, and when: a chunk still missing right after the reload doesn't loop, while a
 * later redeploy still gets its reload.
 */
const RELOADED_KEY = 'reloaded-for';
const RELOAD_WINDOW_MS = 30_000;

/**
 * A navigation that failed: the API unreachable while checking who is signed in (a 502 while it restarts, offline),
 * or a page's code gone because the app was redeployed while this tab stayed open. Without this the router just
 * stops: the very first page stays blank, later links do nothing.
 */
@Injectable({ providedIn: 'root' })
export class NavigationFailureService {
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  /** The address the first page failed to open at; the app shows a way to try again instead of a blank page. */
  readonly failedUrl = signal<string | null>(null);

  handle(error: NavigationError): void {
    if (isMissingChunk(error.error) && !reloadedAlready(error.url)) {
      // A new version is out: loading the address afresh brings its code.
      location.assign(error.url);
      return;
    }
    if (this.router.navigated) {
      this.toasts.error("Couldn't open that page. Check the connection and try again.");
    } else {
      this.failedUrl.set(error.url);
    }
  }

  retry(): void {
    const url = this.failedUrl();
    if (url === null) return;
    this.failedUrl.set(null);
    void this.router.navigateByUrl(url);
  }
}

function isMissingChunk(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(
    message,
  );
}

function reloadedAlready(url: string): boolean {
  try {
    const [at, last] = (sessionStorage.getItem(RELOADED_KEY) ?? '').split(' ');
    if (last === url && Date.now() - Number(at) < RELOAD_WINDOW_MS) return true;
    sessionStorage.setItem(RELOADED_KEY, `${Date.now()} ${url}`);
  } catch {
    // Without storage it may try once per failure; a reload that fixes nothing then shows the same failure.
  }
  return false;
}
