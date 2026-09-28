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
import { Category } from '../../core/models/enums/category';
import { CategoryRuleInputDto } from '../../core/models/inputs/category-rule-input-dto';
import { CategoryRuleOutputDto } from '../../core/models/outputs/category-rule-output-dto';
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
  readonly categories = Object.values(Category);
  readonly maxKeyword = TEXT_LIMITS.categoryRuleKeyword;

  readonly form = this.fb.group({
    keyword: ['', [Validators.required, NOT_BLANK, Validators.maxLength(this.maxKeyword)]],
    category: [Category.Groceries, Validators.required],
    placement: ['first' as Placement],
  });

  ngOnInit(): void {
    const rule = this.rule();
    if (rule) {
      this.form.patchValue({ keyword: rule.keyword, category: rule.category });
    }
  }

  onSubmit(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { keyword, category, placement } = this.form.getRawValue();
    this.submitRule.emit({
      keyword: keyword.trim(),
      category,
      // Omitted: appended at the end by the API.
      ...(!this.isEditing() && placement === 'first' ? { position: 0 } : {}),
    });
  }
}
