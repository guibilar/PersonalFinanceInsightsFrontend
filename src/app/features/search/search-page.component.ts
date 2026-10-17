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
import { debounceTime, filter, map, of } from 'rxjs';
import { SearchRepository } from '../../core/api/search-repository';
import { SearchHit } from '../../core/models/outputs/search-output-dto';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { IconComponent, IconName } from '../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { formatCurrency, formatDay } from '../../shared/utils/format';
import { plainClick } from '../../shared/utils/links';

/** The shortest search that the server takes. */
export const MIN_SEARCH = 2;

const KIND_ICONS: Record<string, IconName> = {
  transaction: 'banknote',
  document: 'file-text',
  task: 'list-checks',
  item: 'house',
  person: 'user',
  entry: 'book-open',
};

/** The name of a module's section: "Money", "Documents", … */
const SECTION_NAMES: Record<string, string> = {
  Money: 'Transactions',
  Documents: 'Documents',
  Tasks: 'Tasks',
  Home: 'Items',
  People: 'People',
  Journal: 'Journal',
};

/**
 * Search (design canvas, "Search"): one search across all modules, with the text in the address (`/search?q=dishwasher`).
 * The best hits of each module show in sections; "Show all" asks one module for more (`&module=Tasks`).
 */
@Component({
  selector: 'app-search-page',
  imports: [ReactiveFormsModule, RouterLink, ErrorStateComponent, IconComponent, SkeletonComponent],
  template: `
    <div class="mb-3">
      <h1 class="h3 mb-1">Search</h1>
      <p class="text-body-secondary mb-0">One search across every module</p>
    </div>

    <div class="search-box mb-3">
      <app-icon name="search" [size]="18" class="search-icon text-body-secondary" />
      <label class="visually-hidden" for="search-everything">Search everything</label>
      <input
        id="search-everything"
        type="search"
        class="form-control form-control-lg"
        placeholder="Search everything"
        maxlength="200"
        autocomplete="off"
        [formControl]="text"
      />
    </div>

    @if (module(); as m) {
      <p class="small mb-3" data-testid="module">
        Only {{ section(m) }}.
        <a [routerLink]="[]" [queryParams]="{ module: null }" queryParamsHandling="merge"
          >Search all modules</a
        >
      </p>
    }

    @if (term().length < min) {
      <p class="text-body-secondary" data-testid="hint">
        Type at least {{ min }} characters. The search looks at transactions, documents (with their
        text), tasks, home items, people and the journal.
      </p>
    } @else if (results.error() && !answer()) {
      <app-error-state message="Could not search." (retry)="results.reload()" />
    } @else if (!answer()) {
      <app-skeleton [lines]="4" height="3.5rem" />
    } @else {
      <p class="small text-body-secondary" data-testid="summary">{{ summary() }}</p>
      @if (failed().length > 0) {
        <p class="alert alert-warning py-2" data-testid="failed">
          {{ failed().join(', ') }} could not search.
        </p>
      }
      @for (group of found(); track group.module) {
        <section
          class="mb-4"
          [attr.data-module]="group.module"
          [attr.aria-labelledby]="'module-' + group.module"
        >
          <h2 class="section-title" [id]="'module-' + group.module">{{ section(group.module) }}</h2>
          <ul class="list-unstyled d-flex flex-column gap-2 mb-2">
            @for (hit of group.hits; track hit.id) {
              <li>
                <a class="card hit" [attr.href]="hit.link" (click)="open($event, hit)">
                  <span class="card-body d-flex gap-3 align-items-center">
                    <span class="hit-icon" aria-hidden="true"
                      ><app-icon [name]="icon(hit)" [size]="18"
                    /></span>
                    <span class="flex-grow-1 min-w-0">
                      <span class="d-block fw-medium text-truncate">{{ hit.title }}</span>
                      @if (line(hit); as l) {
                        <span class="d-block small text-body-secondary text-truncate">{{ l }}</span>
                      }
                    </span>
                    @if (hit.amount !== null) {
                      <span class="amount text-nowrap" [class.text-success]="hit.amount > 0">{{
                        money(hit.amount)
                      }}</span>
                    }
                  </span>
                </a>
              </li>
            }
          </ul>
          @if (!module() && group.total > group.hits.length) {
            <a
              class="small"
              [routerLink]="[]"
              [queryParams]="{ module: group.module }"
              queryParamsHandling="merge"
              [attr.data-more]="group.module"
              >Show all {{ group.total }}</a
            >
          }
        </section>
      }
    }
  `,
  styles: `
    .search-box {
      position: relative;
      max-width: 40rem;
      .form-control {
        padding-left: 2.75rem;
      }
    }
    .search-icon {
      position: absolute;
      left: 1rem;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
    }
    .section-title {
      font-size: 0.8125rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--bs-secondary-color);
      margin-bottom: 0.5rem;
    }
    .hit {
      color: inherit;
      text-decoration: none;
      &:hover {
        border-color: var(--bs-primary-border-subtle);
      }
    }
    .hit-icon {
      flex: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 50%;
      background: var(--bs-primary-bg-subtle);
      color: var(--bs-primary-text-emphasis);
    }
    .amount {
      font-variant-numeric: tabular-nums;
    }
    .min-w-0 {
      min-width: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchPageComponent {
  private readonly repository = inject(SearchRepository);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly min = MIN_SEARCH;

  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly term = computed(() => (this.query().get('q') ?? '').trim().replace(/\s+/g, ' '));
  readonly module = computed(() => this.query().get('module')?.trim() || null);

  readonly results = rxResource({
    params: () => ({ q: this.term(), module: this.module() }),
    stream: ({ params }) =>
      params.q.length < MIN_SEARCH
        ? of(undefined)
        : this.repository.search(params.q, params.module),
  });
  readonly answer = computed(() => (this.results.hasValue() ? this.results.value() : undefined));
  /** The modules with hits. */
  readonly found = computed(() => this.answer()?.modules.filter((m) => m.hits.length > 0) ?? []);
  readonly failed = computed(
    () =>
      this.answer()
        ?.modules.filter((m) => m.status === 'Failed')
        .map((m) => m.module) ?? [],
  );
  /** "4 results in 4 modules", "1 result in 1 module", "No results for “x”". */
  readonly summary = computed(() => {
    const answer = this.answer();
    if (!answer) return '';
    const modules = this.found().length;
    if (answer.total === 0) return `No results for “${answer.query}”.`;
    const results = answer.total === 1 ? '1 result' : `${answer.total} results`;
    return `${results} in ${modules === 1 ? '1 module' : `${modules} modules`}`;
  });

  readonly text = new FormControl(this.term(), { nonNullable: true });

  constructor() {
    this.text.valueChanges
      .pipe(
        map((value) => value.trim()),
        debounceTime(300),
        // Against the address, not the last value typed: back or forward sets the box without an event, and the same
        // search typed again afterwards has to run.
        filter((q) => q.replace(/\s+/g, ' ') !== this.term()),
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

    // Back or forward to another search: the box shows it.
    effect(() => {
      const q = this.term();
      untracked(() => {
        if (this.text.value.trim().replace(/\s+/g, ' ') !== q)
          this.text.setValue(q, { emitEvent: false });
      });
    });
  }

  section(module: string): string {
    return SECTION_NAMES[module] ?? module;
  }

  icon(hit: SearchHit): IconName {
    return KIND_ICONS[hit.kind] ?? 'search';
  }

  /** The second line: the text, and the day ("Sep 8, 2025"). */
  line(hit: SearchHit): string {
    return [hit.day ? formatDay(hit.day) : null, hit.text].filter(Boolean).join(' · ');
  }

  money(amount: number): string {
    return formatCurrency(amount);
  }

  /** Opens a hit: its link can have a query (`/money/transactions?id=…`), so it goes to the router as a URL. */
  open(event: Event, hit: SearchHit): void {
    // Ctrl or Cmd and the like: the browser opens the link's href in a new tab.
    if (!hit.link || !plainClick(event)) return;
    event.preventDefault();
    void this.router.navigateByUrl(hit.link);
  }
}
