import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Card shell for filter forms. Place it inside the feature's <form>, so the
 * Apply button submits it; filter fields are projected as grid columns.
 */
@Component({
  selector: 'app-filter-panel',
  template: `
    <div class="card bg-body-tertiary mb-3">
      <div class="card-body">
        <h2 class="h5 card-title mb-3">{{ title() }}</h2>
        <div class="row g-3">
          <ng-content />
        </div>
        <div class="d-flex gap-2 mt-3">
          <button type="submit" class="btn btn-success">Apply Filter</button>
          <button type="button" class="btn btn-outline-secondary" (click)="clear.emit()">Clear</button>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FilterPanelComponent {
  readonly title = input('Filters');
  readonly clear = output<void>();
}
