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
import { DocumentRepository } from '../../../core/api/document-repository';
import { DocumentSummaryDto } from '../../../core/models/outputs/document-output-dto';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { keptValueOf } from '../../../shared/utils/resource-value';

/** How many documents the picker lists. */
export const DOCUMENT_PICKER_PAGE_SIZE = 10;

/**
 * "Link to a document": the newest documents, or the best matches of a search (the server's full-text search, as in
 * "Link an existing document" on a transaction). Picking one emits it; the parent makes the link.
 */
@Component({
  selector: 'app-document-picker',
  imports: [ReactiveFormsModule, ErrorStateComponent, ModalComponent, SkeletonComponent],
  template: `
    <app-modal title="Link to a document" (closed)="closed.emit()">
      <label for="document-picker-search" class="form-label">Search documents</label>
      <input
        type="search"
        id="document-picker-search"
        class="form-control mb-3"
        placeholder="Titles, tags, notes and the text of the files"
        autocomplete="off"
        [formControl]="search"
      />
      @if (documents.error()) {
        <app-error-state message="Could not load the documents." (retry)="documents.reload()" />
      } @else if (!list()) {
        <app-skeleton [lines]="5" height="2.5rem" />
      } @else if (list()!.length === 0) {
        <p class="text-body-secondary text-center py-4 mb-0">
          {{ term() ? 'No document matches “' + term() + '”.' : 'No documents yet.' }}
        </p>
      } @else {
        <p class="small text-body-secondary mb-2">
          {{ term() ? 'Best matches' : 'Recent documents' }}
        </p>
        <ul class="list-group" data-testid="picker-documents">
          @for (document of list(); track document.id) {
            <li class="list-group-item d-flex align-items-center gap-3">
              <span class="flex-grow-1 min-w-0">
                <span class="d-block text-truncate fw-medium">{{ document.title }}</span>
                <span class="d-block small text-body-secondary">{{ document.kind }}</span>
              </span>
              <button
                type="button"
                class="btn btn-sm btn-outline-primary"
                [disabled]="busy() || linkedIds().includes(document.id)"
                [attr.aria-label]="'Link ' + document.title"
                (click)="picked.emit(document)"
              >
                {{ linkedIds().includes(document.id) ? 'Linked' : 'Link' }}
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
export class DocumentPickerComponent {
  private readonly repository = inject(DocumentRepository);

  /** Documents that are linked already: shown, but not linked twice. */
  readonly linkedIds = input<string[]>([]);
  /** A link is being made. */
  readonly busy = input(false);
  readonly picked = output<DocumentSummaryDto>();
  readonly closed = output<void>();

  readonly search = new FormControl('', { nonNullable: true });
  readonly term = signal('');

  readonly documents = rxResource({
    params: () => ({ q: this.term() }),
    stream: ({ params }) =>
      this.repository
        .list({ q: params.q || null, page: 1, pageSize: DOCUMENT_PICKER_PAGE_SIZE })
        .pipe(map((page) => page.items)),
  });
  readonly list = keptValueOf(this.documents);

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
}
