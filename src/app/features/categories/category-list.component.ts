import { AuthService } from '../../core/auth/auth.service';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CategoryRepository } from '../../core/api/category-repository';
import { CategoryInputDto } from '../../core/models/inputs/category-input-dto';
import { CategoryOutputDto } from '../../core/models/outputs/category-output-dto';
import { conflictDetail } from '../../shared/utils/problem-detail';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { CategoryFormComponent } from './category-form.component';
import { CategoryDeleteFormComponent } from './category-delete-form.component';
import { valueOf } from '../../shared/utils/resource-value';

/** The categories spending is grouped by: add, rename, recolour, and delete (moving what used it elsewhere). */
@Component({
  selector: 'app-category-list',
  imports: [
    CategoryDeleteFormComponent,
    CategoryFormComponent,
    ErrorStateComponent,
    IconComponent,
    ModalComponent,
    SkeletonComponent,
  ],
  templateUrl: './category-list.component.html',
  styleUrl: './category-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryListComponent {
  /** A read-only user (T60, T75) sees the list without add, edit, delete, or apply actions. */
  protected readonly canWrite = inject(AuthService).canWrite;
  private readonly categoryRepository = inject(CategoryRepository);
  private readonly toasts = inject(ToastService);

  readonly categories = rxResource({ stream: () => this.categoryRepository.getAll() });
  readonly list = computed(() => valueOf(this.categories) ?? []);

  /** undefined: dialog closed; null: adding; a category: editing it. */
  readonly editing = signal<CategoryOutputDto | null | undefined>(undefined);
  readonly deleting = signal<CategoryOutputDto | null>(null);
  readonly saving = signal(false);
  readonly removing = signal(false);

  usage(category: CategoryOutputDto): string {
    const { transactionCount: transactions, ruleCount: rules } = category;
    return (
      `${transactions} ${transactions === 1 ? 'transaction' : 'transactions'} · ` +
      `${rules} ${rules === 1 ? 'rule' : 'rules'}`
    );
  }

  onFormSubmit(input: CategoryInputDto): void {
    if (this.saving()) return;
    const editing = this.editing();
    const request = editing
      ? this.categoryRepository.update(editing.id, input)
      : this.categoryRepository.create(input);

    this.saving.set(true);
    request.subscribe({
      next: (category) => {
        this.saving.set(false);
        this.editing.set(undefined);
        this.categories.reload();
        this.toasts.success(editing ? `Saved “${category.name}”` : `Added “${category.name}”`);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.toasts.error(
          conflictDetail(
            error,
            editing ? 'Could not save the category.' : 'Could not add the category.',
          ),
        );
      },
    });
  }

  confirmDelete(moveTo: string): void {
    const category = this.deleting();
    if (!category || this.removing()) return;
    const target = this.list().find((c) => c.id === moveTo);
    const moved = category.transactionCount + category.ruleCount > 0;

    this.removing.set(true);
    this.categoryRepository.delete(category.id, moveTo).subscribe({
      next: () => {
        this.removing.set(false);
        this.deleting.set(null);
        this.categories.reload();
        this.toasts.success(
          `Deleted “${category.name}”` +
            (moved && target ? `; what used it is now in “${target.name}”` : ''),
        );
      },
      error: (error: unknown) => {
        this.removing.set(false);
        this.deleting.set(null);
        this.categories.reload();
        this.toasts.error(conflictDetail(error, `Could not delete “${category.name}”.`));
      },
    });
  }
}
