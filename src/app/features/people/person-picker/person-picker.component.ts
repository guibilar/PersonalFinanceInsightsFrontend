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
import { PeopleRepository } from '../../../core/api/people-repository';
import { PersonSummaryDto } from '../../../core/models/outputs/people-output-dto';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { keptValueOf } from '../../../shared/utils/resource-value';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';
import { groupLabel } from '../people';

/** How many people the picker lists. */
export const PERSON_PICKER_PAGE_SIZE = 10;

/**
 * "Link a person" (T93): the people by name, or the matches of a search. Picking one emits it; the parent makes the
 * link.
 */
@Component({
  selector: 'app-person-picker',
  imports: [
    ReactiveFormsModule,
    ErrorStateComponent,
    ModalComponent,
    PersonAvatarComponent,
    SkeletonComponent,
  ],
  template: `
    <app-modal title="Link a person" (closed)="closed.emit()">
      <label for="person-picker-search" class="form-label">Search people</label>
      <input
        type="search"
        id="person-picker-search"
        class="form-control mb-3"
        placeholder="Names, groups, notes"
        autocomplete="off"
        [formControl]="search"
      />
      @if (people.error()) {
        <app-error-state message="Could not load the people." (retry)="people.reload()" />
      } @else if (!list()) {
        <app-skeleton [lines]="5" height="2.5rem" />
      } @else if (list()!.length === 0) {
        <p class="text-body-secondary text-center py-4 mb-0">
          {{ term() ? 'No person matches “' + term() + '”.' : 'No people yet.' }}
        </p>
      } @else {
        <ul class="list-group" data-testid="picker-people">
          @for (person of list(); track person.id) {
            <li class="list-group-item d-flex align-items-center gap-3">
              <app-person-avatar [name]="person.name" [size]="32" />
              <span class="flex-grow-1 min-w-0">
                <span class="d-block text-truncate fw-medium">{{ person.name }}</span>
                @if (detail(person); as text) {
                  <span class="d-block small text-body-secondary text-truncate">{{ text }}</span>
                }
              </span>
              <button
                type="button"
                class="btn btn-sm btn-outline-primary"
                [disabled]="busy() || linkedIds().includes(person.id)"
                [attr.aria-label]="'Link ' + person.name"
                (click)="picked.emit(person)"
              >
                {{ linkedIds().includes(person.id) ? 'Linked' : 'Link' }}
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
export class PersonPickerComponent {
  private readonly repository = inject(PeopleRepository);

  /** People who are linked already: shown, but not linked twice. */
  readonly linkedIds = input<string[]>([]);
  /** A link is being made. */
  readonly busy = input(false);
  readonly picked = output<PersonSummaryDto>();
  readonly closed = output<void>();

  readonly search = new FormControl('', { nonNullable: true });
  readonly term = signal('');

  readonly people = rxResource({
    params: () => ({ q: this.term() }),
    stream: ({ params }) =>
      this.repository
        .list({ q: params.q || null, page: 1, pageSize: PERSON_PICKER_PAGE_SIZE })
        .pipe(map((page) => page.items)),
  });
  readonly list = keptValueOf(this.people);

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

  /** The relationship and the groups: "Friend · Gaming group". */
  detail(person: PersonSummaryDto): string {
    return [person.relationship, ...person.groups.map(groupLabel)].filter(Boolean).join(' · ');
  }
}
