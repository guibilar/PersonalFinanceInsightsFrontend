import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { ReportsRepository } from '../../core/api/reports-repository';
import { CategoryRuleRepository } from '../../core/api/category-rule-repository';
import { TransactionRepository } from '../../core/api/transaction-repository';
import { CategoryOutputDto } from '../../core/models/outputs/category-output-dto';
import { UncategorisedMerchantDto } from '../../core/models/outputs/insights-output-dto';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { valueOf } from '../../shared/utils/resource-value';
import { conflictDetail } from '../../shared/utils/problem-detail';

/** Merchants listed before "Show all". */
const SHOWN = 6;

/**
 * The merchants whose spending is left in Other because no rule names them, most transactions first: pick a category
 * and a rule is added for the keyword (editable) and the rules applied, sorting them all at once. Keeping one in Other
 * adds a rule into Other, which says it belongs there: it isn't listed again.
 */
@Component({
  selector: 'app-unsorted-merchants',
  imports: [CurrencyPipe],
  template: `
    @if (merchants().length > 0) {
      <section id="unsorted" class="card mb-3 border-info-subtle" aria-labelledby="unsorted-title">
        <div class="card-body">
          <h2 id="unsorted-title" class="h6 mb-1">Sort what's left in Other</h2>
          <p class="small text-body-secondary mb-3">
            {{ report()!.transactionCount }}
            {{ report()!.transactionCount === 1 ? 'transaction is' : 'transactions are' }} in Other
            because no rule names
            {{ report()!.transactionCount === 1 ? 'its merchant' : 'their merchants' }}. Pick a
            category, or keep it in Other: a rule is added and applied to all of them.
          </p>
          <ul class="list-group list-group-flush">
            @for (merchant of shown(); track merchant.keyword) {
              <li class="list-group-item px-0 d-flex flex-wrap align-items-center gap-2">
                <div class="flex-grow-1 unsorted-name">
                  <label class="visually-hidden" [for]="'unsorted-keyword-' + $index"
                    >Keyword for {{ merchant.keyword }}</label
                  >
                  <input
                    [id]="'unsorted-keyword-' + $index"
                    class="form-control form-control-sm fw-medium text-uppercase"
                    maxlength="100"
                    [value]="keywordOf(merchant)"
                    (input)="setKeyword(merchant, $any($event.target).value)"
                  />
                  <div
                    class="small text-body-secondary text-truncate mt-1"
                    [title]="merchant.examples.join('\\n')"
                  >
                    {{ merchant.count }}
                    {{ merchant.count === 1 ? 'transaction' : 'transactions' }} ·
                    {{ merchant.spending | currency }} · like “{{ merchant.examples[0] }}”
                  </div>
                </div>
                <label class="visually-hidden" [for]="'unsorted-category-' + $index"
                  >Category for {{ merchant.keyword }}</label
                >
                <select
                  [id]="'unsorted-category-' + $index"
                  class="form-select form-select-sm w-auto"
                  [disabled]="busy() === merchant.keyword"
                  (change)="
                    choose(merchant, $any($event.target).value); $any($event.target).value = ''
                  "
                >
                  <option value="" selected>Categorise as…</option>
                  @for (category of choices(); track category.id) {
                    <option [value]="category.id">{{ category.name }}</option>
                  }
                  @if (other(); as other) {
                    <option disabled>──────────</option>
                    <option [value]="other.id">Keep in {{ other.name }}</option>
                  }
                </select>
              </li>
            }
          </ul>
          @if (merchants().length > shown().length) {
            <button type="button" class="btn btn-link btn-sm px-0" (click)="showAll.set(true)">
              Show all {{ merchants().length }}
            </button>
          }
        </div>
      </section>
    }
  `,
  styles: `
    .unsorted-name {
      min-width: 12rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnsortedMerchantsComponent {
  private readonly reports = inject(ReportsRepository);
  private readonly rules = inject(CategoryRuleRepository);
  private readonly transactions = inject(TransactionRepository);
  private readonly toasts = inject(ToastService);

  readonly categories = input<CategoryOutputDto[]>([]);
  /** A rule was added (and the rules applied). */
  readonly ruleAdded = output<void>();

  readonly uncategorised = rxResource({ stream: () => this.reports.getUncategorised() });
  readonly report = computed(() => valueOf(this.uncategorised));
  readonly merchants = computed(() => this.report()?.merchants ?? []);
  readonly showAll = signal(false);
  readonly shown = computed(() =>
    this.showAll() ? this.merchants() : this.merchants().slice(0, SHOWN),
  );
  /** Keywords as edited, by the suggested one. */
  readonly keywords = signal<Record<string, string>>({});
  /** The merchant whose rule is being added. */
  readonly busy = signal<string | null>(null);

  /** The other categories; Other, which they are in already, is offered apart, to keep them there. */
  readonly choices = computed(() => this.categories().filter((c) => !c.isFallback));
  readonly other = computed(() => this.categories().find((c) => c.isFallback) ?? null);

  setKeyword(merchant: UncategorisedMerchantDto, keyword: string): void {
    this.keywords.set({ ...this.keywords(), [merchant.keyword]: keyword });
  }

  keywordOf(merchant: UncategorisedMerchantDto): string {
    return this.keywords()[merchant.keyword] ?? merchant.keyword;
  }

  choose(merchant: UncategorisedMerchantDto, categoryId: string): void {
    const keyword = this.keywordOf(merchant).trim().toUpperCase();
    if (!categoryId || !keyword || this.busy()) return;
    const category = this.categories().find((c) => c.id === categoryId);
    this.busy.set(merchant.keyword);
    this.rules
      .create({ keyword, categoryId })
      .pipe(switchMap(() => this.transactions.applyRules()))
      .subscribe({
        next: ({ updated }) => {
          this.busy.set(null);
          this.toasts.success(
            category?.isFallback
              ? `Rule “${keyword}” added: it stays in ${category.name} and isn't listed here any more`
              : `Rule “${keyword}” added: ${updated} ${updated === 1 ? 'transaction' : 'transactions'} now in ${category?.name ?? 'that category'}`,
          );
          this.uncategorised.reload();
          this.ruleAdded.emit();
        },
        error: (error: unknown) => {
          this.busy.set(null);
          this.toasts.error(conflictDetail(error, `Could not add a rule for “${keyword}”.`));
          // A 409 may mean the rule was added and only applying failed: what is left changed either way.
          this.uncategorised.reload();
          this.ruleAdded.emit();
        },
      });
  }
}
