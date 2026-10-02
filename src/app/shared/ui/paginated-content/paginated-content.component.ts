import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  effect,
  input,
  output,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { PaginatedResult } from '../../../core/models/outputs/paginated-result-output-dto';

export interface PaginatedContentContext<T> {
  items: T[];
  data: PaginatedResult<T>;
}

@Component({
  selector: 'app-paginated-content',
  templateUrl: './paginated-content.component.html',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginatedContentComponent<T> {
  readonly data = input<PaginatedResult<T>>();
  readonly contentTemplate = input.required<TemplateRef<PaginatedContentContext<T>>>();
  readonly pageChange = output<number>();

  readonly firstItem = computed(() => {
    const data = this.data();
    return data ? (data.page - 1) * data.pageSize + 1 : 0;
  });

  readonly lastItem = computed(() => {
    const data = this.data();
    return data ? Math.min(data.page * data.pageSize, data.totalCount) : 0;
  });

  // -1 marks an ellipsis between page numbers.
  readonly pageNumbers = computed(() => {
    const data = this.data();
    if (!data) return [];

    const current = data.page;
    const total = data.totalPages;
    const pages: number[] = [1];

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    if (start > 2) pages.push(-1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (end < total - 1) pages.push(-1);
    if (total > 1) pages.push(total);

    return pages;
  });

  constructor() {
    // A page past the end, as after deleting the only item on the last page: go to the last page there is,
    // rather than showing an empty page as if there were nothing at all.
    effect(() => {
      const data = this.data();
      if (data && data.items.length === 0 && data.page > 1) {
        untracked(() => this.pageChange.emit(Math.max(1, data.totalPages)));
      }
    });
  }

  onPageChange(page: number): void {
    const data = this.data();
    if (data && page >= 1 && page <= data.totalPages) {
      this.pageChange.emit(page);
    }
  }
}
