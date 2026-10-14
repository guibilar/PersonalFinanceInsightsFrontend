import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, map, of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { HomeRepository } from '../../../core/api/home-repository';
import { TaskRepository } from '../../../core/api/task-repository';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { RoomCountDto } from '../../../core/models/outputs/home-output-dto';
import { TaskSummaryDto } from '../../../core/models/outputs/task-output-dto';
import { WarrantyFilter } from '../../../core/models/inputs/home-input-dto';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { keptValueOf } from '../../../shared/utils/resource-value';
import { TaskDoneService } from '../../tasks/task-done.service';
import { repeatText } from '../../tasks/tasks';
import { ItemRowComponent } from '../item-row/item-row.component';
import {
  HOME_LIMITS,
  HOME_TODAY,
  MAX_PAGE_SIZE,
  NO_ROOM,
  NO_ROOM_NAME,
  daysLeftText,
  homeError,
  maintenanceTasks,
} from '../home';

/** How many items a search shows. */
export const SEARCH_PAGE_SIZE = 50;

const WARRANTY_FILTERS: readonly WarrantyFilter[] = ['active', 'expiring', 'expired'];

/** What the page says over a warranty filter: "Warranties that end in the next 30 days". */
export const WARRANTY_FILTER_LABELS: Record<WarrantyFilter, string> = {
  active: 'Items under warranty',
  expiring: 'Warranties that end in the next 30 days',
  expired: 'Warranties that ended',
};

/**
 * The Home page: the maintenance (open repeated tasks of items, soonest first), the inventory (item count and total
 * value), the rooms, a search over all items, and the export for insurance. The search and a warranty filter are in
 * the address (`/home?q=tv&warranty=expiring`).
 */
@Component({
  selector: 'app-home-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MoneyPipe,
    ErrorStateComponent,
    IconComponent,
    ItemRowComponent,
    SkeletonComponent,
  ],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent {
  private readonly repository = inject(HomeRepository);
  private readonly tasks = inject(TaskRepository);
  private readonly dataChanges = inject(DataChangesService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly done = inject(TaskDoneService);
  /** A read-only user (T60) gets no add, no room changes, and no done. The export still works. */
  readonly canWrite = inject(AuthService).canWrite;

  readonly summaryResource = rxResource({
    params: () => this.dataChanges.version(),
    stream: () => this.repository.summary(),
  });
  readonly summary = keptValueOf(this.summaryResource);
  /** Today in the time zone of the server; the browser's day until the server answers. */
  private readonly browserToday = inject(HOME_TODAY);
  readonly today = computed(() => this.summary()?.date ?? this.browserToday());

  readonly maintenanceResource = rxResource({
    params: () => this.dataChanges.version(),
    stream: () =>
      this.tasks
        .list({ status: 'Open', page: 1, pageSize: MAX_PAGE_SIZE })
        .pipe(map((page) => maintenanceTasks(page.items))),
  });
  readonly maintenance = keptValueOf(this.maintenanceResource);

  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly term = computed(() => (this.query().get('q') ?? '').trim());
  readonly warranty = computed(() => {
    const value = this.query().get('warranty') as WarrantyFilter | null;
    return value && WARRANTY_FILTERS.includes(value) ? value : null;
  });
  readonly warrantyLabel = computed(() => {
    const warranty = this.warranty();
    return warranty ? WARRANTY_FILTER_LABELS[warranty] : '';
  });
  readonly searching = computed(() => this.term() !== '' || this.warranty() !== null);

  readonly results = rxResource({
    params: () => ({
      q: this.term(),
      warranty: this.warranty(),
      version: this.dataChanges.version(),
    }),
    stream: ({ params }) =>
      params.q || params.warranty
        ? this.repository.list({
            q: params.q || null,
            warranty: params.warranty,
            page: 1,
            pageSize: SEARCH_PAGE_SIZE,
          })
        : of(null),
  });
  readonly resultPage = keptValueOf(this.results);

  /** The address of "Export list for insurance": all items. */
  readonly exportUrl = this.repository.exportUrl();

  readonly search = new FormControl(this.term(), { nonNullable: true });
  readonly newRoom = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.pattern(/\S/),
      Validators.maxLength(HOME_LIMITS.room),
    ],
  });
  readonly addingRoom = signal(false);
  readonly busy = signal(false);
  readonly roomLimit = HOME_LIMITS.room;

  constructor() {
    this.search.valueChanges
      .pipe(
        map((value) => value.trim()),
        debounceTime(300),
        distinctUntilChanged(),
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

  /** The route of a room tile: the room, or the items without a room. */
  roomLink(room: RoomCountDto): string[] {
    return ['/home/rooms', room.roomId ?? NO_ROOM];
  }

  roomName(room: RoomCountDto): string {
    return room.name ?? NO_ROOM_NAME;
  }

  count(n: number): string {
    return `${n} ${n === 1 ? 'item' : 'items'}`;
  }

  rule(task: TaskSummaryDto): string {
    return task.repeat ? repeatText(task.repeat) : '';
  }

  daysLeft(task: TaskSummaryDto): string {
    return daysLeftText(task.dueOn, this.today());
  }

  late(task: TaskSummaryDto): boolean {
    return !!task.dueOn && task.dueOn.slice(0, 10) < this.today();
  }

  clearSearch(): void {
    this.search.setValue('', { emitEvent: false });
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  startAddRoom(): void {
    this.newRoom.reset('');
    this.addingRoom.set(true);
  }

  addRoom(): void {
    if (this.busy()) return;
    this.newRoom.markAsTouched();
    if (this.newRoom.invalid) return;
    const name = this.newRoom.value.trim();
    this.busy.set(true);
    this.repository.createRoom({ name }).subscribe({
      next: (room) => {
        this.busy.set(false);
        this.addingRoom.set(false);
        this.dataChanges.changed();
        this.toasts.success(`Added the room “${room.name}”`);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toasts.error(homeError(error, 'Could not add the room.'));
      },
    });
  }
}
