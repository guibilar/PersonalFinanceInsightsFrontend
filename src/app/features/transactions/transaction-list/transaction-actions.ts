import { Injectable, inject, signal } from '@angular/core';
import { Subject, switchMap, tap } from 'rxjs';
import { CategoryRuleRepository } from '../../../core/api/category-rule-repository';
import { TransactionRepository } from '../../../core/api/transaction-repository';
import { CategoryRuleInputDto } from '../../../core/models/inputs/category-rule-input-dto';
import { TransactionInputDto } from '../../../core/models/inputs/transaction-input-dto';
import { TransactionLinkingInputDto } from '../../../core/models/inputs/transaction-linking-input-dto';
import { BudgetOutputDto } from '../../../core/models/outputs/budget-output-dto';
import { TransactionOutputDto } from '../../../core/models/outputs/transaction-output-dto';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { describeRulesResult } from '../../../shared/utils/category-rules-messages';
import { conflictDetail, validationDetail } from '../../../shared/utils/problem-detail';
import { TransactionEditSubmission } from '../transaction-edit-form/transaction-edit-form';

/**
 * What the transactions page does to one transaction (add, edit, link, delete, restore, unlink) and to all of them
 * (apply the rules), with the dialogs' state. Provided by the page; [changed] tells it to reload after each change.
 */
@Injectable()
export class TransactionActions {
  private readonly transactionRepository = inject(TransactionRepository);
  private readonly categoryRuleRepository = inject(CategoryRuleRepository);
  private readonly toasts = inject(ToastService);

  /** After a change to the transactions. */
  readonly changed = new Subject<void>();

  readonly linkingTransaction = signal<TransactionOutputDto | null>(null);
  readonly savingLink = signal(false);
  readonly showAdd = signal(false);
  readonly savingAdd = signal(false);
  /** What the last transaction added by hand used, so the next one starts on the same day and account. */
  readonly lastAdded = signal<{ date: string; accountId: string } | null>(null);
  /** The API's reason when the transaction being added already exists; the form then offers to add it anyway. */
  readonly addDuplicate = signal<string | null>(null);
  readonly editingTransaction = signal<TransactionOutputDto | null>(null);
  readonly savingEdit = signal(false);
  readonly confirmingRules = signal(false);
  readonly applyingRules = signal(false);
  /** Asked to delete; the confirm dialog is showing. */
  readonly deletingTransaction = signal<TransactionOutputDto | null>(null);
  readonly removing = signal(false);

  openAdd(): void {
    this.addDuplicate.set(null);
    this.showAdd.set(true);
  }

  onAddSubmit(input: TransactionInputDto): void {
    if (this.savingAdd()) return;
    this.savingAdd.set(true);
    this.addDuplicate.set(null);
    this.transactionRepository.add(input).subscribe({
      next: (added) => {
        this.savingAdd.set(false);
        this.showAdd.set(false);
        this.lastAdded.set({ date: input.date, accountId: input.accountId });
        this.changed.next();
        this.toasts.success(`Added “${added.description}” to ${added.accountName}`);
      },
      error: (error: unknown) => {
        this.savingAdd.set(false);
        const detail = conflictDetail(error, '');
        if (detail) {
          this.addDuplicate.set(detail);
        } else {
          this.toasts.error(validationDetail(error, 'Could not add the transaction.'));
        }
      },
    });
  }

  /** [budgets] name the budget in the message. */
  onLinkSubmit(linking: TransactionLinkingInputDto, budgets: BudgetOutputDto[] = []): void {
    if (this.savingLink()) return;
    this.savingLink.set(true);
    this.transactionRepository.linkTransaction(linking).subscribe({
      next: () => {
        this.savingLink.set(false);
        const budget = budgets.find((b) => b.id === linking.budgetId);
        // Closed and another opened while this one saved: that one stays.
        if (this.linkingTransaction()?.id === linking.transactionId)
          this.linkingTransaction.set(null);
        this.changed.next();
        this.toasts.success(budget ? `Linked to “${budget.name}”` : 'Transaction linked');
      },
      error: (error: unknown) => {
        this.savingLink.set(false);
        // A 409 says why: the budget was deactivated meanwhile, or the transaction linked elsewhere.
        this.toasts.error(conflictDetail(error, 'Could not link the transaction.'));
      },
    });
  }

