import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { StatementImportLauncher } from '../../core/data/statement-import-launcher.service';
import { IconComponent, IconName } from '../../shared/ui/icon/icon.component';

interface CaptureAction {
  label: string;
  hint: string;
  icon: IconName;
}

/** Capture actions still to come, the same as on Android. The Inbox (T18) makes them work. */
export const COMING_CAPTURE_ACTIONS: readonly CaptureAction[] = [
  { label: 'Document', hint: 'A scan or a photo', icon: 'file-text' },
  { label: 'Note', hint: 'A quick thought', icon: 'note' },
  { label: 'Task', hint: 'Something to do', icon: 'list-checks' },
];

/**
 * Capture: one place to add something to any module. For now it imports bank statements into Money, and shows the
 * other actions as coming soon.
 */
@Component({
  selector: 'app-capture',
  imports: [IconComponent],
  template: `
    <div class="mb-4">
      <h1 class="h3 mb-1">Capture</h1>
      <p class="text-body-secondary mb-0">Add something to any module</p>
    </div>

    <div class="row row-cols-1 row-cols-sm-2 g-3">
      <div class="col">
        <button type="button" class="card h-100 w-100 capture-action" (click)="importer.open()">
          <span class="card-body d-flex gap-3 align-items-center text-start">
            <span class="action-icon"><app-icon name="upload" /></span>
            <span class="min-w-0">
              <span class="d-block fw-semibold">Import statements</span>
              <span class="d-block small text-body-secondary">Bank statements into Money</span>
            </span>
          </span>
        </button>
      </div>
      @for (action of comingActions; track action.label) {
        <div class="col">
          <button type="button" class="card h-100 w-100 capture-action" disabled>
            <span class="card-body d-flex gap-3 align-items-center text-start">
              <span class="action-icon"><app-icon [name]="action.icon" /></span>
              <span class="min-w-0">
                <span class="d-block fw-semibold">
                  {{ action.label }}
                  <span class="badge text-bg-secondary ms-1 align-middle">Coming soon</span>
                </span>
                <span class="d-block small text-body-secondary">{{ action.hint }}</span>
              </span>
            </span>
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .capture-action {
      padding: 0;
      color: inherit;

      &:not(:disabled):hover {
        border-color: var(--bs-primary-border-subtle);
      }

      &:focus-visible {
        outline: 2px solid var(--bs-primary);
        outline-offset: 2px;
      }

      &:disabled {
        border-style: dashed;
        background: transparent;
        box-shadow: none;

        .action-icon {
          background: var(--bs-secondary-bg);
          color: var(--bs-secondary-color);
        }
      }
    }

    .action-icon {
      display: inline-flex;
      padding: 0.625rem;
      border-radius: var(--bs-border-radius-lg);
      background: var(--bs-primary-bg-subtle);
      color: var(--bs-primary-text-emphasis);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaptureComponent {
  protected readonly importer = inject(StatementImportLauncher);
  protected readonly comingActions = COMING_CAPTURE_ACTIONS;
}
