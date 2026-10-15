import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { map, switchMap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { HomeRepository } from '../../../core/api/home-repository';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { ItemSummaryDto, RoomDto } from '../../../core/models/outputs/home-output-dto';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { keptValueOf } from '../../../shared/utils/resource-value';
import { ItemRowComponent } from '../item-row/item-row.component';
import { createItemForm, itemDetailsOf } from '../item-fields/item-fields.component';
import { HOME_LIMITS, HOME_TODAY, MAX_PAGE_SIZE, NO_ROOM, NO_ROOM_NAME, homeError } from '../home';

/**
 * One room (`/home/rooms/<id>`), or the items without a room (`/home/rooms/none`): the items by name, with their value
 * and warranty state. The room can be renamed, moved up or down in the list, and deleted when it is empty.
 */
@Component({
  selector: 'app-room-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MoneyPipe,
    ConfirmDialogComponent,
    ErrorStateComponent,
    IconComponent,
    ItemRowComponent,
    SkeletonComponent,
  ],
  templateUrl: './room-page.component.html',
  styles: `
    .move-select {
      width: auto;
      max-width: 10rem;
      flex-shrink: 0;
    }
    .back-link {
      color: var(--bs-secondary-color);
      text-decoration: none;
      &:hover {
        color: var(--bs-emphasis-color);
      }
    }
    .rename-input {
      min-width: 12rem;
      width: auto;
    }
    .min-w-0 {
      min-width: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoomPageComponent {
  private readonly repository = inject(HomeRepository);
  private readonly dataChanges = inject(DataChangesService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  /** A read-only user (T60) gets no add, rename, move, or delete. */
  readonly canWrite = inject(AuthService).canWrite;
  readonly today = inject(HOME_TODAY)();

  readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: '',
  });
  /** The page of the items without a room. */
  readonly noRoom = computed(() => this.id() === NO_ROOM);

  readonly roomsResource = rxResource({
    params: () => this.dataChanges.version(),
    stream: () => this.repository.rooms(),
  });
  readonly rooms = keptValueOf(this.roomsResource);
  readonly room = computed(() => this.rooms()?.find((room) => room.id === this.id()) ?? null);
  readonly index = computed(() => this.rooms()?.findIndex((room) => room.id === this.id()) ?? -1);
  readonly notFound = computed(() => !this.noRoom() && !!this.rooms() && !this.room());
  readonly title = computed(() => (this.noRoom() ? NO_ROOM_NAME : (this.room()?.name ?? '')));
  /** The rooms that an item of this page can move to (T89). */
  readonly otherRooms = computed(() =>
    (this.rooms() ?? []).filter((room) => room.id !== this.id()),
  );

  readonly itemsResource = rxResource({
    params: () => ({ room: this.id(), version: this.dataChanges.version() }),
    stream: ({ params }) =>
      this.repository.list({ room: params.room, page: 1, pageSize: MAX_PAGE_SIZE }),
  });
  readonly items = keptValueOf(this.itemsResource);
  /** The totals of the page: from the room, or from the items without a room. */
  readonly totals = computed(() => {
    const room = this.room();
    if (room) return { count: room.itemCount, value: room.totalValue };
    const page = this.items();
    if (!page) return null;
    return { count: page.totalCount, value: page.items.reduce((sum, item) => sum + item.value, 0) };
  });

  readonly renaming = signal(false);
  readonly name = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.pattern(/\S/),
      Validators.maxLength(HOME_LIMITS.room),
    ],
  });
  readonly busy = signal(false);
  readonly confirmingDelete = signal(false);
  readonly roomLimit = HOME_LIMITS.room;

  /**
   * Moves an item to another room (T89), or out of all rooms with `none`. The update sends all details again, so the
   * page reads the item first.
   */
  moveItem(item: ItemSummaryDto, target: string): void {
    if (this.busy() || !target) return;
    const roomId = target === 'none' ? null : target;
    const name = roomId
      ? (this.rooms()?.find((room) => room.id === roomId)?.name ?? 'the room')
      : NO_ROOM_NAME;
    this.busy.set(true);
    this.repository
      .get(item.id)
      .pipe(
        switchMap((full) =>
          this.repository.update(full.id, { ...itemDetailsOf(createItemForm(full)), roomId }),
        ),
      )
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.dataChanges.changed();
          this.toasts.success(`Moved “${item.name}” to ${name}`);
        },
        error: (error: unknown) => {
          this.busy.set(false);
          this.dataChanges.changed();
          this.toasts.error(homeError(error, 'Could not move the item.'));
        },
      });
  }

  count(n: number): string {
    return `${n} ${n === 1 ? 'item' : 'items'}`;
  }

  startRename(room: RoomDto): void {
    this.name.reset(room.name);
    this.renaming.set(true);
  }

  rename(room: RoomDto): void {
    if (this.busy()) return;
    this.name.markAsTouched();
    if (this.name.invalid) return;
    this.busy.set(true);
    this.repository.updateRoom(room.id, { name: this.name.value.trim() }).subscribe({
      next: (saved) => {
        this.busy.set(false);
        this.renaming.set(false);
        this.dataChanges.changed();
        this.toasts.success(`Renamed to “${saved.name}”`);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toasts.error(homeError(error, 'Could not rename the room.'));
      },
    });
  }

  /** Moves the room one place up (-1) or down (+1) in the list. */
  move(step: -1 | 1): void {
    const rooms = this.rooms();
    const index = this.index();
    const target = index + step;
    if (this.busy() || !rooms || index < 0 || target < 0 || target >= rooms.length) return;
    const ids = rooms.map((room) => room.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    this.busy.set(true);
    this.repository.orderRooms(ids).subscribe({
      next: () => {
        this.busy.set(false);
        this.dataChanges.changed();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toasts.error(homeError(error, 'Could not move the room.'));
        this.dataChanges.changed();
      },
    });
  }

  confirmDelete(room: RoomDto): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.repository.deleteRoom(room.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.confirmingDelete.set(false);
        this.toasts.success(`Deleted the room “${room.name}”`);
        // Leave first: a change before would load the deleted room again.
        void this.router.navigateByUrl('/home').then(() => this.dataChanges.changed());
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.confirmingDelete.set(false);
        this.toasts.error(homeError(error, 'Could not delete the room.'));
        this.dataChanges.changed();
      },
    });
  }
}
