import { AuthService } from '../../core/auth/auth.service';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FlowRuleRepository } from '../../core/api/flow-rule-repository';
import { FlowRuleInputDto } from '../../core/models/inputs/flow-rule-input-dto';
import { FlowRuleOutputDto } from '../../core/models/outputs/flow-rule-output-dto';
import { FLOW_LABELS } from '../../shared/utils/flow-helper';
import { conflictDetail } from '../../shared/utils/problem-detail';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { FlowRuleFormComponent } from './flow-rule-form.component';

/**
 * The flow rules (income, refunds, transfers, ignored), by keyword: add, edit and delete them. The page's
 * "Apply to transactions" applies them together with the category rules.
 */
@Component({
  selector: 'app-flow-rule-list',
  imports: [
    FlowRuleFormComponent,
    ConfirmDialogComponent,
    ErrorStateComponent,
    IconComponent,
    ModalComponent,
    SkeletonComponent,
  ],
  templateUrl: './flow-rule-list.component.html',
  styleUrl: './rule-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlowRuleListComponent {
  /** A read-only user (T60, T75) sees the list without add, edit, delete, or apply actions. */
  protected readonly canWrite = inject(AuthService).canWrite;
  private readonly ruleRepository = inject(FlowRuleRepository);
  private readonly toasts = inject(ToastService);

  readonly rules = rxResource({ stream: () => this.ruleRepository.getAll() });

  /** undefined: panel closed; null: adding; a rule: editing it. */
  readonly editing = signal<FlowRuleOutputDto | null | undefined>(undefined);
  readonly deleting = signal<FlowRuleOutputDto | null>(null);
  readonly saving = signal(false);

  protected readonly flowLabels = FLOW_LABELS;

  onFormSubmit(input: FlowRuleInputDto): void {
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
}
