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
import { CategoryOutputDto } from '../../core/models/outputs/category-output-dto';

/** Asks where a category's transactions and rules go before it is deleted: Other unless another is picked. */
@Component({
  selector: 'app-category-delete-form',
  imports: [ReactiveFormsModule],
  templateUrl: './category-delete-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryDeleteFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly category = input.required<CategoryOutputDto>();
  readonly categories = input<CategoryOutputDto[]>([]);
  readonly deleting = input(false);
  /** The category to move its transactions and rules to. */
  readonly confirmDelete = output<string>();
  readonly cancelled = output<void>();

  readonly targets = computed(() => this.categories().filter((c) => c.id !== this.category().id));
  readonly inUse = computed(() => {
    const { transactionCount, ruleCount } = this.category();
    return transactionCount + ruleCount > 0;
  });
  /** "Its 12 transactions and 3 rules move to", "Its 1 rule moves to": leaving out what it has none of. */
  readonly moveLabel = computed(() => {
    const { transactionCount, ruleCount } = this.category();
    const parts = [];
    if (transactionCount > 0) {
      parts.push(`${transactionCount} ${transactionCount === 1 ? 'transaction' : 'transactions'}`);
    }
    if (ruleCount > 0) parts.push(`${ruleCount} ${ruleCount === 1 ? 'rule' : 'rules'}`);
    const one = transactionCount + ruleCount === 1;
    return `Its ${parts.join(' and ')} ${one ? 'moves' : 'move'} to`;
  });

  readonly form = this.fb.group({ moveTo: ['', Validators.required] });

  ngOnInit(): void {
    const targets = this.targets();
    const fallback = targets.find((c) => c.isFallback) ?? targets[0];
    if (fallback) this.form.controls.moveTo.setValue(fallback.id);
  }

  onSubmit(): void {
    if (this.deleting() || this.form.invalid) return;
    this.confirmDelete.emit(this.form.controls.moveTo.value);
  }
}
