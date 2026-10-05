import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccountType } from '../../core/models/enums/account-type';
import { RegisteredPlan } from '../../core/models/enums/registered-plan';
import { StatementFormat } from '../../core/models/enums/statement-format';
import { AccountInputDto } from '../../core/models/inputs/account-input-dto';
import { AccountOutputDto } from '../../core/models/outputs/account-output-dto';
import { TEXT_LIMITS } from '../../core/models/text-limits';
import {
  ACCOUNT_TYPE_LABELS,
  PLAN_LABELS,
  STATEMENT_FORMAT_LABELS,
  holdsSavings,
} from '../../shared/utils/account-labels';

const NOT_BLANK = Validators.pattern(/\S/);

/**
 * Adds an account, or edits one: the type is chosen once and can't change; the statement format can. A savings or
 * investment account can be held in a registered plan (TFSA, RRSP, FHSA), with the year's contribution room.
 */
@Component({
  selector: 'app-bank-account-form',
  imports: [ReactiveFormsModule],
  templateUrl: './bank-account-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BankAccountFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly account = input<AccountOutputDto | null>(null);
  readonly saving = input(false);
  readonly submitAccount = output<AccountInputDto>();
  readonly cancelled = output<void>();

  readonly isEditing = computed(() => this.account() !== null);
  readonly types = Object.values(AccountType);
  readonly typeLabels = ACCOUNT_TYPE_LABELS;
  readonly formats = Object.values(StatementFormat);
  readonly formatLabels = STATEMENT_FORMAT_LABELS;
  readonly maxName = TEXT_LIMITS.accountName;
  readonly plans = Object.values(RegisteredPlan);
  readonly planLabels = PLAN_LABELS;
  readonly thisYear = new Date().getFullYear();

  readonly form = this.fb.group({
    name: ['', [Validators.required, NOT_BLANK, Validators.maxLength(this.maxName)]],
    type: [AccountType.Chequing, Validators.required],
    format: [StatementFormat.Cibc, Validators.required],
    plan: [RegisteredPlan.None],
    // Empty: left as it is (a new account has none).
    contributionRoom: this.fb.control<number | null>(null, [Validators.min(0)]),
    contributionRoomYear: [this.thisYear, [Validators.min(2009), Validators.max(this.thisYear)]],
  });

  private readonly type = toSignal(this.form.controls.type.valueChanges, {
    initialValue: this.form.controls.type.value,
  });
  private readonly plan = toSignal(this.form.controls.plan.valueChanges, {
    initialValue: this.form.controls.plan.value,
  });
  /** Only savings and investments go in a registered plan. */
  readonly canHavePlan = computed(() => holdsSavings(this.type()));
  readonly hasPlan = computed(() => this.canHavePlan() && this.plan() !== RegisteredPlan.None);

  ngOnInit(): void {
    const account = this.account();
    if (account) {
      this.form.patchValue({
        name: account.name,
        type: account.type,
        format: account.format,
        plan: account.plan ?? RegisteredPlan.None,
        contributionRoom: account.contributionRoom ?? null,
        contributionRoomYear: account.contributionRoomYear ?? this.thisYear,
      });
      // The patch above already told the type signal; disabled, it never changes again.
      this.form.controls.type.disable();
    }
  }

  onSubmit(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, type, format, plan, contributionRoom, contributionRoomYear } =
      this.form.getRawValue();
    const holds = holdsSavings(type);
    this.submitAccount.emit({
      name: name.trim(),
      type,
      format,
      ...(holds ? { plan } : {}),
      ...(holds && plan !== RegisteredPlan.None && contributionRoom !== null
        ? { contributionRoom, contributionRoomYear }
        : {}),
    });
  }
}
