import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, firstValueFrom, tap } from 'rxjs';
import { API_BASE_URL } from '../api/api-config';
import { ChangePasswordInput, CurrentUser, LoginInput, SignedOutSessions } from './auth.models';

/**
 * Who is signed in. The session itself is an HttpOnly cookie the browser sends with every request,
 * so the app never sees a token; it only asks the API who the cookie belongs to.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly baseUrl = `${API_BASE_URL}/Auth`;

  private readonly current = signal<CurrentUser | null>(null);
  /** The signed-in user, or null. Only meaningful once {@link ensureLoaded} has resolved. */
  readonly user = this.current.asReadonly();

  private loaded: Promise<CurrentUser | null> | null = null;

  /** Asks the API once per page load; afterwards login and logout keep the answer up to date. */
  ensureLoaded(): Promise<CurrentUser | null> {
    this.loaded ??= firstValueFrom(this.http.get<CurrentUser>(`${this.baseUrl}/me`)).then(
      (user) => this.set(user),
      (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) return this.set(null);
        // Can't tell (API down): ask again on the next navigation instead of assuming signed out.
        this.loaded = null;
        throw error;
      },
    );
    return this.loaded;
  }

  login(input: LoginInput): Observable<CurrentUser> {
    return this.http
      .post<CurrentUser>(`${this.baseUrl}/login`, input)
      .pipe(tap((user) => this.set(user)));
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/logout`, null).pipe(
      tap(() => {
        this.set(null);
        void this.router.navigateByUrl('/login');
      }),
    );
  }

  /** Also signs out every other session of the account; this one stays signed in. */
  changePassword(input: ChangePasswordInput): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/change-password`, input);
  }

  /** Ends every other session of the account (other browsers and devices); this one stays signed in. */
  signOutOtherDevices(): Observable<SignedOutSessions> {
    return this.http.post<SignedOutSessions>(`${this.baseUrl}/sign-out-others`, null);
  }

  /** The API rejected the session (expired, or signed out elsewhere). */
  sessionEnded(): void {
    if (!this.current()) return;
    this.set(null);
    const returnUrl = this.router.url;
    void this.router.navigate(['/login'], {
      queryParams: returnUrl && returnUrl !== '/' ? { returnUrl } : {},
      state: { sessionEnded: true },
    });
  }

  private set(user: CurrentUser | null): CurrentUser | null {
    this.current.set(user);
    this.loaded = Promise.resolve(user);
    return user;
  }
}

/** Only same-app paths: never follow a returnUrl to another site. */
export function safeReturnUrl(value: string | null | undefined): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')
    ? value
    : '/';
}
