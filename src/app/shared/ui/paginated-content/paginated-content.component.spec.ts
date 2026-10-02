import { ChangeDetectionStrategy, Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PaginatedContentComponent } from './paginated-content.component';
import { PaginatedResult } from '../../../core/models/outputs/paginated-result-output-dto';

@Component({
  imports: [PaginatedContentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-paginated-content
      [data]="data"
      [contentTemplate]="tpl"
      (pageChange)="pages.push($event)"
    />
    <ng-template #tpl let-items="items">{{ items.length }} items</ng-template>
  `,
})
class HostComponent {
  data?: PaginatedResult<number>;
  pages: number[] = [];
}

function page(
  current: number,
  totalPages: number,
  totalCount = totalPages * 10,
): PaginatedResult<number> {
  return {
    items: [1, 2, 3],
    page: current,
    pageSize: 10,
    totalCount,
    totalPages,
    hasPreviousPage: current > 1,
    hasNextPage: current < totalPages,
  };
}

describe('PaginatedContentComponent', () => {
  function render(data: PaginatedResult<number>) {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.data = data;
    fixture.detectChanges();
    const paginator = fixture.debugElement.children[0]
      .componentInstance as PaginatedContentComponent<number>;
    return { fixture, paginator, element: fixture.nativeElement as HTMLElement };
  }

  it('shows ellipses around the current page window', () => {
    const { paginator } = render(page(5, 10));

    expect(paginator.pageNumbers()).toEqual([1, -1, 4, 5, 6, -1, 10]);
  });

  it('shows every page when there are few', () => {
    const { paginator } = render(page(2, 3));

    expect(paginator.pageNumbers()).toEqual([1, 2, 3]);
  });

  it('shows the item range, capped at the total', () => {
    const { element } = render(page(3, 3, 23));

    expect(element.textContent).toContain('Showing 21 to 23 of 23 items');
  });

  it('hides the controls for a single page and renders the template', () => {
    const { element } = render(page(1, 1, 3));

    expect(element.querySelector('.pagination')).toBeNull();
    expect(element.textContent).toContain('3 items');
  });

  it('emits only pages within range', () => {
    const { fixture, paginator } = render(page(1, 3));

    paginator.onPageChange(0);
    paginator.onPageChange(2);
    paginator.onPageChange(4);

    expect(fixture.componentInstance.pages).toEqual([2]);
  });

  it('goes to the last page there is when a page comes back empty, as after deleting its only item', async () => {
    // Page 9 of 9 had one item; it was deleted, so there are 8 pages now and page 9 is empty.
    const { fixture } = render({ ...page(9, 8, 80), items: [], hasNextPage: false });
    await fixture.whenStable();

    expect(fixture.componentInstance.pages).toEqual([8]);
  });

  it('leaves an empty first page alone: there is nothing to show', async () => {
    const { fixture } = render({ ...page(1, 0, 0), items: [] });
    await fixture.whenStable();

    expect(fixture.componentInstance.pages).toEqual([]);
  });
});
