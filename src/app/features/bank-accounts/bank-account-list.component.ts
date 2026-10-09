import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AccountRepository } from '../../core/api/account-repository';
import { AccountInputDto } from '../../core/models/inputs/account-input-dto';
import { AccountOutputDto } from '../../core/models/outputs/account-output-dto';
import { RegisteredPlan } from '../../core/models/enums/registered-plan';
import { AccountType } from '../../core/models/enums/account-type';
import {
  ACCOUNT_TYPE_LABELS,
  PLAN_LABELS,
  STATEMENT_FORMAT_LABELS,
} from '../../shared/utils/account-labels';
import { conflictDetail } from '../../shared/utils/problem-detail';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { BankAccountFormComponent } from './bank-account-form.component';
import { AccountBalancesComponent } from './account-balances.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

/**
 * The accounts statements are imported into: add, edit, delete the empty ones, and enter their balances. A registered
 * plan's room left this year shows under it.
 */
@Component({
  selector: 'app-bank-account-list',
  imports: [
    MoneyPipe,
    DatePipe,
    AccountBalancesComponent,
    BankAccountFormComponent,
    ConfirmDialogComponent,
    ErrorStateComponent,
    IconComponent,
    ModalComponent,
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

  /** undefined: dialog closed; null: adding; an account: editing it. */
  readonly editing = signal<AccountOutputDto | null | undefined>(undefined);
  readonly deleting = signal<AccountOutputDto | null>(null);
  /** The account whose balances are open. */
  readonly balancesOf = signal<AccountOutputDto | null>(null);
  readonly saving = signal(false);

  protected readonly typeLabels = ACCOUNT_TYPE_LABELS;
  protected readonly formatLabels = STATEMENT_FORMAT_LABELS;
  protected readonly planLabels = PLAN_LABELS;
  protected readonly RegisteredPlan = RegisteredPlan;
  protected readonly AccountType = AccountType;

  /** How much of this year's room is used, 0–100. */
  roomUsed(account: AccountOutputDto): number {
    const room = account.contributionRoom ?? 0;
    if (room <= 0) return 100;
    return Math.min(100, Math.round(((account.depositedThisYear ?? 0) / room) * 100));
  }

  onFormSubmit(input: AccountInputDto): void {
    if (this.saving()) return;
    const editing = this.editing();
    const request = editing
      ? this.accountRepository.update(editing.id, {
          name: input.name,
          format: input.format,
          plan: input.plan,
          contributionRoom: input.contributionRoom,
          contributionRoomYear: input.contributionRoomYear,
        })
      : this.accountRepository.create(input);

    this.saving.set(true);
    request.subscribe({
      next: (account) => {
        this.saving.set(false);
        this.editing.set(undefined);
        this.accounts.reload();
        this.toasts.success(editing ? `Saved “${account.name}”` : `Added “${account.name}”`);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.toasts.error(
          conflictDetail(
            error,
            editing ? 'Could not save the account.' : 'Could not add the account.',
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
