import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccountType } from '../../core/models/enums/account-type';
import { StatementFormat } from '../../core/models/enums/statement-format';
import { AccountInputDto } from '../../core/models/inputs/account-input-dto';
import { AccountOutputDto } from '../../core/models/outputs/account-output-dto';
import { TEXT_LIMITS } from '../../core/models/text-limits';
import { ACCOUNT_TYPE_LABELS, STATEMENT_FORMAT_LABELS } from '../../shared/utils/account-labels';

const NOT_BLANK = Validators.pattern(/\S/);

/** Adds a bank account, or edits one: the type is chosen once and can't change; the statement format can. */
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

  readonly form = this.fb.group({
    name: ['', [Validators.required, NOT_BLANK, Validators.maxLength(this.maxName)]],
    type: [AccountType.Chequing, Validators.required],
    format: [StatementFormat.Cibc, Validators.required],
  });

  ngOnInit(): void {
    const account = this.account();
    if (account) {
      this.form.patchValue({ name: account.name, type: account.type, format: account.format });
      this.form.controls.type.disable();
    }
  }

  onSubmit(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, type, format } = this.form.getRawValue();
    this.submitAccount.emit({ name: name.trim(), type, format });
  }
}
