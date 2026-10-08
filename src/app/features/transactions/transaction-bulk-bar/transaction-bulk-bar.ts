import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Flow } from '../../../core/models/enums/flow';
import { TransactionBulkUpdateInputDto } from '../../../core/models/inputs/transaction-bulk-update-input-dto';
import { BudgetOutputDto } from '../../../core/models/outputs/budget-output-dto';
import { CategoryOutputDto } from '../../../core/models/outputs/category-output-dto';
import { TagOutputDto } from '../../../core/models/outputs/tag-output-dto';
import { FLOW_LABELS } from '../../../shared/utils/flow-helper';

/** One change to every ticked transaction. */
export type BulkChange = Omit<TransactionBulkUpdateInputDto, 'transactionIds'>;

/** Above the list while transactions are ticked: a category, a flow, a budget or a tag for all of them at once. */
@Component({
  selector: 'app-transaction-bulk-bar',
  templateUrl: './transaction-bulk-bar.html',
  styles: `
    :host {
      position: sticky;
      top: 0;
      z-index: 2;
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionBulkBar {
  readonly count = input.required<number>();
  readonly categories = input<CategoryOutputDto[]>([]);
  readonly budgets = input<BudgetOutputDto[]>([]);
  readonly tags = input<TagOutputDto[]>([]);
  /** True while the parent is saving: blocks another change. */
  readonly saving = input(false);
  readonly apply = output<BulkChange>();
  readonly cleared = output<void>();

  protected readonly flows = Object.values(Flow);
  protected readonly flowLabels = FLOW_LABELS;

  /** A menu's pick, then the menu back on its prompt: each pick is one change, not a setting. */
  protected pick(select: HTMLSelectElement, toChange: (value: string) => BulkChange | null): void {
    const change = select.value ? toChange(select.value) : null;
    select.value = '';
    if (change) this.apply.emit(change);
  }

  protected readonly toCategory = (id: string): BulkChange => ({ categoryId: id });
  protected readonly toFlow = (flow: string): BulkChange => ({ flow: flow as Flow });

  /** A budget's id, or "unlink". */
  protected readonly toBudget = (value: string): BulkChange =>
    value === 'unlink' ? { unlinkBudget: true } : { budgetId: value };

  /** "add:<id>" or "remove:<id>". */
  protected readonly toTag = (value: string): BulkChange | null => {
    const [action, id] = value.split(':');
    if (!id) return null;
    return action === 'remove' ? { removeTagId: id } : { addTagId: id };
  };
}
