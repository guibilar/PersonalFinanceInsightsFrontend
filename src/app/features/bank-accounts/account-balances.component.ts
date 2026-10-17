import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccountRepository } from '../../core/api/account-repository';
import { AccountType } from '../../core/models/enums/account-type';
import { AccountOutputDto } from '../../core/models/outputs/account-output-dto';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { validationDetail } from '../../shared/utils/problem-detail';
import { valueOf } from '../../shared/utils/resource-value';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { cents } from '../../shared/utils/cents';
import { AccountBalanceOutputDto } from '../../core/models/outputs/account-output-dto';

/** The API takes a balance between minus and plus this. */
const MAX_BALANCE = 100_000_000;

/** Today in the browser's time zone, as yyyy-MM-dd. */
function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * An account's balances: enter what it holds (a card: owes) at the end of a day, as the bank or broker shows it, and
 * the ones entered before. Between them, its transactions carry the balance for the net worth.
 */
@Component({
  selector: 'app-account-balances',
  imports: [ReactiveFormsModule, MoneyPipe, DatePipe, IconComponent, ConfirmDialogComponent],
  template: `
    <form class="row g-2 align-items-end mb-3" [formGroup]="form" (ngSubmit)="save()">
      <div class="col-sm-5">
        <label for="balance-date" class="form-label">On</label>
        <input
          type="date"
          id="balance-date"
          class="form-control"
          formControlName="date"
          [max]="maxDate"
          [class.is-invalid]="form.controls.date.invalid && form.controls.date.touched"
        />
      </div>
      <div class="col-sm-4">
        <label for="balance-amount" class="form-label">{{ isCard() ? 'Owed' : 'Balance' }}</label>
        <div class="input-group">
          <span class="input-group-text">$</span>
          <input
            type="number"
            id="balance-amount"
            class="form-control"
            formControlName="amount"
            [min]="-maxBalance"
            [max]="maxBalance"
            step="0.01"
            inputmode="decimal"
            aria-describedby="balance-amount-error"
            [class.is-invalid]="form.controls.amount.invalid && form.controls.amount.touched"
          />
        </div>
        @if (form.controls.amount.hasError('cents')) {
          <div id="balance-amount-error" class="invalid-feedback d-block">
            Whole cents only, like 12.50.
          </div>
        } @else if (form.controls.amount.hasError('min') || form.controls.amount.hasError('max')) {
          <div id="balance-amount-error" class="invalid-feedback d-block">
            Between -100,000,000 and 100,000,000.
          </div>
        }
      </div>
      <div class="col-sm-3 d-grid">
        <button type="submit" class="btn btn-primary" [disabled]="form.invalid || saving()">
          {{ saving() ? 'Saving…' : 'Save' }}
        </button>
      </div>
      <div class="form-text">
        @if (account().type === AccountType.Investment) {
          What it's worth, as your broker shows it. Enter it now and then: between balances only
          money in and out moves it, not the market.
        } @else if (isCard()) {
          What the card owes at the end of that day, as the card's statement or app shows it.
        } @else {
          What the account holds at the end of that day. Its transactions carry it on from there.
        }
      </div>
    </form>

    @if (balances.isLoading() && !balances.hasValue()) {
      <p class="text-body-secondary small mb-0">Loading…</p>
    } @else if (balances.error()) {
      <p class="text-danger small mb-0">Could not load the balances.</p>
    } @else if (list().length === 0) {
      <p class="text-body-secondary small mb-0">No balances entered yet.</p>
    } @else {
      <ul class="list-group list-group-flush" aria-label="Balances entered">
        @for (balance of list(); track balance.id) {
          <li class="list-group-item px-0 d-flex align-items-center gap-2">
            <span class="flex-grow-1">{{ balance.date | date: 'mediumDate' : 'UTC' }}</span>
            <span class="fw-medium">{{ balance.amount | money }}</span>
            <button
              type="button"
              class="btn btn-link btn-sm text-body-secondary p-1"
              [attr.aria-label]="
                'Delete the balance of ' + (balance.date | date: 'mediumDate' : 'UTC')
              "
              title="Delete"
              (click)="deleting.set(balance)"
            >
              <app-icon name="trash" [size]="14" />
            </button>
          </li>
        }
      </ul>
    }

    @if (deleting(); as balance) {
      <app-confirm-dialog
        [title]="'Delete the balance of ' + (balance.date | date: 'mediumDate' : 'UTC') + '?'"
        message="The net worth is carried from the balances that are left."
        [confirmLabel]="removing() ? 'Deleting…' : 'Delete'"
        [danger]="true"
        (confirmed)="remove(balance.id)"
        (cancelled)="deleting.set(null)"
      />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountBalancesComponent {
  private readonly repository = inject(AccountRepository);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly account = input.required<AccountOutputDto>();
  /** A balance was saved or deleted: the account's latest may have changed. */
  readonly changed = output<void>();

  protected readonly AccountType = AccountType;
  readonly maxDate = today();
  readonly maxBalance = MAX_BALANCE;
  readonly saving = signal(false);
  /** Asked to delete; the confirm dialog is showing. */
  readonly deleting = signal<AccountBalanceOutputDto | null>(null);
  readonly removing = signal(false);

  readonly balances = rxResource({
    params: () => this.account().id,
    stream: ({ params }) => this.repository.getBalances(params),
  });
  readonly list = () => valueOf(this.balances) ?? [];
  readonly isCard = () => this.account().type === AccountType.CreditCard;

  readonly form = this.fb.group({
    date: [today(), Validators.required],
    amount: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(-MAX_BALANCE),
      Validators.max(MAX_BALANCE),
      cents,
    ]),
  });

  save(): void {
    const { date, amount } = this.form.getRawValue();
    if (this.form.invalid || amount === null || this.saving()) return;
    this.saving.set(true);
    this.repository.setBalance(this.account().id, { date, amount }).subscribe({
      next: () => {
        this.saving.set(false);
        this.form.controls.amount.reset();
        this.balances.reload();
        this.changed.emit();
        this.toasts.success('Balance saved');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.toasts.error(validationDetail(error, 'Could not save the balance.'));
      },
    });
  }

  remove(balanceId: string): void {
    if (this.removing()) return;
    this.removing.set(true);
    this.repository.deleteBalance(this.account().id, balanceId).subscribe({
      next: () => {
        this.removing.set(false);
        this.deleting.set(null);
        this.balances.reload();
        this.changed.emit();
      },
      error: () => {
        this.removing.set(false);
        this.deleting.set(null);
        this.toasts.error('Could not delete the balance.');
      },
    });
  }
}
