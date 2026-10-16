import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Observable, switchMap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { InboxRepository } from '../../../core/api/inbox-repository';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { InboxItemDto } from '../../../core/models/outputs/inbox-output-dto';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { INBOX_LIMITS, NoteSender, NoteTarget, inboxError } from '../inbox';

/**
 * The Inbox (design canvas, "Inbox and quick capture", T18): a quick note that goes to the Inbox, a task, or today's
 * journal; then the notes to sort, each with "To task", "To journal", "Done", edit, and delete. `?view=sorted` shows the
 * sorted notes, with "Undo". A read-only user reads only.
 */
@Component({
  selector: 'app-inbox-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ConfirmDialogComponent,
    ErrorStateComponent,
    IconComponent,
    SkeletonComponent,
  ],
  templateUrl: './inbox-page.component.html',
  styleUrl: './inbox-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxPageComponent {
  private readonly repository = inject(InboxRepository);
  private readonly sender = inject(NoteSender);
  private readonly dataChanges = inject(DataChangesService);
  private readonly toasts = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  readonly canWrite = inject(AuthService).canWrite;
  readonly limit = INBOX_LIMITS.text;
  readonly targets: readonly NoteTarget[] = ['Inbox', 'Task', 'Journal'];

  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly sorted = computed(() => this.query().get('view') === 'sorted');

  readonly notes = rxResource({
    params: () => ({ sorted: this.sorted(), version: this.dataChanges.version() }),
    stream: ({ params }) => this.repository.list(params.sorted),
  });
  readonly page = computed(() => (this.notes.hasValue() ? this.notes.value() : undefined));

  readonly text = new FormControl('', { nonNullable: true });
  private readonly textValue = toSignal(this.text.valueChanges, { initialValue: '' });
  readonly canSend = computed(() => this.textValue().trim().length > 0);
  readonly target = signal<NoteTarget>('Inbox');
  readonly busy = signal<string | null>(null);
  readonly editing = signal<string | null>(null);
  readonly editText = new FormControl('', { nonNullable: true });
  readonly deleting = signal<InboxItemDto | null>(null);

  /** Saves the quick note where the chips say. */
  send(): void {
    const text = this.text.value.trim();
    if (!text || this.busy()) return;
    const target = this.target();
    const send: Observable<unknown> =
      target === 'Task'
        ? this.sender.toTask(text)
        : target === 'Journal'
          ? this.sender.toJournal(text)
          : this.repository.add(text);
    this.run(
      'new',
      send,
      target === 'Inbox'
        ? 'Saved to the Inbox'
        : `Saved to ${target === 'Task' ? 'Tasks' : 'the journal'}`,
      () => this.text.setValue(''),
    );
  }

  /** Sorts a note: adds it to the module first, then marks it done with where it went. */
  sortTo(note: InboxItemDto, target: 'Task' | 'Journal'): void {
    const add =
      target === 'Task' ? this.sender.toTask(note.text) : this.sender.toJournal(note.text);
    this.run(
      note.id,
      add.pipe(switchMap(() => this.repository.done(note.id, target))),
      target === 'Task' ? 'Added to Tasks' : 'Added to the journal',
    );
  }

  done(note: InboxItemDto): void {
    this.run(note.id, this.repository.done(note.id), 'Done');
  }

  reopen(note: InboxItemDto): void {
    this.run(note.id, this.repository.reopen(note.id), 'Back in the Inbox');
  }

  edit(note: InboxItemDto): void {
    this.editText.setValue(note.text);
    this.editing.set(note.id);
  }

  saveEdit(note: InboxItemDto): void {
    const text = this.editText.value.trim();
    if (!text) return;
    this.run(note.id, this.repository.update(note.id, text), 'Saved', () => this.editing.set(null));
  }

  confirmDelete(): void {
    const note = this.deleting();
    if (!note) return;
    this.run(note.id, this.repository.delete(note.id), 'Deleted the note', () =>
      this.deleting.set(null),
    );
  }

  private run(key: string, work: Observable<unknown>, success: string, after?: () => void): void {
    this.busy.set(key);
    work.subscribe({
      next: () => {
        this.busy.set(null);
        after?.();
        this.dataChanges.changed();
        this.toasts.success(success);
      },
      error: (error: unknown) => {
        this.busy.set(null);
        this.deleting.set(null);
        this.toasts.error(inboxError(error, 'That did not work. Try again.'));
      },
    });
  }

  /** "Today 14:22", "Oct 9, 14:22". */
  when(at: string): string {
    const date = new Date(at);
    const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const sameDay = date.toDateString() === new Date().toDateString();
    return sameDay
      ? `Today ${time}`
      : `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
  }
}
