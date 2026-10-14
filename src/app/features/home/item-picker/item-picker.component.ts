import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { HomeRepository } from '../../../core/api/home-repository';
import { ItemSummaryDto } from '../../../core/models/outputs/home-output-dto';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { keptValueOf } from '../../../shared/utils/resource-value';

/** How many items the picker lists. */
export const ITEM_PICKER_PAGE_SIZE = 10;

/**
 * "Link to item": the items by name, or the best matches of a search (the server's full-text search). Picking one
 * emits it; the parent makes the link.
 */
@Component({
  selector: 'app-item-picker',
  imports: [ReactiveFormsModule, ErrorStateComponent, ModalComponent, SkeletonComponent],
  template: `
    <app-modal title="Link to item" (closed)="closed.emit()">
      <label for="item-picker-search" class="form-label">Search items</label>
      <input
        type="search"
        id="item-picker-search"
        class="form-control mb-3"
        placeholder="Names, brands, models, serial numbers"
        autocomplete="off"
        [formControl]="search"
      />
      @if (items.error()) {
        <app-error-state message="Could not load the items." (retry)="items.reload()" />
      } @else if (!list()) {
        <app-skeleton [lines]="5" height="2.5rem" />
      } @else if (list()!.length === 0) {
        <p class="text-body-secondary text-center py-4 mb-0">
          {{ term() ? 'No item matches “' + term() + '”.' : 'No items yet.' }}
        </p>
      } @else {
        <ul class="list-group" data-testid="picker-items">
          @for (item of list(); track item.id) {
            <li class="list-group-item d-flex align-items-center gap-3">
              <span class="flex-grow-1 min-w-0">
                <span class="d-block text-truncate fw-medium">{{ item.name }}</span>
                <span class="d-block small text-body-secondary">{{
                  item.roomName ?? 'No room'
                }}</span>
              </span>
              <button
                type="button"
                class="btn btn-sm btn-outline-primary"
                [disabled]="busy() || linkedIds().includes(item.id)"
                [attr.aria-label]="'Link ' + item.name"
                (click)="picked.emit(item)"
              >
                {{ linkedIds().includes(item.id) ? 'Linked' : 'Link' }}
              </button>
            </li>
          }
        </ul>
      }
    </app-modal>
  `,
  styles: `
    .min-w-0 {
      min-width: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemPickerComponent {
  private readonly repository = inject(HomeRepository);

  /** Items that are linked already: shown, but not linked twice. */
  readonly linkedIds = input<string[]>([]);
  /** A link is being made. */
  readonly busy = input(false);
  readonly picked = output<ItemSummaryDto>();
  readonly closed = output<void>();

  readonly search = new FormControl('', { nonNullable: true });
  readonly term = signal('');

  readonly items = rxResource({
    params: () => ({ q: this.term() }),
    stream: ({ params }) =>
      this.repository
        .list({ q: params.q || null, page: 1, pageSize: ITEM_PICKER_PAGE_SIZE })
        .pipe(map((page) => page.items)),
  });
  readonly list = keptValueOf(this.items);

  constructor() {
    this.search.valueChanges
      .pipe(
        map((value) => value.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((term) => this.term.set(term));
  }
}
