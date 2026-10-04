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
  signal,
} from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { CategoryRuleRepository } from '../../../core/api/category-rule-repository';
import { Flow } from '../../../core/models/enums/flow';
import { CategoryRuleInputDto } from '../../../core/models/inputs/category-rule-input-dto';
import { TransactionUpdateInputDto } from '../../../core/models/inputs/transaction-update-input-dto';
import { TransactionOutputDto } from '../../../core/models/outputs/transaction-output-dto';
import { CategoryReference } from '../../../core/models/outputs/category-output-dto';
import { TagReference } from '../../../core/models/outputs/tag-output-dto';
import { TEXT_LIMITS } from '../../../core/models/text-limits';
import { TagPickerComponent } from '../../../shared/ui/tag-picker/tag-picker.component';
import { suggestRuleKeyword } from '../../../shared/utils/suggest-rule-keyword';
import { FLOW_DESCRIPTIONS, FLOW_LABELS, flowsFor } from '../../../shared/utils/flow-helper';
import { valueOf } from '../../../shared/utils/resource-value';

const NOT_BLANK = Validators.pattern(/\S/);

export const RULE_PREVIEW_DEBOUNCE_MS = 300;

export interface TransactionEditSubmission {
  update: TransactionUpdateInputDto;
  /** Also categorise similar transactions: add this rule first, then apply the rules. */
  rule?: CategoryRuleInputDto;
}

/**
 * Corrects an imported transaction's description, category and flow, and gives it a note and tags. Date, amount
 * and account come from the bank.
 */
@Component({
  selector: 'app-transaction-edit-form',
  imports: [ReactiveFormsModule, CurrencyPipe, DatePipe, TagPickerComponent],
  templateUrl: './transaction-edit-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionEditForm implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly ruleRepository = inject(CategoryRuleRepository);
  private readonly destroyRef = inject(DestroyRef);

  readonly transaction = input.required<TransactionOutputDto>();
  /** To pick from; the page loads them. */
  readonly categories = input<CategoryReference[]>([]);
  /** To pick from; the page loads them. */
  readonly tags = input<TagReference[]>([]);
  readonly saving = input(false);
  readonly submitUpdate = output<TransactionEditSubmission>();
  readonly cancelled = output<void>();
  /** The parent asks for confirmation, then deletes. */
  readonly deleteRequested = output<void>();

  /** The list, and the transaction's own category while the list is loading. */
  readonly categoryOptions = computed(() => {
    const current = this.transaction().category;
    const categories = this.categories();
    return categories.some((c) => c.id === current.id) ? categories : [current, ...categories];
  });
  readonly flowLabels = FLOW_LABELS;
  readonly flowDescriptions = FLOW_DESCRIPTIONS;
  /** Only what fits the direction: money out can't be income, money in can't be spending. */
  readonly flows = computed(() => {
    const { transactionType, flow } = this.transaction();
    const allowed = flowsFor(transactionType);
    return allowed.includes(flow) ? allowed : [flow, ...allowed];
  });
  readonly maxDescription = TEXT_LIMITS.transactionDescription;
  readonly maxKeyword = TEXT_LIMITS.categoryRuleKeyword;
  readonly maxNote = TEXT_LIMITS.transactionNote;

  /** The list, and the transaction's own tags while the list is loading. */
  readonly tagOptions = computed(() => {
    const tags = this.tags();
    const ids = new Set(tags.map((t) => t.id));
    return [...tags, ...(this.transaction().tags ?? []).filter((t) => !ids.has(t.id))];
  });
  readonly tagIds = signal<string[]>([]);

  readonly form = this.fb.group({
    description: [
      '',
      [Validators.required, NOT_BLANK, Validators.maxLength(TEXT_LIMITS.transactionDescription)],
    ],
    categoryId: ['', Validators.required],
    flow: [Flow.Spending, Validators.required],
    note: ['', Validators.maxLength(TEXT_LIMITS.transactionNote)],
    alsoSimilar: [false],
    // Enabled only while alsoSimilar is checked, so it can't block saving otherwise.
    ruleKeyword: [
      { value: '', disabled: true },
      [Validators.required, NOT_BLANK, Validators.maxLength(TEXT_LIMITS.categoryRuleKeyword)],
    ],
  });

  private readonly categoryId = toSignal(this.form.controls.categoryId.valueChanges);
  readonly selectedFlow = toSignal(this.form.controls.flow.valueChanges);
  readonly categoryChanged = computed(() => {
    const categoryId = this.categoryId();
    return categoryId !== undefined && categoryId !== this.transaction().category.id;
  });
  readonly selectedCategoryName = computed(() => {
    const id = this.categoryId() ?? this.transaction().category.id;
    return this.categoryOptions().find((c) => c.id === id)?.name ?? '';
  });

  // Asks only after typing pauses, and not again for the same rule.
  private readonly previewRule = toSignal(
    this.form.valueChanges.pipe(
      map(() => this.pendingRule()),
      debounceTime(RULE_PREVIEW_DEBOUNCE_MS),
      distinctUntilChanged((a, b) => a?.keyword === b?.keyword && a?.categoryId === b?.categoryId),
    ),
  );

  readonly preview = rxResource({
    params: () => this.previewRule(),
    stream: ({ params }) =>
      this.ruleRepository.preview({ ...params, excludeTransactionId: this.transaction().id }),
  });

  /** The preview, or nothing while it loads or when it failed (reading a failed one would break the panel). */
  readonly previewValue = computed(() => valueOf(this.preview));

  ngOnInit(): void {
    const { description, category, flow, note, tags } = this.transaction();
    this.tagIds.set((tags ?? []).map((t) => t.id));
    this.form.patchValue({
      description,
      categoryId: category.id,
      flow,
      note: note ?? '',
      ruleKeyword: suggestRuleKeyword(description),
    });

    const { alsoSimilar, ruleKeyword } = this.form.controls;
    alsoSimilar.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((checked) => (checked ? ruleKeyword.enable() : ruleKeyword.disable()));
    // Going back to the original category leaves nothing to spread to similar transactions.
    this.form.controls.categoryId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (value === category.id) alsoSimilar.setValue(false);
      });
  }

  /** The rule to add, while the option is on and its keyword is valid. */
  private pendingRule(): CategoryRuleInputDto | undefined {
    const { alsoSimilar, ruleKeyword, categoryId } = this.form.controls;
    if (!alsoSimilar.value || !this.categoryChanged() || ruleKeyword.invalid) return undefined;
    return { keyword: ruleKeyword.value.trim().toUpperCase(), categoryId: categoryId.value };
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { description, categoryId, flow, note } = this.form.getRawValue();
    const rule = this.pendingRule();
    const before = this.transaction();
    const newNote = note.trim();
    const oldTags = new Set((before.tags ?? []).map((t) => t.id));
    const tagIds = this.tagIds();
    const tagsChanged = tagIds.length !== oldTags.size || tagIds.some((id) => !oldTags.has(id));
    this.submitUpdate.emit({
      update: {
        description: description.trim(),
        categoryId,
        // Sent only when changed: the API then keeps it when the rules are re-applied.
        ...(flow !== before.flow ? { flow } : {}),
        // Left out when unchanged; an empty note clears it.
        ...(newNote !== (before.note ?? '') ? { note: newNote } : {}),
        ...(tagsChanged ? { tagIds } : {}),
      },
      ...(rule ? { rule: { ...rule, position: 0 } } : {}),
    });
  }
}
