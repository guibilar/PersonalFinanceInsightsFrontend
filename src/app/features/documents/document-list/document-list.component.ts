import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { DocumentRepository } from '../../../core/api/document-repository';
import {
  DOCUMENT_KINDS,
  DocumentKind,
  DocumentSummaryDto,
} from '../../../core/models/outputs/document-output-dto';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { PaginatedContentComponent } from '../../../shared/ui/paginated-content/paginated-content.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { formatDay } from '../../../shared/utils/format';
import { keptValueOf, valueOf } from '../../../shared/utils/resource-value';
import { KIND_FILTER_LABELS, daysUntil, expiryText, expirySoonRange, ocrLabel } from '../documents';

const PAGE_SIZE = 20;

/**
 * The documents: kind filters, a full-text search, the ones that expire in the next 30 days, and all of them, newest
 * first (best match first with a search). The filters live in the address (`?kind=Warranty&q=kettle&page=2`), so the
 * way back from a document keeps them.
 */
@Component({
  selector: 'app-document-list',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ErrorStateComponent,
    IconComponent,
    PaginatedContentComponent,
    SkeletonComponent,
  ],
  templateUrl: './document-list.component.html',
  styleUrl: './document-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentListComponent {
  private readonly repository = inject(DocumentRepository);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  /** A read-only user (T60) gets no "Add document". */
  readonly canWrite = inject(AuthService).canWrite;

  readonly kinds = DOCUMENT_KINDS;
  readonly kindLabels = KIND_FILTER_LABELS;
  private readonly today = new Date();

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  /** The kind filter, or null for All. An unknown kind in the address counts as All. */
  readonly kind = computed<DocumentKind | null>(() => {
    const kind = this.params().get('kind');
    return DOCUMENT_KINDS.find((k) => k === kind) ?? null;
  });
  readonly q = computed(() => this.params().get('q')?.trim() ?? '');
  readonly page = computed(() => Math.max(1, Number(this.params().get('page')) || 1));

  readonly search = new FormControl(this.route.snapshot.queryParamMap.get('q') ?? '', {
    nonNullable: true,
  });

  readonly documents = rxResource({
    params: () => ({ kind: this.kind(), q: this.q(), page: this.page() }),
    stream: ({ params }) => this.repository.list({ ...params, pageSize: PAGE_SIZE }),
  });
  /** The last page stays while the next one loads, so the search box keeps its focus. */
  readonly result = keptValueOf(this.documents);

  /** The ones that expire from today to 30 days ahead, soonest first. Not shown during a search. */
  readonly expiring = rxResource({
    params: () => (this.q() ? undefined : { kind: this.kind() }),
    stream: ({ params }) =>
      this.repository
        .list({ ...params, ...expirySoonRange(this.today), pageSize: 50 })
        .pipe(
          map((page) =>
            [...page.items].sort((a, b) => (a.expiresOn ?? '').localeCompare(b.expiresOn ?? '')),
          ),
        ),
  });
  readonly expiringSoon = computed(() => valueOf(this.expiring) ?? []);

  constructor() {
    this.search.valueChanges
      .pipe(
        map((value) => value.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((q) => this.setFilters({ q: q || null, page: null }));

    // Back or forward to another search: the box shows it.
    effect(() => {
      const q = this.q();
      untracked(() => {
        if (this.search.value.trim() !== q) this.search.setValue(q, { emitEvent: false });
      });
    });
  }

  selectKind(kind: DocumentKind | null): void {
    this.setFilters({ kind, page: null });
  }

  goToPage(page: number): void {
    this.setFilters({ page: page > 1 ? page : null });
  }

  clearSearch(): void {
    this.search.setValue('', { emitEvent: false });
    this.setFilters({ q: null, page: null });
  }

  /** "Warranty · Nov 9, 2026" (the issue day, else the day it was added). */
  subtitle(document: DocumentSummaryDto): string {
    const day = document.issuedOn ?? document.createdAt;
    return `${document.kind} · ${formatDay(day)}`;
  }

  expiry(document: DocumentSummaryDto): string {
    return document.expiresOn ? expiryText(daysUntil(document.expiresOn, this.today)) : '';
  }

  /** Within 7 days: shown stronger. */
  expiresVerySoon(document: DocumentSummaryDto): boolean {
    return !!document.expiresOn && daysUntil(document.expiresOn, this.today) <= 7;
  }

  ocr(document: DocumentSummaryDto): string | null {
    return ocrLabel(document.ocrStatus);
  }

  private setFilters(changes: Record<string, string | number | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: changes,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
