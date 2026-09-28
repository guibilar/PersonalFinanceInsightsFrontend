import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { CategoryRuleRepository } from '../../../core/api/category-rule-repository';
import { Category } from '../../../core/models/enums/category';
import { CategoryRuleInputDto } from '../../../core/models/inputs/category-rule-input-dto';
import { TransactionUpdateInputDto } from '../../../core/models/inputs/transaction-update-input-dto';
import { TransactionOutputDto } from '../../../core/models/outputs/transaction-output-dto';
import { TEXT_LIMITS } from '../../../core/models/text-limits';
import { suggestRuleKeyword } from '../../../shared/utils/suggest-rule-keyword';

const NOT_BLANK = Validators.pattern(/\S/);

export const RULE_PREVIEW_DEBOUNCE_MS = 300;

export interface TransactionEditSubmission {
  update: TransactionUpdateInputDto;
  /** Also categorise similar transactions: add this rule first, then apply the rules. */
  rule?: CategoryRuleInputDto;
}

/** Corrects an imported transaction's description and category. Date, amount and account come from the bank. */
@Component({
  selector: 'app-transaction-edit-form',
  imports: [ReactiveFormsModule, CurrencyPipe, DatePipe],
  templateUrl: './transaction-edit-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionEditForm implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly ruleRepository = inject(CategoryRuleRepository);
  private readonly destroyRef = inject(DestroyRef);

  readonly transaction = input.required<TransactionOutputDto>();
  readonly saving = input(false);
  readonly submitUpdate = output<TransactionEditSubmission>();
  readonly cancelled = output<void>();
  /** The parent asks for confirmation, then deletes. */
  readonly deleteRequested = output<void>();

  readonly categories = Object.values(Category);
  readonly maxDescription = TEXT_LIMITS.transactionDescription;
  readonly maxKeyword = TEXT_LIMITS.categoryRuleKeyword;

  readonly form = this.fb.group({
    description: [
      '',
      [Validators.required, NOT_BLANK, Validators.maxLength(TEXT_LIMITS.transactionDescription)],
    ],
    category: [Category.Other, Validators.required],
    alsoSimilar: [false],
    // Enabled only while alsoSimilar is checked, so it can't block saving otherwise.
    ruleKeyword: [
      { value: '', disabled: true },
      [Validators.required, NOT_BLANK, Validators.maxLength(TEXT_LIMITS.categoryRuleKeyword)],
    ],
  });

  private readonly category = toSignal(this.form.controls.category.valueChanges);
  readonly categoryChanged = computed(() => {
    const category = this.category();
    return category !== undefined && category !== this.transaction().category;
  });

  // Asks only after typing pauses, and not again for the same rule.
  private readonly previewRule = toSignal(
    this.form.valueChanges.pipe(
      map(() => this.pendingRule()),
      debounceTime(RULE_PREVIEW_DEBOUNCE_MS),
      distinctUntilChanged((a, b) => a?.keyword === b?.keyword && a?.category === b?.category),
    ),
  );

  readonly preview = rxResource({
    params: () => this.previewRule(),
    stream: ({ params }) =>
      this.ruleRepository.preview({ ...params, excludeTransactionId: this.transaction().id }),
  });

  ngOnInit(): void {
    const { description, category } = this.transaction();
    this.form.patchValue({ description, category, ruleKeyword: suggestRuleKeyword(description) });

    const { alsoSimilar, ruleKeyword } = this.form.controls;
    alsoSimilar.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((checked) => (checked ? ruleKeyword.enable() : ruleKeyword.disable()));
    // Going back to the original category leaves nothing to spread to similar transactions.
    this.form.controls.category.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (value === category) alsoSimilar.setValue(false);
      });
  }

  /** The rule to add, while the option is on and its keyword is valid. */
  private pendingRule(): CategoryRuleInputDto | undefined {
    const { alsoSimilar, ruleKeyword, category } = this.form.controls;
    if (!alsoSimilar.value || !this.categoryChanged() || ruleKeyword.invalid) return undefined;
    return { keyword: ruleKeyword.value.trim().toUpperCase(), category: category.value };
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { description, category } = this.form.getRawValue();
    const rule = this.pendingRule();
    this.submitUpdate.emit({
      update: { description: description.trim(), category },
      ...(rule ? { rule: { ...rule, position: 0 } } : {}),
    });
  }
}
