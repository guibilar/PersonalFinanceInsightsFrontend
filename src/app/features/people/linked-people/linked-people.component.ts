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
import { Observable, map, switchMap, throwError } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { DocumentRepository } from '../../../core/api/document-repository';
import { PeopleRepository } from '../../../core/api/people-repository';
import { TaskRepository } from '../../../core/api/task-repository';
import { DataChangesService } from '../../../core/data/data-changes.service';
import {
  PEOPLE_PERSON_LINK,
  PersonSummaryDto,
} from '../../../core/models/outputs/people-output-dto';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { keptValueOf } from '../../../shared/utils/resource-value';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';
import { PersonPickerComponent } from '../person-picker/person-picker.component';
import { groupLabel, peopleError } from '../people';

/** The kinds of page that show their people. */
export type LinkedPeopleOwner = 'Documents.Document' | 'Tasks.Task';

/** A link of the page's own thing (a document or a task). */
export interface PeopleOwnerLink {
  id: string;
  kind: string;
  targetId: string;
}

/**
 * The "People" section of a document or a task (T93): the people linked from either side
 * (`GET /api/people/by-link`), each opening the person. "Link a person" picks one and links it from the document or
 * the task (`kind: People.Person`). Unlink removes the link from the side that has it.
 */
@Component({
  selector: 'app-linked-people',
  imports: [
    RouterLink,
    ConfirmDialogComponent,
    ErrorStateComponent,
    IconComponent,
    PersonAvatarComponent,
    PersonPickerComponent,
    SkeletonComponent,
  ],
  template: `
    <section class="card" aria-labelledby="linked-people-heading">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
          <h2 id="linked-people-heading" class="h6 mb-0">People</h2>
          @if (canWrite()) {
            <button
              type="button"
              class="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
              [disabled]="busy()"
              (click)="picking.set(true)"
            >
              <app-icon name="users" [size]="14" /> Link a person
            </button>
          }
        </div>
        @if (people.error()) {
          <app-error-state message="Could not load the people." (retry)="people.reload()" />
        } @else if (!list()) {
          <app-skeleton [lines]="1" height="2.25rem" />
        } @else if (list()!.length === 0) {
          <p class="text-body-secondary small mb-0" data-testid="no-people">
            {{ emptyText() }}
          </p>
        } @else {
          <ul class="list-group" data-testid="linked-people">
            @for (person of list(); track person.id) {
              <li class="list-group-item d-flex align-items-center gap-2">
                <app-person-avatar [name]="person.name" [size]="28" />
                <a class="flex-grow-1 min-w-0 link-target" [routerLink]="['/people', person.id]">
                  <span class="d-block text-truncate fw-medium">{{ person.name }}</span>
                  @if (detail(person); as text) {
                    <span class="d-block small text-body-secondary text-truncate">{{ text }}</span>
                  }
                </a>
                @if (canWrite()) {
                  <button
                    type="button"
                    class="btn btn-icon btn-icon-danger"
                    title="Unlink"
                    [attr.aria-label]="'Unlink ' + person.name"
                    [disabled]="busy()"
                    (click)="unlinking.set(person)"
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
      <app-person-picker
        [linkedIds]="linkedIds()"
        [busy]="busy()"
        (picked)="link($event)"
        (closed)="picking.set(false)"
      />
    }

    @if (unlinking(); as person) {
      <app-confirm-dialog
        title="Remove the link?"
        [message]="'Both stay: this ' + ownerName() + ' and “' + person.name + '”.'"
        [confirmLabel]="busy() ? 'Unlinking…' : 'Unlink'"
        [danger]="true"
        (confirmed)="confirmUnlink(person)"
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
export class LinkedPeopleComponent {
  private readonly repository = inject(PeopleRepository);
  private readonly documents = inject(DocumentRepository);
  private readonly tasks = inject(TaskRepository);
  private readonly dataChanges = inject(DataChangesService);
  private readonly toasts = inject(ToastService);
  /** A read-only user (T60) sees the people, without link or unlink. */
  readonly canWrite = inject(AuthService).canWrite;

  /** What the page shows: a document or a task. */
  readonly kind = input.required<LinkedPeopleOwner>();
  readonly ownerId = input.required<string>();
  /** The links of the document or the task, to find its own `People.Person` links. */
  readonly ownerLinks = input<readonly PeopleOwnerLink[]>([]);
  /** A link was made or removed. */
  readonly changed = output<void>();

  readonly busy = signal(false);
  readonly picking = signal(false);
  readonly unlinking = signal<PersonSummaryDto | null>(null);

  private readonly ownLinkKey = computed(() =>
    this.ownerLinks()
      .filter((link) => link.kind === PEOPLE_PERSON_LINK)
      .map((link) => link.id)
      .join(),
  );

  readonly people = rxResource({
    params: () => ({
      kind: this.kind(),
      id: this.ownerId(),
      links: this.ownLinkKey(),
      version: this.dataChanges.version(),
    }),
    stream: ({ params }) => this.repository.listByLink(params.kind, params.id),
  });
  readonly list = keptValueOf(this.people);
  readonly linkedIds = computed(() => (this.list() ?? []).map((person) => person.id));

  readonly ownerName = computed(() => (this.kind() === 'Tasks.Task' ? 'task' : 'document'));
  readonly emptyText = computed(() =>
    this.kind() === 'Tasks.Task'
      ? 'Link the people this task is about, for example “Call Marco”.'
      : 'Link the people this document is about.',
  );

  detail(person: PersonSummaryDto): string {
    return [person.relationship, ...person.groups.map(groupLabel)].filter(Boolean).join(' · ');
  }

  link(person: PersonSummaryDto): void {
    if (this.busy()) return;
    this.busy.set(true);
    const request: Observable<unknown> =
      this.kind() === 'Tasks.Task'
        ? this.tasks.addLink(this.ownerId(), { kind: PEOPLE_PERSON_LINK, targetId: person.id })
        : this.documents.addLink(this.ownerId(), PEOPLE_PERSON_LINK, person.id);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.picking.set(false);
        this.done(`Linked to “${person.name}”`);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toasts.error(peopleError(error, 'Could not link the person.'));
      },
    });
  }

  /** Removes the link from the side that has it: this document or task, or the person. */
  confirmUnlink(person: PersonSummaryDto): void {
    if (this.busy()) return;
    const own = this.ownerLinks().find(
      (link) => link.kind === PEOPLE_PERSON_LINK && link.targetId === person.id,
    );
    let request: Observable<void>;
    if (own) {
      request =
        this.kind() === 'Tasks.Task'
          ? this.tasks.removeLink(this.ownerId(), own.id)
          : this.documents.unlink(this.ownerId(), own.id);
    } else {
      // The person has the link: its id is on the person.
      request = this.repository.get(person.id).pipe(
        map((found) =>
          found.links.find((link) => link.kind === this.kind() && link.targetId === this.ownerId()),
        ),
        switchMap((link) =>
          link
            ? this.repository.removeLink(person.id, link.id)
            : throwError(() => new Error('Could not find the link. Unlink it on the person page.')),
        ),
      );
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
        this.toasts.error(
          error instanceof Error ? error.message : peopleError(error, 'Could not unlink.'),
        );
      },
    });
  }

  private done(message: string): void {
    this.dataChanges.changed();
    this.changed.emit();
    this.toasts.success(message);
  }
}
