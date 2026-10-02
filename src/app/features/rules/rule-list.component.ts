import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CategoryRuleRepository } from '../../core/api/category-rule-repository';
import { CategoryRepository } from '../../core/api/category-repository';
import { TransactionRepository } from '../../core/api/transaction-repository';
import { CategoryRuleInputDto } from '../../core/models/inputs/category-rule-input-dto';
import { CategoryRuleOutputDto } from '../../core/models/outputs/category-rule-output-dto';
import {
  APPLY_RULES_CONFIRMATION,
  describeRulesResult,
} from '../../shared/utils/category-rules-messages';
import { conflictDetail } from '../../shared/utils/problem-detail';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { RuleFormComponent } from './rule-form.component';
import { FlowRuleListComponent } from './flow-rule-list.component';
import { valueOf } from '../../shared/utils/resource-value';

type RulesTab = 'categories' | 'flows';

/**
 * The rules page: a tab for the category rules, in the order they are checked (add, edit, reorder, delete), a tab
 * for the flow rules, and applying both to the stored transactions.
 */
@Component({
  selector: 'app-rule-list',
  imports: [
    ReactiveFormsModule,
    RuleFormComponent,
    FlowRuleListComponent,
    ConfirmDialogComponent,
    ErrorStateComponent,
    IconComponent,
    ModalComponent,
    SkeletonComponent,
  ],
  templateUrl: './rule-list.component.html',
  styleUrl: './rule-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RuleListComponent {
  private readonly ruleRepository = inject(CategoryRuleRepository);
  private readonly categoryRepository = inject(CategoryRepository);
  private readonly transactionRepository = inject(TransactionRepository);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly tabs: { id: RulesTab; label: string }[] = [
    { id: 'categories', label: 'Categories' },
    { id: 'flows', label: 'Money in and transfers' },
  ];
  /** In the URL (?tab=flows), so a reload or a link opens the same tab. */
  readonly activeTab = toSignal(
    this.route.queryParamMap.pipe(
      map((params): RulesTab => (params.get('tab') === 'flows' ? 'flows' : 'categories')),
    ),
    { initialValue: 'categories' as RulesTab },
  );

  readonly rules = rxResource({ stream: () => this.ruleRepository.getAll() });
  // For the rule form.
  private readonly categoriesResource = rxResource({
    stream: () => this.categoryRepository.getAll(),
  });
  readonly categories = computed(() => valueOf(this.categoriesResource) ?? []);

  readonly search = new FormControl('', { nonNullable: true });
  private readonly searchText = toSignal(this.search.valueChanges, { initialValue: '' });
  readonly query = computed(() => this.searchText().trim().toUpperCase());

  /** A few hundred rules at most, so the search is instant and needs no request. */
  readonly visibleRules = computed(() => {
    const rules = valueOf(this.rules) ?? [];
    const query = this.query();
    if (!query) return rules;
    return rules.filter(
      (rule) => rule.keyword.includes(query) || rule.category.name.toUpperCase().includes(query),
    );
  });
  readonly total = computed(() => valueOf(this.rules)?.length ?? 0);

  /** undefined: panel closed; null: adding; a rule: editing it. */
  readonly editing = signal<CategoryRuleOutputDto | null | undefined>(undefined);
  readonly deleting = signal<CategoryRuleOutputDto | null>(null);
  readonly saving = signal(false);
  /** A move is on its way: positions are about to change, so the move buttons wait for it. */
  readonly moving = signal(false);
  readonly confirmingApply = signal(false);
  readonly applying = signal(false);

  protected readonly applyRulesConfirmation = APPLY_RULES_CONFIRMATION;

  selectTab(tab: RulesTab): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'categories' ? null : tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Arrow keys, Home and End move between the tabs (and open them), as in the ARIA tabs pattern. */
  onTabKeydown(event: KeyboardEvent): void {
    const index = this.tabs.findIndex((tab) => tab.id === this.activeTab());
    const last = this.tabs.length - 1;
    const next = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const tab = this.tabs[next].id;
    this.selectTab(tab);
    document.getElementById(`rules-tab-${tab}`)?.focus();
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

  /**
   * Where a rule moves to: the place of the rule shown above it (-1, checked earlier) or below it (+1), so a move
   * while searching passes the rule you can see rather than one the search hides. Null at either end of the list.
   */
  movePosition(rule: CategoryRuleOutputDto, offset: -1 | 1): number | null {
    const visible = this.visibleRules();
    const neighbour = visible[visible.findIndex((r) => r.id === rule.id) + offset];
    return neighbour?.position ?? null;
  }

  move(rule: CategoryRuleOutputDto, offset: -1 | 1): void {
    const position = this.movePosition(rule, offset);
    if (this.moving() || position === null) return;
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
    this.transactionRepository.applyRules().subscribe({
      next: (result) => {
        this.applying.set(false);
        this.toasts.success(describeRulesResult(result));
      },
      error: () => {
        this.applying.set(false);
        this.toasts.error('Could not apply the rules.');
      },
    });
  }
}
