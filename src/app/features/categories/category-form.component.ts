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
import { CategoryInputDto } from '../../core/models/inputs/category-input-dto';
import { CategoryOutputDto } from '../../core/models/outputs/category-output-dto';
import { TEXT_LIMITS } from '../../core/models/text-limits';

const NOT_BLANK = Validators.pattern(/\S/);

/**
 * Colours to pick from: the ones the first categories had, then lighter shades of them. A new category starts on the
 * first one no category has yet.
 */
export const CATEGORY_PALETTE = [
  '#1F76B5',
  '#FF7E0F',
  '#2CA12D',
  '#D72628',
  '#9466BC',
  '#8C564B',
  '#E277C3',
  '#7F7E7E',
  '#BDBD23',
  '#16BFCF',
  '#800080',
  '#AEC7E8',
  '#FFBB78',
  '#98DF8A',
  '#FF9896',
  '#C5B0D5',
  '#C49C94',
  '#F7B6D2',
  '#DBDB8D',
  '#9EDAE5',
];

/** Adds a category, or renames and recolours one. */
@Component({
  selector: 'app-category-form',
  imports: [ReactiveFormsModule],
  templateUrl: './category-form.component.html',
  styles: `
    .swatch {
      width: 1.75rem;
      height: 1.75rem;
      padding: 0;
      border-radius: 50%;
      border: 2px solid var(--bs-body-bg);
      box-shadow: 0 0 0 1px var(--bs-border-color);

      &[aria-pressed='true'] {
        box-shadow: 0 0 0 2px var(--bs-emphasis-color);
      }
    }
    .form-control-color {
      width: 3rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly category = input<CategoryOutputDto | null>(null);
  /** The existing ones, so a new category starts on a colour none of them has. */
  readonly categories = input<CategoryOutputDto[]>([]);
  readonly saving = input(false);
  readonly submitCategory = output<CategoryInputDto>();
  readonly cancelled = output<void>();

  readonly isEditing = computed(() => this.category() !== null);
  readonly palette = CATEGORY_PALETTE;
  readonly maxName = TEXT_LIMITS.categoryName;

  readonly form = this.fb.group({
    name: ['', [Validators.required, NOT_BLANK, Validators.maxLength(this.maxName)]],
    color: [CATEGORY_PALETTE[0], [Validators.required, Validators.pattern(/^#[0-9a-fA-F]{6}$/)]],
  });

  private readonly colorValue = toSignal(this.form.controls.color.valueChanges, {
    initialValue: this.form.controls.color.value,
  });
  private readonly nameValue = toSignal(this.form.controls.name.valueChanges, {
    initialValue: '',
  });
  /** How it will look in lists. */
  readonly preview = computed(() => ({
    name: this.nameValue().trim() || 'New category',
    color: this.colorValue(),
  }));

  ngOnInit(): void {
    const category = this.category();
    if (category) {
      this.form.setValue({ name: category.name, color: category.color });
      return;
    }
    const used = new Set(this.categories().map((c) => c.color.toUpperCase()));
    this.form.controls.color.setValue(
      CATEGORY_PALETTE.find((color) => !used.has(color)) ?? CATEGORY_PALETTE[0],
    );
  }

  isPicked(color: string): boolean {
    return this.colorValue().toUpperCase() === color;
  }

  pick(color: string): void {
    this.form.controls.color.setValue(color);
  }

  onSubmit(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, color } = this.form.getRawValue();
    this.submitCategory.emit({ name: name.trim(), color: color.toUpperCase() });
  }
}
