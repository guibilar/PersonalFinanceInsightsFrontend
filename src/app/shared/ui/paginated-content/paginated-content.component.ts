import { Component, Input, Output, EventEmitter, TemplateRef } from '@angular/core';
import { PaginatedResult } from '../../../core/models/outputs/paginated-result-output-dto';
import {NgTemplateOutlet} from '@angular/common';

@Component({
  selector: 'app-paginated-content',
  templateUrl: './paginated-content.component.html',
  imports: [
    NgTemplateOutlet
  ],
  styleUrls: ['./paginated-content.component.css']
})
export class PaginatedContentComponent<T> {
  @Input() data?: PaginatedResult<T>;
  @Input() contentTemplate!: TemplateRef<any>;
  @Output() pageChange = new EventEmitter<number>();

  onPageChange(page: number): void {
    if (this.data && page >= 1 && page <= this.data.totalPages) {
      this.pageChange.emit(page);
    }
  }

  getPageNumbers(): number[] {
    if (!this.data) return [];

    const current = this.data.page;
    const total = this.data.totalPages;
    const pages: number[] = [];

    pages.push(1);

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    if (start > 2) pages.push(-1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < total - 1) pages.push(-1);

    if (total > 1) pages.push(total);

    return pages;
  }

  protected readonly Math = Math;
}
