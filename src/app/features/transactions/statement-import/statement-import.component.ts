import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TransactionRepository } from '../../../core/api/transaction-repository';
import { AccountType } from '../../../core/models/enums/account-type';
import { ImportResultOutputDto } from '../../../core/models/outputs/import-result-output-dto';

/** Matches the API's upload limit. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-statement-import',
  imports: [ReactiveFormsModule],
  templateUrl: './statement-import.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatementImportComponent {
  private readonly repository = inject(TransactionRepository);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly imported = output<ImportResultOutputDto>();
  readonly cancelled = output<void>();

  readonly accountOptions = [
    { value: AccountType.CreditCard, label: 'Credit card' },
    { value: AccountType.Chequing, label: 'Chequing' },
    { value: AccountType.Savings, label: 'Savings' },
  ];

  readonly form = this.fb.group({
    account: this.fb.control<AccountType | null>(null, Validators.required),
  });

  readonly file = signal<File | null>(null);
  readonly fileError = signal<string | null>(null);
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);

  onFileSelected(input: HTMLInputElement): void {
    const file = input.files?.[0] ?? null;
    this.error.set(null);
    if (file && file.size > MAX_FILE_BYTES) {
      this.file.set(null);
      this.fileError.set('The file is larger than 5 MB.');
      return;
    }
    this.fileError.set(null);
    this.file.set(file);
  }

  onSubmit(): void {
    const file = this.file();
    const account = this.form.controls.account.value;
    if (!file || !account || this.uploading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.uploading.set(true);
    this.error.set(null);
    this.repository.importStatement(file, account).subscribe({
      next: (result) => {
        this.uploading.set(false);
        this.imported.emit(result);
      },
      error: (error: unknown) => {
        this.uploading.set(false);
        this.error.set(describeError(error));
      },
    });
  }
}

/** Uses the API's problem details (validation errors or detail) when present. */
function describeError(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 413) {
    return 'The file is too large to upload (the limit is 5 MB).';
  }
  if (error instanceof HttpErrorResponse && error.status === 400) {
    const errors = error.error?.errors as Record<string, string[]> | undefined;
    const messages = errors ? Object.values(errors).flat() : [];
    return messages.length > 0 ? messages.join(' ') : 'The statement could not be read.';
  }
  return 'The import failed. Please try again.';
}
