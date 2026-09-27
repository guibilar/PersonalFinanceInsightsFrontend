import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CategoryRuleRepository } from '../../core/api/category-rule-repository';
import { TransactionRepository } from '../../core/api/transaction-repository';
import { CategoryRuleInputDto } from '../../core/models/inputs/category-rule-input-dto';
import { CategoryRuleOutputDto } from '../../core/models/outputs/category-rule-output-dto';
import { CategoryColorHelper } from '../../shared/utils/category-color-helper';
import {
  APPLY_RULES_CONFIRMATION,
  describeRulesResult,
} from '../../shared/utils/category-rules-messages';
import { conflictDetail } from '../../shared/utils/problem-detail';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { SidePanelComponent } from '../../shared/ui/side-panel/side-panel.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { RuleFormComponent } from './rule-form.component';

/** The category rules, in the order they are checked: add, edit, reorder, delete, and apply them. */
@Component({
  selector: 'app-rule-list',
  imports: [
    ReactiveFormsModule,
    RuleFormComponent,
    ConfirmDialogComponent,
    ErrorStateComponent,
    IconComponent,
    SidePanelComponent,
    SkeletonComponent,
  ],
  templateUrl: './rule-list.component.html',
  styleUrl: './rule-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RuleListComponent {
  private readonly ruleRepository = inject(CategoryRuleRepository);
  private readonly transactionRepository = inject(TransactionRepository);
  private readonly toasts = inject(ToastService);

  readonly rules = rxResource({ stream: () => this.ruleRepository.getAll() });

  readonly search = new FormControl('', { nonNullable: true });
  private readonly searchText = toSignal(this.search.valueChanges, { initialValue: '' });
  readonly query = computed(() => this.searchText().trim().toUpperCase());

  /** A few hundred rules at most, so the search is instant and needs no request. */
  readonly visibleRules = computed(() => {
    const rules = this.rules.value() ?? [];
    const query = this.query();
    if (!query) return rules;
    return rules.filter(
      (rule) => rule.keyword.includes(query) || rule.category.toUpperCase().includes(query),
    );
  });
  readonly total = computed(() => this.rules.value()?.length ?? 0);

  /** undefined: panel closed; null: adding; a rule: editing it. */
  readonly editing = signal<CategoryRuleOutputDto | null | undefined>(undefined);
  readonly deleting = signal<CategoryRuleOutputDto | null>(null);
  readonly saving = signal(false);
  /** A move is on its way: positions are about to change, so the move buttons wait for it. */
  readonly moving = signal(false);
  readonly confirmingApply = signal(false);
  readonly applying = signal(false);

  protected readonly applyRulesConfirmation = APPLY_RULES_CONFIRMATION;

  categoryColor(category: string): string {
    return CategoryColorHelper.getColor(category);
  }

  clearSearch(): void {
    this.search.setValue('');
  }

  onFormSubmit(input: CategoryRuleInputDto): void {
    if (this.saving()) return;
    const editing = this.editing();
    const request = editing
      ? this.ruleRepository.update(editing.id, input)
      : this.ruleRepository.create(input);

    this.saving.set(true);
    request.subscribe({
      next: (rule) => {
        this.saving.set(false);
        this.editing.set(undefined);
        this.rules.reload();
        this.toasts.success(editing ? `Saved “${rule.keyword}”` : `Added “${rule.keyword}”`);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.toasts.error(
          conflictDetail(error, editing ? 'Could not save the rule.' : 'Could not add the rule.'),
        );
      },
    });
  }

  /** Up is -1 (checked earlier), down is +1. */
  move(rule: CategoryRuleOutputDto, offset: -1 | 1): void {
    const position = rule.position + offset;
    if (this.moving() || position < 0 || position >= this.total()) return;
    this.moving.set(true);
    this.ruleRepository.move(rule.id, position).subscribe({
      next: (rules) => {
        this.moving.set(false);
        this.rules.set(rules);
      },
      error: () => {
        this.moving.set(false);
        this.rules.reload();
        this.toasts.error(`Could not move “${rule.keyword}”.`);
      },
    });
  }

  confirmDelete(): void {
    const rule = this.deleting();
    if (!rule) return;
    this.deleting.set(null);
    this.ruleRepository.delete(rule.id).subscribe({
      next: () => {
        this.rules.reload();
        this.toasts.success(`Deleted “${rule.keyword}”`);
      },
      error: () => this.toasts.error(`Could not delete “${rule.keyword}”.`),
    });
  }

  applyRules(): void {
    this.confirmingApply.set(false);
    this.applying.set(true);
    this.transactionRepository.applyCategoryRules().subscribe({
      next: (result) => {
        this.applying.set(false);
        this.toasts.success(describeRulesResult(result));
      },
      error: () => {
        this.applying.set(false);
        this.toasts.error('Could not apply the category rules.');
      },
    });
  }
}
