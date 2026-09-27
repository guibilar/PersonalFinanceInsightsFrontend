import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Category } from '../../../core/models/enums/category';
import { TransactionUpdateInputDto } from '../../../core/models/inputs/transaction-update-input-dto';
import { TransactionOutputDto } from '../../../core/models/outputs/transaction-output-dto';

const NOT_BLANK = Validators.pattern(/\S/);

/** Corrects an imported transaction's description and category. Date, amount and account come from the bank. */
@Component({
  selector: 'app-transaction-edit-form',
  imports: [ReactiveFormsModule, CurrencyPipe, DatePipe],
  templateUrl: './transaction-edit-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionEditForm implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly transaction = input.required<TransactionOutputDto>();
  readonly saving = input(false);
  readonly submitUpdate = output<TransactionUpdateInputDto>();
  readonly cancelled = output<void>();
  /** The parent asks for confirmation, then deletes. */
  readonly deleteRequested = output<void>();

  readonly categories = Object.values(Category);

  readonly form = this.fb.group({
    description: ['', [Validators.required, NOT_BLANK]],
    category: [Category.Other, Validators.required],
  });

  ngOnInit(): void {
    const { description, category } = this.transaction();
    this.form.setValue({ description, category });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { description, category } = this.form.getRawValue();
    this.submitUpdate.emit({ description: description.trim(), category });
  }
}
