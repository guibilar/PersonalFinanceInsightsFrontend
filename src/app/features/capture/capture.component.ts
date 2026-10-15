import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { StatementImportLauncher } from '../../core/data/statement-import-launcher.service';
import { TransactionAddLauncher } from '../../core/data/transaction-add-launcher.service';
import { RouterLink } from '@angular/router';
import { IconComponent, IconName } from '../../shared/ui/icon/icon.component';

interface CaptureAction {
  label: string;
  hint: string;
  icon: IconName;
}

/** Capture actions still to come, the same as on Android. The Inbox (T18) makes them work. */
export const COMING_CAPTURE_ACTIONS: readonly CaptureAction[] = [
  { label: 'Note', hint: 'A quick thought', icon: 'note' },
];

/**
 * Capture: one place to add something to any module. For now it adds a transaction or imports bank statements into
 * Money, adds a document (a scan or a photo), a task, a home item, or a person, and shows the other actions as coming soon. A read-only user (T60) sees
 * the actions disabled.
 */
@Component({
  selector: 'app-capture',
  imports: [IconComponent, NgTemplateOutlet, RouterLink],
  template: `
    <div class="mb-4">
      <h1 class="h3 mb-1">Capture</h1>
      <p class="text-body-secondary mb-0">Add something to any module</p>
    </div>

    @if (!canWrite()) {
      <p class="alert alert-secondary" data-testid="read-only">
        This account can only read. It cannot add anything.
      </p>
    }

    <div class="row row-cols-1 row-cols-sm-2 g-3">
      <div class="col">
        <button
          type="button"
          class="card h-100 w-100 capture-action"
          [disabled]="!canWrite()"
          (click)="adder.open()"
        >
          <span class="card-body d-flex gap-3 align-items-center text-start">
            <span class="action-icon"><app-icon name="plus" /></span>
            <span class="min-w-0">
              <span class="d-block fw-semibold">Add transaction</span>
              <span class="d-block small text-body-secondary"
                >A purchase or a payment, by hand</span
              >
            </span>
          </span>
        </button>
      </div>
      <div class="col">
        <button
          type="button"
          class="card h-100 w-100 capture-action"
          [disabled]="!canWrite()"
          (click)="importer.open()"
        >
          <span class="card-body d-flex gap-3 align-items-center text-start">
            <span class="action-icon"><app-icon name="upload" /></span>
            <span class="min-w-0">
              <span class="d-block fw-semibold">Import statements</span>
              <span class="d-block small text-body-secondary">Bank statements into Money</span>
            </span>
          </span>
        </button>
      </div>
      <div class="col">
        @if (canWrite()) {
          <a class="card h-100 w-100 capture-action" routerLink="/documents/new">
            <ng-container *ngTemplateOutlet="addDocument" />
          </a>
        } @else {
          <button type="button" class="card h-100 w-100 capture-action" disabled>
            <ng-container *ngTemplateOutlet="addDocument" />
          </button>
        }
        <ng-template #addDocument>
          <span class="card-body d-flex gap-3 align-items-center text-start">
            <span class="action-icon"><app-icon name="file-text" /></span>
            <span class="min-w-0">
              <span class="d-block fw-semibold">Add document</span>
              <span class="d-block small text-body-secondary"
                >A scan or a photo: a receipt, a warranty, a lease</span
              >
            </span>
          </span>
        </ng-template>
      </div>
      <div class="col">
        @if (canWrite()) {
          <a class="card h-100 w-100 capture-action" routerLink="/tasks/new">
            <ng-container *ngTemplateOutlet="addTask" />
          </a>
        } @else {
          <button type="button" class="card h-100 w-100 capture-action" disabled>
            <ng-container *ngTemplateOutlet="addTask" />
          </button>
        }
        <ng-template #addTask>
          <span class="card-body d-flex gap-3 align-items-center text-start">
            <span class="action-icon"><app-icon name="list-checks" /></span>
            <span class="min-w-0">
              <span class="d-block fw-semibold">Add task</span>
              <span class="d-block small text-body-secondary"
                >Something to do, once or again and again</span
              >
            </span>
          </span>
        </ng-template>
      </div>
      <div class="col">
        @if (canWrite()) {
          <a class="card h-100 w-100 capture-action" routerLink="/home/items/new">
            <ng-container *ngTemplateOutlet="addItem" />
          </a>
        } @else {
          <button type="button" class="card h-100 w-100 capture-action" disabled>
            <ng-container *ngTemplateOutlet="addItem" />
          </button>
        }
        <ng-template #addItem>
          <span class="card-body d-flex gap-3 align-items-center text-start">
            <span class="action-icon"><app-icon name="house" /></span>
            <span class="min-w-0">
              <span class="d-block fw-semibold">Add item</span>
              <span class="d-block small text-body-secondary"
                >A thing in the home, for the inventory</span
              >
            </span>
          </span>
        </ng-template>
      </div>
      <div class="col">
        @if (canWrite()) {
          <a class="card h-100 w-100 capture-action" routerLink="/people/new">
            <ng-container *ngTemplateOutlet="addPerson" />
          </a>
        } @else {
          <button type="button" class="card h-100 w-100 capture-action" disabled>
            <ng-container *ngTemplateOutlet="addPerson" />
          </button>
        }
        <ng-template #addPerson>
          <span class="card-body d-flex gap-3 align-items-center text-start">
            <span class="action-icon"><app-icon name="users" /></span>
            <span class="min-w-0">
              <span class="d-block fw-semibold">Add person</span>
              <span class="d-block small text-body-secondary"
                >Someone to remember: a birthday, gifts, a reminder</span
              >
            </span>
          </span>
        </ng-template>
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
      text-decoration: none;

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
  protected readonly adder = inject(TransactionAddLauncher);
  protected readonly comingActions = COMING_CAPTURE_ACTIONS;
  /** A read-only user (T60) sees the add actions disabled, and why. */
  protected readonly canWrite = inject(AuthService).canWrite;
}
