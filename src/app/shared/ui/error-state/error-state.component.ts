import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-error-state',
  template: `
    <div class="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
      <span>{{ message() }}</span>
      <button type="button" class="btn btn-sm btn-outline-danger" (click)="retry.emit()">{{ actionLabel() }}</button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ErrorStateComponent {
  readonly message = input('Something went wrong.');
  readonly actionLabel = input('Retry');
  readonly retry = output<void>();
}
