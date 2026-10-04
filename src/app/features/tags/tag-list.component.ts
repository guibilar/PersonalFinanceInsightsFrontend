import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TagRepository } from '../../core/api/tag-repository';
import { TagOutputDto } from '../../core/models/outputs/tag-output-dto';
import { TEXT_LIMITS } from '../../core/models/text-limits';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { conflictDetail, validationDetail } from '../../shared/utils/problem-detail';
import { valueOf } from '../../shared/utils/resource-value';

const NOT_BLANK = Validators.pattern(/\S/);

/** Free labels across categories ("Vacation 2026", "Tax deductible"): add, rename, delete, and list what has one. */
@Component({
  selector: 'app-tag-list',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ConfirmDialogComponent,
    ErrorStateComponent,
    IconComponent,
    SkeletonComponent,
  ],
  templateUrl: './tag-list.component.html',
  styleUrl: './tag-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagListComponent {
  private readonly tagRepository = inject(TagRepository);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly tags = rxResource({ stream: () => this.tagRepository.getAll() });
  readonly list = computed(() => valueOf(this.tags) ?? []);
  readonly maxName = TEXT_LIMITS.tagName;

  /** The tag being renamed, in place. */
  readonly renaming = signal<TagOutputDto | null>(null);
  readonly deleting = signal<TagOutputDto | null>(null);
  readonly saving = signal(false);

  readonly addName = this.fb.control('', [
    Validators.required,
    NOT_BLANK,
    Validators.maxLength(TEXT_LIMITS.tagName),
  ]);
  readonly renameName = this.fb.control('', [
    Validators.required,
    NOT_BLANK,
    Validators.maxLength(TEXT_LIMITS.tagName),
  ]);

  usage(tag: TagOutputDto): string {
    const count = tag.transactionCount;
    return `${count} ${count === 1 ? 'transaction' : 'transactions'}`;
  }

  add(): void {
    if (this.addName.invalid || this.saving()) return;
    this.saving.set(true);
    this.tagRepository.create({ name: this.addName.value.trim() }).subscribe({
      next: (tag) => {
        this.saving.set(false);
        this.addName.reset();
        this.tags.reload();
        this.toasts.success(`Added “${tag.name}”`);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.toasts.error(conflictDetail(error, validationDetail(error, 'Could not add the tag.')));
      },
    });
  }

  startRename(tag: TagOutputDto): void {
    this.renameName.setValue(tag.name);
    this.renaming.set(tag);
  }

  rename(): void {
    const tag = this.renaming();
    if (!tag || this.renameName.invalid || this.saving()) return;
    const name = this.renameName.value.trim();
    if (name === tag.name) {
      this.renaming.set(null);
      return;
    }
    this.saving.set(true);
    this.tagRepository.rename(tag.id, { name }).subscribe({
      next: (renamed) => {
        this.saving.set(false);
        this.renaming.set(null);
        this.tags.reload();
        this.toasts.success(`Renamed to “${renamed.name}”`);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.toasts.error(
          conflictDetail(error, validationDetail(error, 'Could not rename the tag.')),
        );
      },
    });
  }

  confirmDelete(): void {
    const tag = this.deleting();
    if (!tag || this.saving()) return;
    this.saving.set(true);
    this.tagRepository.delete(tag.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.deleting.set(null);
        this.tags.reload();
        this.toasts.success(`Deleted “${tag.name}”`);
      },
      error: () => {
        this.saving.set(false);
        this.deleting.set(null);
        this.tags.reload();
        this.toasts.error(`Could not delete “${tag.name}”.`);
      },
    });
  }
}
