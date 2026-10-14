import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { DocumentRepository } from '../../../core/api/document-repository';
import { HomeRepository } from '../../../core/api/home-repository';
import { TaskRepository } from '../../../core/api/task-repository';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { HOME_ITEM_LINK, ItemSummaryDto } from '../../../core/models/outputs/home-output-dto';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { keptValueOf } from '../../../shared/utils/resource-value';
import { ItemPickerComponent } from '../item-picker/item-picker.component';
import { homeError } from '../home';

/** The kinds of page that show their Home items. */
export type LinkedItemsOwner = 'Documents.Document' | 'Tasks.Task';

/** A link of the page's own thing (a document or a task). */
export interface OwnerLink {
  id: string;
  kind: string;
  targetId: string;
}

/**
 * The "Home items" section of a document or a task: the items linked from either side
 * (`GET /api/home/items/by-link`), each opening its page. "Link to item" picks an item and links it from the
 * document or the task (`kind: Home.Item`). Unlink removes the link from the side that has it.
 */
@Component({
  selector: 'app-linked-items',
  imports: [
    RouterLink,
    MoneyPipe,
    ConfirmDialogComponent,
    ErrorStateComponent,
    IconComponent,
    ItemPickerComponent,
    SkeletonComponent,
  ],
  template: `
    <section class="card" aria-labelledby="linked-items-heading">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
          <h2 id="linked-items-heading" class="h6 mb-0">Home items</h2>
          @if (canWrite()) {
            <button
              type="button"
              class="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
              [disabled]="busy()"
              (click)="picking.set(true)"
            >
              <app-icon name="house" [size]="14" /> Link to item
            </button>
          }
        </div>
        @if (items.error()) {
          <app-error-state message="Could not load the items." (retry)="items.reload()" />
        } @else if (!list()) {
          <app-skeleton [lines]="1" height="2.25rem" />
        } @else if (list()!.length === 0) {
          <p class="text-body-secondary small mb-0" data-testid="no-items">
            {{ emptyText() }}
          </p>
        } @else {
          <ul class="list-group" data-testid="linked-items">
            @for (item of list(); track item.id) {
              <li class="list-group-item d-flex align-items-center gap-2">
                <app-icon name="house" [size]="16" class="text-body-secondary" />
                <a class="flex-grow-1 min-w-0 link-target" [routerLink]="['/home/items', item.id]">
                  <span class="d-block text-truncate fw-medium">{{ item.name }}</span>
                  <span class="d-block small text-body-secondary">{{
                    item.roomName ?? 'No room'
                  }}</span>
                </a>
                <span class="text-nowrap fw-medium">{{ item.value | money }}</span>
                @if (canWrite()) {
                  <button
                    type="button"
                    class="btn btn-icon btn-icon-danger"
                    title="Unlink"
                    [attr.aria-label]="'Unlink ' + item.name"
                    [disabled]="busy()"
                    (click)="unlinking.set(item)"
                  >
                    <app-icon name="close" [size]="16" />
                  </button>
                }
              </li>
            }
          </ul>
        }
      </div>
    </section>

    @if (picking()) {
      <app-item-picker
        [linkedIds]="linkedIds()"
        [busy]="busy()"
        (picked)="link($event)"
        (closed)="picking.set(false)"
      />
    }

    @if (unlinking(); as item) {
      <app-confirm-dialog
        title="Remove the link?"
        [message]="'Both stay: this ' + ownerName() + ' and the item “' + item.name + '”.'"
        [confirmLabel]="busy() ? 'Unlinking…' : 'Unlink'"
        [danger]="true"
        (confirmed)="confirmUnlink(item)"
        (cancelled)="unlinking.set(null)"
      />
    }
  `,
  styles: `
    .min-w-0 {
      min-width: 0;
    }
    .link-target {
      color: inherit;
      text-decoration: none;
      &:hover .fw-medium {
        text-decoration: underline;
      }
    }
    .btn-icon {
      display: inline-flex;
      padding: 0.3125rem;
      color: var(--bs-secondary-color);
      &:hover {
        color: var(--bs-danger);
        background: var(--bs-secondary-bg);
      }
      &:disabled {
        border-color: transparent;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkedItemsComponent {
  private readonly home = inject(HomeRepository);
  private readonly documents = inject(DocumentRepository);
  private readonly tasks = inject(TaskRepository);
  private readonly dataChanges = inject(DataChangesService);
  private readonly toasts = inject(ToastService);
  /** A read-only user (T60) sees the items, without link or unlink. */
  readonly canWrite = inject(AuthService).canWrite;

  /** What the page shows: a document or a task. */
  readonly kind = input.required<LinkedItemsOwner>();
  readonly ownerId = input.required<string>();
  /** The links of the document or the task, to find its own `Home.Item` links. */
  readonly ownerLinks = input<readonly OwnerLink[]>([]);
  /** A link was made or removed. */
  readonly changed = output<void>();

  readonly busy = signal(false);
  readonly picking = signal(false);
  readonly unlinking = signal<ItemSummaryDto | null>(null);

  private readonly ownLinkKey = computed(() =>
    this.ownerLinks()
      .filter((link) => link.kind === HOME_ITEM_LINK)
      .map((link) => link.id)
      .join(),
  );

  readonly items = rxResource({
    params: () => ({
      kind: this.kind(),
      id: this.ownerId(),
      links: this.ownLinkKey(),
      version: this.dataChanges.version(),
    }),
    stream: ({ params }) => this.home.listByLink(params.kind, params.id),
  });
  readonly list = keptValueOf(this.items);
  readonly linkedIds = computed(() => (this.list() ?? []).map((item) => item.id));

  readonly ownerName = computed(() => (this.kind() === 'Tasks.Task' ? 'task' : 'document'));
  readonly emptyText = computed(() =>
    this.kind() === 'Tasks.Task'
      ? 'Link the thing in the home that this task looks after.'
      : 'Link the thing in the home that this document is about.',
  );

  link(item: ItemSummaryDto): void {
    if (this.busy()) return;
    this.busy.set(true);
    const request: Observable<unknown> =
      this.kind() === 'Tasks.Task'
        ? this.tasks.addLink(this.ownerId(), { kind: HOME_ITEM_LINK, targetId: item.id })
        : this.documents.addLink(this.ownerId(), HOME_ITEM_LINK, item.id);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.picking.set(false);
        this.done(`Linked to “${item.name}”`);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toasts.error(homeError(error, 'Could not link the item.'));
      },
    });
  }

  /** Removes the link from the side that has it: this document or task, or the item. */
  confirmUnlink(item: ItemSummaryDto): void {
    if (this.busy()) return;
    const own = this.ownerLinks().find(
      (link) => link.kind === HOME_ITEM_LINK && link.targetId === item.id,
    );
    const fromItem = item.links.find(
      (link) => link.kind === this.kind() && link.targetId === this.ownerId(),
    );
    let request: Observable<void>;
    if (own) {
      request =
        this.kind() === 'Tasks.Task'
          ? this.tasks.removeLink(this.ownerId(), own.id)
          : this.documents.unlink(this.ownerId(), own.id);
    } else if (fromItem) {
      request = this.home.removeLink(item.id, fromItem.id);
    } else {
      this.unlinking.set(null);
      this.toasts.error('Could not find the link. Unlink it on the item page.');
      return;
    }
    this.busy.set(true);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.unlinking.set(null);
        this.done('Unlinked');
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.unlinking.set(null);
        this.toasts.error(homeError(error, 'Could not unlink.'));
      },
    });
  }

  private done(message: string): void {
    this.dataChanges.changed();
    this.changed.emit();
    this.toasts.success(message);
  }
}
