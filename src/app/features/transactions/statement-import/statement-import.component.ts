import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TransactionRepository } from '../../../core/api/transaction-repository';
import { AccountRepository } from '../../../core/api/account-repository';
import { ImportResultOutputDto } from '../../../core/models/outputs/import-result-output-dto';
import { accountLabel } from '../../../shared/utils/account-labels';

/** Matches the API's upload limit. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-statement-import',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './statement-import.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatementImportComponent {
  private readonly repository = inject(TransactionRepository);
  private readonly accountRepository = inject(AccountRepository);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly imported = output<ImportResultOutputDto>();
  readonly cancelled = output<void>();

  readonly accounts = rxResource({ stream: () => this.accountRepository.getAll() });
  protected readonly accountLabel = accountLabel;

  readonly form = this.fb.group({
    accountId: this.fb.control<string | null>(null, Validators.required),
  });

  readonly file = signal<File | null>(null);
  readonly fileError = signal<string | null>(null);
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);
  /** The API's reason to think the file is from another account; the import can go ahead anyway. */
  readonly mismatch = signal<string | null>(null);

  constructor() {
    // A different account may well be the right one: the warning was about the previous choice.
    this.form.controls.accountId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.mismatch.set(null));
  }

  onFileSelected(input: HTMLInputElement): void {
    const file = input.files?.[0] ?? null;
    this.error.set(null);
    this.mismatch.set(null);
    if (file && file.size > MAX_FILE_BYTES) {
      this.file.set(null);
      this.fileError.set('The file is larger than 5 MB.');
      return;
    }
    this.fileError.set(null);
    this.file.set(file);
  }

  /** `confirmed`: import even though the API said the file looks like it's from another account. */
  onSubmit(confirmed = false): void {
    const file = this.file();
    const accountId = this.form.controls.accountId.value;
    if (!file || !accountId || this.uploading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.uploading.set(true);
    this.error.set(null);
    this.mismatch.set(null);
    this.repository.importStatement(file, accountId, confirmed).subscribe({
      next: (result) => {
        this.uploading.set(false);
        this.imported.emit(result);
      },
      error: (error: unknown) => {
        this.uploading.set(false);
        const mismatch = accountMismatch(error);
        if (mismatch) {
          this.mismatch.set(mismatch);
        } else {
          this.error.set(describeError(error));
        }
      },
    });
  }
}

/** The API's explanation when it thinks the file belongs to another account (409, code "account-mismatch"). */
function accountMismatch(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 409) return null;
  const problem = error.error as { code?: unknown; detail?: unknown } | null;
  if (problem?.code !== 'account-mismatch') return null;
  return typeof problem.detail === 'string' && problem.detail
    ? problem.detail
    : 'This file looks like it belongs to another account.';
}

/** Uses the API's problem details (validation errors or detail) when present. */
function describeError(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 413) {
    return 'The file is too large to upload (the limit is 5 MB).';
  }
  if (error instanceof HttpErrorResponse && error.status === 404) {
    return 'That account no longer exists. Choose another one.';
  }
  if (error instanceof HttpErrorResponse && error.status === 400) {
    const errors = error.error?.errors as Record<string, string[]> | undefined;
    const messages = errors ? Object.values(errors).flat() : [];
    return messages.length > 0 ? messages.join(' ') : 'The statement could not be read.';
  }
  return 'The import failed. Please try again.';
}
