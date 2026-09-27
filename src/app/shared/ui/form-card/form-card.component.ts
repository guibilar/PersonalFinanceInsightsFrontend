import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-form-card',
  template: `
    <div class="card shadow-sm mb-4">
      <div class="card-header">
        <h2 class="h5 mb-0">{{ title() }}</h2>
      </div>
      <div class="card-body">
        <ng-content />
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormCardComponent {
  readonly title = input.required<string>();
}
