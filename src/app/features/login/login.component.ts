import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, safeReturnUrl } from '../../core/auth/auth.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, IconComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Query parameter: where to go after signing in. */
  readonly returnUrl = input<string>();

  readonly form = inject(NonNullableFormBuilder).group({
    username: ['', Validators.required],
    password: ['', Validators.required],
    rememberMe: [false],
  });

  readonly submitting = signal(false);
  readonly showPassword = signal(false);
  readonly error = signal<string | null>(null);
  /** Set when the app sent us here because the API ended the session. */
  readonly sessionEnded = !!(history.state as { sessionEnded?: boolean } | null)?.sessionEnded;

  constructor() {
    // Said once: the browser keeps a page's state across a reload, which would say it again. The router's own
    // entries in the state stay.
    if (this.sessionEnded) history.replaceState({ ...history.state, sessionEnded: undefined }, '');
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => void this.router.navigateByUrl(safeReturnUrl(this.returnUrl())),
      error: (error: unknown) => {
        this.submitting.set(false);
        this.error.set(errorMessage(error));
        this.form.controls.password.reset();
      },
    });
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    // 401 wrong credentials, 429 locked out: the API explains both.
    const detail = (error.error as { detail?: string } | null)?.detail;
    if ((error.status === 401 || error.status === 429) && detail) return detail;
    if (error.status === 0) return 'Cannot reach the server. Check your connection and try again.';
  }
  return 'Something went wrong. Try again.';
}
