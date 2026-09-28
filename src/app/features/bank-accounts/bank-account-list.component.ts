import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AccountRepository } from '../../core/api/account-repository';
import { AccountInputDto } from '../../core/models/inputs/account-input-dto';
import { AccountOutputDto } from '../../core/models/outputs/account-output-dto';
import { ACCOUNT_TYPE_LABELS } from '../../shared/utils/account-labels';
import { conflictDetail } from '../../shared/utils/problem-detail';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { SidePanelComponent } from '../../shared/ui/side-panel/side-panel.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { BankAccountFormComponent } from './bank-account-form.component';

/** The bank accounts statements are imported into: add, rename, and delete the empty ones. */
@Component({
  selector: 'app-bank-account-list',
  imports: [
    BankAccountFormComponent,
    ConfirmDialogComponent,
    ErrorStateComponent,
    IconComponent,
    SidePanelComponent,
    SkeletonComponent,
  ],
  templateUrl: './bank-account-list.component.html',
  styleUrl: './bank-account-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BankAccountListComponent {
  private readonly accountRepository = inject(AccountRepository);
  private readonly toasts = inject(ToastService);

  readonly accounts = rxResource({ stream: () => this.accountRepository.getAll() });

  /** undefined: panel closed; null: adding; an account: renaming it. */
  readonly editing = signal<AccountOutputDto | null | undefined>(undefined);
  readonly deleting = signal<AccountOutputDto | null>(null);
  readonly saving = signal(false);

  protected readonly typeLabels = ACCOUNT_TYPE_LABELS;

  onFormSubmit(input: AccountInputDto): void {
    if (this.saving()) return;
    const editing = this.editing();
    const request = editing
      ? this.accountRepository.rename(editing.id, input.name)
      : this.accountRepository.create(input);

    this.saving.set(true);
    request.subscribe({
      next: (account) => {
        this.saving.set(false);
        this.editing.set(undefined);
        this.accounts.reload();
        this.toasts.success(editing ? `Renamed to “${account.name}”` : `Added “${account.name}”`);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.toasts.error(
          conflictDetail(
            error,
            editing ? 'Could not rename the account.' : 'Could not add the account.',
          ),
        );
      },
    });
  }

  confirmDelete(): void {
    const account = this.deleting();
    if (!account) return;
    this.deleting.set(null);
    this.accountRepository.delete(account.id).subscribe({
      next: () => {
        this.accounts.reload();
        this.toasts.success(`Deleted “${account.name}”`);
      },
      error: (error: unknown) => {
        // A 409 says it has transactions after all (imported since the list loaded).
        this.accounts.reload();
        this.toasts.error(conflictDetail(error, `Could not delete “${account.name}”.`));
      },
    });
  }
}
