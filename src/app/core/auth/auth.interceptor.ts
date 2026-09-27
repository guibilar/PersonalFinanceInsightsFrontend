import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { API_BASE_URL } from '../api/api-config';
import { AuthService } from './auth.service';

// A 401 from these is an answer ("wrong password", "not signed in"), not an ended session.
const OWN_AUTH_CALLS = [`${API_BASE_URL}/Auth/login`, `${API_BASE_URL}/Auth/me`];

/** Any other 401 means the session is gone: send the user to sign in again. */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !OWN_AUTH_CALLS.includes(request.url)
      ) {
        auth.sessionEnded();
      }
      return throwError(() => error);
    }),
  );
};
