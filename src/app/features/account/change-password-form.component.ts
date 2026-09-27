import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';

/** Same rule as the API: length, not composition. */
export const MIN_PASSWORD_LENGTH = 12;

function matchingPasswords(group: AbstractControl): ValidationErrors | null {
  const { newPassword, confirmPassword } = group.value as Record<string, string>;
  return confirmPassword && newPassword !== confirmPassword ? { mismatch: true } : null;
}

@Component({
  selector: 'app-change-password-form',
  imports: [ReactiveFormsModule],
  templateUrl: './change-password-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePasswordFormComponent {
  private readonly auth = inject(AuthService);

  readonly changed = output<void>();
  readonly cancelled = output<void>();

  readonly minLength = MIN_PASSWORD_LENGTH;
  readonly form = inject(NonNullableFormBuilder).group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: matchingPasswords },
  );

  readonly saving = signal(false);
  /** Messages from the API, by field. */
  readonly serverErrors = signal<{
    currentPassword?: string;
    newPassword?: string;
    other?: string;
  }>({});

  shows(control: 'currentPassword' | 'newPassword' | 'confirmPassword'): boolean {
    const c = this.form.controls[control];
    return c.invalid && c.touched;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { currentPassword, newPassword } = this.form.getRawValue();
    this.saving.set(true);
    this.serverErrors.set({});
    this.auth.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.saving.set(false);
        this.changed.emit();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.serverErrors.set(toFieldErrors(error));
      },
    });
  }
}

function toFieldErrors(error: unknown): {
  currentPassword?: string;
  newPassword?: string;
  other?: string;
} {
  const errors =
    error instanceof HttpErrorResponse && error.status === 400
      ? ((error.error as { errors?: Record<string, string[]> } | null)?.errors ?? {})
      : {};
  const first = (key: string) =>
    Object.entries(errors).find(([name]) => name.toLowerCase() === key.toLowerCase())?.[1]?.[0];
  const currentPassword = first('currentPassword');
  const newPassword = first('newPassword');
  return currentPassword || newPassword
    ? { currentPassword, newPassword }
    : { other: 'Could not change the password. Try again.' };
}
