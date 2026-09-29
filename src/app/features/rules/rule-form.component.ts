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
import { CategoryRuleInputDto } from '../../core/models/inputs/category-rule-input-dto';
import { CategoryRuleOutputDto } from '../../core/models/outputs/category-rule-output-dto';
import { CategoryReference } from '../../core/models/outputs/category-output-dto';
import { TEXT_LIMITS } from '../../core/models/text-limits';

const NOT_BLANK = Validators.pattern(/\S/);

type Placement = 'first' | 'last';

/** Adds or edits a category rule. A new rule goes first (so it wins over broader ones) or last. */
@Component({
  selector: 'app-rule-form',
  imports: [ReactiveFormsModule],
  templateUrl: './rule-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RuleFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly rule = input<CategoryRuleOutputDto | null>(null);
  readonly saving = input(false);
  readonly submitRule = output<CategoryRuleInputDto>();
  readonly cancelled = output<void>();

  readonly isEditing = computed(() => this.rule() !== null);
  /** To pick from; the page loads them. */
  readonly categories = input<CategoryReference[]>([]);
  /** The list, and an edited rule's own category while the list is loading. */
  readonly categoryOptions = computed(() => {
    const current = this.rule()?.category;
    const categories = this.categories();
    return !current || categories.some((c) => c.id === current.id)
      ? categories
      : [current, ...categories];
  });
  readonly maxKeyword = TEXT_LIMITS.categoryRuleKeyword;

  readonly form = this.fb.group({
    keyword: ['', [Validators.required, NOT_BLANK, Validators.maxLength(this.maxKeyword)]],
    categoryId: ['', Validators.required],
    placement: ['first' as Placement],
  });

  ngOnInit(): void {
    const rule = this.rule();
    if (rule) {
      this.form.patchValue({ keyword: rule.keyword, categoryId: rule.category.id });
    }
  }

  onSubmit(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { keyword, categoryId, placement } = this.form.getRawValue();
    this.submitRule.emit({
      keyword: keyword.trim(),
      categoryId,
      // Omitted: appended at the end by the API.
      ...(!this.isEditing() && placement === 'first' ? { position: 0 } : {}),
    });
  }
}
