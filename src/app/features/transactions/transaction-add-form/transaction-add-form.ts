import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Category } from '../../../core/models/enums/category';
import { Flow } from '../../../core/models/enums/flow';
import { StatementFormat } from '../../../core/models/enums/statement-format';
import { TransactionType } from '../../../core/models/enums/transaction-type';
import { TransactionInputDto } from '../../../core/models/inputs/transaction-input-dto';
import { AccountOutputDto } from '../../../core/models/outputs/account-output-dto';
import { TEXT_LIMITS } from '../../../core/models/text-limits';
import { accountLabel } from '../../../shared/utils/account-labels';
import { FLOW_LABELS, flowsFor } from '../../../shared/utils/flow-helper';

const NOT_BLANK = Validators.pattern(/\S/);

/** Today as `yyyy-MM-dd` in the local time zone, which is what the date field takes. */
function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Adds a transaction by hand, for an account whose bank offers no statement files (or a purchase that isn't on a
 * statement yet). The category and flow can be left to the rules.
 */
@Component({
  selector: 'app-transaction-add-form',
  imports: [ReactiveFormsModule],
  templateUrl: './transaction-add-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionAddForm implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly accounts = input.required<AccountOutputDto[]>();
  readonly saving = input(false);
  /**
   * The date and account of the transaction added just before, which the form starts on: entering a statement's
   * worth of transactions by hand shouldn't mean picking the same day and account again each time.
   */
  readonly previous = input<{ date: string; accountId: string } | null>(null);
  /** The API's reason when an identical transaction exists; the same one can still be added on purpose. */
  readonly duplicate = input<string | null>(null);
  readonly submitAdd = output<TransactionInputDto>();
  readonly cancelled = output<void>();

  protected readonly accountLabel = accountLabel;
  protected readonly TransactionType = TransactionType;
  readonly categories = Object.values(Category);
  readonly flowLabels = FLOW_LABELS;
  readonly maxDescription = TEXT_LIMITS.transactionDescription;

  readonly form = this.fb.group({
    accountId: this.fb.control<string | null>(null, Validators.required),
    date: [today(), Validators.required],
    description: [
      '',
      [Validators.required, NOT_BLANK, Validators.maxLength(TEXT_LIMITS.transactionDescription)],
    ],
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    transactionType: [TransactionType.Debit],
    // null: let the rules decide.
    category: this.fb.control<Category | null>(null),
    flow: this.fb.control<Flow | null>(null),
  });

  private readonly direction = toSignal(this.form.controls.transactionType.valueChanges, {
    initialValue: this.form.controls.transactionType.value,
  });
  /** Only what fits the direction: money out can't be income, money in can't be spending. */
  readonly flows = computed(() => flowsFor(this.direction()));

  ngOnInit(): void {
    const previous = this.previous();
    if (!previous) return;
    this.form.patchValue({ date: previous.date });
    if (this.accounts().some((a) => a.id === previous.accountId)) {
      this.form.patchValue({ accountId: previous.accountId });
    }
  }

  constructor() {
    // Start on an account that has to be filled by hand, if there is one.
    effect(() => {
      const accounts = this.accounts();
      const { accountId } = this.form.controls;
      if (accountId.value !== null) return;
      const manual = accounts.find((a) => a.format === StatementFormat.Manual);
      if (manual) accountId.setValue(manual.id);
    });
    this.form.controls.transactionType.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      const { flow } = this.form.controls;
      if (flow.value !== null && !this.flows().includes(flow.value)) flow.setValue(null);
    });
  }

  onSubmit(allowDuplicate = false): void {
    const { accountId, amount } = this.form.getRawValue();
    if (this.form.invalid || accountId === null || amount === null || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.submitAdd.emit({
      date: value.date,
      description: value.description.trim(),
      amount,
      transactionType: value.transactionType,
      accountId,
      ...(value.category ? { category: value.category } : {}),
      ...(value.flow ? { flow: value.flow } : {}),
      ...(allowDuplicate ? { allowDuplicate } : {}),
    });
  }
}