  onEditSubmit({ update, rule }: TransactionEditSubmission): void {
    const transaction = this.editingTransaction();
    if (!transaction || this.savingEdit()) return;
    this.savingEdit.set(true);
    this.transactionRepository.update(transaction.id, update).subscribe({
      next: () => {
        if (rule) {
          this.addRuleAndApply(rule, transaction.id);
        } else {
          this.finishEdit(transaction.id);
          this.toasts.success('Transaction updated');
        }
      },
      error: (error: unknown) => {
        this.savingEdit.set(false);
        // The API's reason when it refused the change (a category deleted meanwhile, say), as on Android.
        this.toasts.error(validationDetail(error, 'Could not update the transaction.'));
      },
    });
  }

  /** After the edit is saved: the rule goes first, then the rules are applied, with one toast for it all. */
  private addRuleAndApply(rule: CategoryRuleInputDto, transactionId: string): void {
    let added = false;
    this.categoryRuleRepository
      .create(rule)
      .pipe(
        tap(() => (added = true)),
        switchMap(() => this.transactionRepository.applyRules()),
      )
      .subscribe({
        next: ({ updated }) => {
          this.finishEdit(transactionId);
          const others = `${updated} other ${updated === 1 ? 'transaction' : 'transactions'}`;
          this.toasts.success(
            `Transaction updated. Rule “${rule.keyword}” added and ${others} updated`,
          );
        },
        error: (error: unknown) => {
          // The transaction itself is saved either way.
          this.finishEdit(transactionId);
          this.toasts.error(
            added
              ? `Transaction updated and rule “${rule.keyword}” added, but the rules could not be applied.`
              : `Transaction updated, but the rule could not be added: ${conflictDetail(error, 'please try again.')}`,
          );
        },
      });
  }

  /** Closes the edit of [transactionId]: one opened since (the first closed while it saved) stays open. */
  private finishEdit(transactionId: string): void {
    this.savingEdit.set(false);
    if (this.editingTransaction()?.id === transactionId) this.editingTransaction.set(null);
    this.changed.next();
  }

  applyRules(): void {
    this.confirmingRules.set(false);
    this.applyingRules.set(true);
    this.transactionRepository.applyRules().subscribe({
      next: (result) => {
        this.applyingRules.set(false);
        this.changed.next();
        this.toasts.success(describeRulesResult(result));
      },
      error: () => {
        this.applyingRules.set(false);
        this.toasts.error('Could not apply the rules.');
      },
    });
  }

  confirmDelete(): void {
    const transaction = this.deletingTransaction();
    if (!transaction || this.removing()) return;
    this.removing.set(true);
    this.transactionRepository.remove(transaction.id).subscribe({
      next: () => {
        this.removing.set(false);
        this.deletingTransaction.set(null);
        this.editingTransaction.set(null);
        this.changed.next();
        this.toasts.success(`Deleted “${transaction.description}”`);
      },
      error: () => {
        this.removing.set(false);
        this.deletingTransaction.set(null);
        this.toasts.error('Could not delete the transaction.');
      },
    });
  }

  restore(transaction: TransactionOutputDto): void {
    this.transactionRepository.restore(transaction.id).subscribe({
      next: () => {
        this.changed.next();
        this.toasts.success(`Restored “${transaction.description}”`);
      },
      error: () => this.toasts.error('Could not restore the transaction.'),
    });
  }

  onUnlink(id: string): void {
    this.transactionRepository.unlinkTransaction(id).subscribe({
      next: () => {
        this.changed.next();
        this.toasts.success('Transaction unlinked');
      },
      error: () => this.toasts.error('Could not unlink the transaction.'),
    });
  }
}
