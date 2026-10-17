import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, filter, map } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { PeopleRepository } from '../../../core/api/people-repository';
import { DataChangesService } from '../../../core/data/data-changes.service';
import {
  LoanDto,
  PersonSummaryDto,
  UpcomingBirthdayDto,
} from '../../../core/models/outputs/people-output-dto';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { formatDay } from '../../../shared/utils/format';
import { keptValueOf } from '../../../shared/utils/resource-value';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';
import {
  PEOPLE_TODAY,
  agoText,
  dateBadge,
  groupLabel,
  inDaysText,
  lastContactText,
} from '../people';

/** How many people the list shows. */
export const PEOPLE_PAGE_SIZE = 100;

/**
 * The People page: "Reach out" (overdue reminders), "Upcoming" (birthdays in the next 30 days), the open loans, and all
 * people with group chips and a search. The group and the search are in the address (`/people?group=family&q=ana`).
 */
@Component({
  selector: 'app-people-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ErrorStateComponent,
    IconComponent,
    PersonAvatarComponent,
    SkeletonComponent,
  ],
  templateUrl: './people-page.component.html',
  styleUrl: './people-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeoplePageComponent {
  private readonly repository = inject(PeopleRepository);
  private readonly dataChanges = inject(DataChangesService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  /** A read-only user (T60) gets no "Add person". */
  readonly canWrite = inject(AuthService).canWrite;

  readonly summaryResource = rxResource({
    params: () => this.dataChanges.version(),
    stream: () => this.repository.summary(),
  });
  readonly summary = keptValueOf(this.summaryResource);
  private readonly browserToday = inject(PEOPLE_TODAY);
  /** Today in the time zone of the server; the browser's day until the server answers. */
  readonly today = computed(() => this.summary()?.date ?? this.browserToday());

  readonly groupsResource = rxResource({
    params: () => this.dataChanges.version(),
    stream: () => this.repository.groups(),
  });
  readonly groups = keptValueOf(this.groupsResource);

  readonly loansResource = rxResource({
    params: () => this.dataChanges.version(),
    stream: () => this.repository.loans('open'),
  });
  readonly loans = keptValueOf(this.loansResource);

  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly term = computed(() => (this.query().get('q') ?? '').trim());
  readonly group = computed(() => (this.query().get('group') ?? '').trim().toLowerCase() || null);

  readonly listResource = rxResource({
    params: () => ({ q: this.term(), group: this.group(), version: this.dataChanges.version() }),
    stream: ({ params }) =>
      this.repository.list({
        q: params.q || null,
        group: params.group,
        sort: 'name',
        page: 1,
        pageSize: PEOPLE_PAGE_SIZE,
      }),
  });
  readonly list = keptValueOf(this.listResource);

  readonly search = new FormControl(this.term(), { nonNullable: true });

  constructor() {
    this.search.valueChanges
      .pipe(
        map((value) => value.trim()),
        debounceTime(300),
        // Against the address, not the last value typed: the box is also cleared (or set) without an event, and
        // the same search typed again afterwards has to run.
        filter((q) => q !== this.term()),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((q) =>
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { q: q || null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        }),
      );
  }

  groupName(group: string): string {
    return groupLabel(group);
  }

  lastContact(person: PersonSummaryDto): string {
    return lastContactText(person.lastContactOn, this.today());
  }

  /** The short last contact of a list row: "2 days ago", or empty. */
  ago(person: PersonSummaryDto): string {
    return person.lastContactOn ? agoText(person.lastContactOn, this.today()) : '';
  }

  badge(birthday: UpcomingBirthdayDto) {
    return dateBadge(birthday.date);
  }

  /** "In 23 days · turns 36 · 3 gift ideas". */
  upcomingText(birthday: UpcomingBirthdayDto): string {
    const parts = [inDaysText(birthday.days)];
    if (birthday.age !== null) parts.push(`turns ${birthday.age}`);
    if (birthday.giftIdeas > 0) {
      parts.push(`${birthday.giftIdeas} ${birthday.giftIdeas === 1 ? 'gift idea' : 'gift ideas'}`);
    }
    return parts.join(' · ');
  }

  /** "Lent to Marco · due Aug 1", "Borrowed from Ana". */
  loanText(loan: LoanDto): string {
    const who =
      loan.direction === 'Lent' ? `Lent to ${loan.personName}` : `Borrowed from ${loan.personName}`;
    return loan.dueOn ? `${who} · due ${formatDay(loan.dueOn)}` : who;
  }

  clearFilters(): void {
    this.search.setValue('', { emitEvent: false });
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }
}
