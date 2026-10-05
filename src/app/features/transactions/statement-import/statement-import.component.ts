import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, map } from 'rxjs';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TransactionRepository } from '../../../core/api/transaction-repository';
import { AccountRepository } from '../../../core/api/account-repository';
import { StatementFormat } from '../../../core/models/enums/statement-format';
import { ImportResultOutputDto } from '../../../core/models/outputs/import-result-output-dto';
import { accountLabel } from '../../../shared/utils/account-labels';

/** Matches the API's upload limit. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** One of the files picked, and how its import went. */
export interface FileImport {
  file: File;
  state: 'waiting' | 'importing' | 'imported' | 'failed' | 'mismatch';
  /** Why it failed, or why the API thinks it belongs to another account. */
  message?: string;
  result?: ImportResultOutputDto;
}

/** What all the files added together; the balance is the latest a statement gave. */
export interface ImportSummary extends ImportResultOutputDto {
  files: number;
}

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

  /** Every file is in: the dialog can close. */
  readonly imported = output<ImportSummary>();
  /** Some files are in and others need attention: the list behind can show what was added meanwhile. */
  readonly progressed = output<void>();
  readonly cancelled = output<void>();

  // Accounts without statement files have nothing to import into.
  readonly accounts = rxResource({
    stream: () =>
      this.accountRepository
        .getAll()
        .pipe(map((accounts) => accounts.filter((a) => a.format !== StatementFormat.Manual))),
  });
  protected readonly accountLabel = accountLabel;

  readonly form = this.fb.group({
    accountId: this.fb.control<string | null>(null, Validators.required),
  });

  readonly files = signal<FileImport[]>([]);
  readonly fileError = signal<string | null>(null);
  readonly uploading = computed(() => this.files().some((f) => f.state === 'importing'));
  /** Files still to send: new ones, and ones that failed (tried again). */
  readonly pending = computed(() =>
    this.files().filter((f) => f.state === 'waiting' || f.state === 'failed'),
  );
  readonly anyImported = computed(() => this.files().some((f) => f.state === 'imported'));

  constructor() {
    // A different account may well be the right one: the warnings were about the previous choice.
    this.form.controls.accountId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() =>
        this.files.update((files) =>
          files.map((f) => (f.state === 'mismatch' ? { file: f.file, state: 'waiting' } : f)),
        ),
      );
  }

  onFileSelected(input: HTMLInputElement): void {
    const picked = Array.from(input.files ?? []);
    const tooLarge = picked.filter((f) => f.size > MAX_FILE_BYTES);
    this.fileError.set(
      tooLarge.length === 0
        ? null
        : tooLarge.length === 1 && picked.length === 1
          ? 'The file is larger than 5 MB.'
          : `Left out, larger than 5 MB: ${tooLarge.map((f) => f.name).join(', ')}.`,
    );
    this.files.set(
      picked
        .filter((f) => f.size <= MAX_FILE_BYTES)
        .map((file) => ({ file, state: 'waiting' as const })),
    );
  }

  /** Sends the files still to import, one after another (a refused one doesn't stop the rest). */
  async onSubmit(): Promise<void> {
    const accountId = this.form.controls.accountId.value;
    const pending = this.pending();
    if (pending.length === 0 || !accountId || this.uploading()) {
      this.form.markAllAsTouched();
      return;
    }
    for (const entry of pending) await this.send(entry.file, accountId, false);
    this.finish();
  }

  /** Imports one file the API thought was another account's. */
  async importAnyway(entry: FileImport): Promise<void> {
    const accountId = this.form.controls.accountId.value;
    if (!accountId || this.uploading()) return;
    await this.send(entry.file, accountId, true);
    this.finish();
  }

  private async send(file: File, accountId: string, confirmed: boolean): Promise<void> {
    this.set(file, { file, state: 'importing' });
    try {
      const result = await firstValueFrom(
        this.repository.importStatement(file, accountId, confirmed),
      );
      this.set(file, { file, state: 'imported', result });
    } catch (error) {
      const mismatch = accountMismatch(error);
      this.set(
        file,
        mismatch
          ? { file, state: 'mismatch', message: mismatch }
          : { file, state: 'failed', message: describeError(error) },
      );
    }
  }

  private set(file: File, entry: FileImport): void {
    this.files.update((files) => files.map((f) => (f.file === file ? entry : f)));
  }

  private finish(): void {
    const files = this.files();
    if (files.length > 0 && files.every((f) => f.state === 'imported')) {
      this.imported.emit(summarize(files.map((f) => f.result!)));
    } else if (this.anyImported()) {
      this.progressed.emit();
    }
  }
}

function summarize(results: ImportResultOutputDto[]): ImportSummary {
  const latest = results
    .filter((r) => r.balance != null && r.balanceDate)
    .sort((a, b) => a.balanceDate!.localeCompare(b.balanceDate!))
    .at(-1);
  return {
    files: results.length,
    read: results.reduce((sum, r) => sum + r.read, 0),
    added: results.reduce((sum, r) => sum + r.added, 0),
    skipped: results.reduce((sum, r) => sum + r.skipped, 0),
    ...(latest ? { balance: latest.balance, balanceDate: latest.balanceDate } : {}),
  };
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
