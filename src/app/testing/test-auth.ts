import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Provider, signal } from '@angular/core';
import { AuthService } from '../core/auth/auth.service';

/**
 * A read-only user (T60): `canWrite()` is false. Only the parts of {@link AuthService} that the screens read are here.
 * Use it with `TestBed.overrideProvider(AuthService, { useValue: readOnlyAuth() })`, or {@link provideReadOnlyUser}.
 */
export function readOnlyAuth(): Partial<AuthService> {
  return {
    user: signal({ username: 'read-only token', scope: 'read-only' as const }).asReadonly(),
    canWrite: signal(false).asReadonly(),
  };
}

/** Signs the tests in as a read-only user (T60). */
export function provideReadOnlyUser(): Provider {
  return { provide: AuthService, useValue: readOnlyAuth() };
}

/**
 * Signs the real {@link AuthService} in as a read-only user (T60), through `GET /api/Auth/me`. For tests that already
 * use `HttpTestingController`.
 */
export async function signInAsReadOnly(http: HttpTestingController): Promise<void> {
  const loaded = TestBed.inject(AuthService).ensureLoaded();
  http.expectOne('/api/Auth/me').flush({ username: 'read-only token', scope: 'read-only' });
  await loaded;
}
