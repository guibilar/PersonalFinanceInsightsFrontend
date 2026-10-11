import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { ReportsRepository } from '../../core/api/reports-repository';
import { BudgetRepository } from '../../core/api/budget-repository';
import { DataChangesService } from '../../core/data/data-changes.service';
import { Status } from '../../core/models/enums/status';
import { MODULES } from '../../core/modules/module-registry';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { FinanceTilesComponent } from '../dashboard/finance-tiles/finance-tiles.component';
import { moneyPath } from '../money/money-paths';

/**
 * Today: a card from each module, the finance tiles first (D11). Until the Today API comes (T10), the page loads the
 * finance tiles itself, and the other modules show a placeholder card.
 */
@Component({
  selector: 'app-today',
  imports: [RouterLink, IconComponent, FinanceTilesComponent],
  template: `
    <div class="mb-4">
      <h1 class="h3 mb-1">Today</h1>
      <p class="text-body-secondary mb-0">{{ dateLabel() }}</p>
    </div>

    <section class="mb-4" aria-labelledby="today-money">
      <div class="d-flex align-items-center gap-2 mb-2">
        <h2 id="today-money" class="h6 mb-0">Money</h2>
        <a [routerLink]="moneyHome" class="small ms-auto text-decoration-none">Open Money</a>
      </div>
      <app-finance-tiles
        [monthReport]="monthReport"
        [yearReport]="yearReport"
        [cashFlow]="cashFlow"
        [netWorth]="netWorth"
        [budgets]="budgets"
        [today]="today()"
      />
    </section>

    <section aria-labelledby="today-more">
      <h2 id="today-more" class="h6 mb-2">From the other modules</h2>
      <div class="row row-cols-1 row-cols-sm-2 row-cols-xl-3 g-3">
        @for (module of comingSoon; track module.id) {
          <div class="col">
            <div class="card h-100 placeholder-card" [attr.data-module]="module.id">
              <div class="card-body d-flex gap-3 align-items-start">
                <span class="module-icon"><app-icon [name]="module.icon" /></span>
                <div class="min-w-0">
                  <p class="fw-semibold mb-1">{{ module.name }}</p>
                  <p class="small text-body-secondary mb-0">
                    Coming soon. Its cards will show here.
                  </p>
                </div>
              </div>
            </div>
          </div>
        }
      </div>
    </section>
  `,
  styles: `
    .placeholder-card {
      border-style: dashed;
      background: transparent;
    }

    .module-icon {
      display: inline-flex;
      padding: 0.625rem;
      border-radius: var(--bs-border-radius-lg);
      background: var(--bs-secondary-bg);
      color: var(--bs-secondary-color);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodayComponent {
  private readonly reportsRepository = inject(ReportsRepository);
  private readonly budgetRepository = inject(BudgetRepository);
  /** A statement imported from Money or Capture reloads the tiles. */
  private readonly dataChanges = inject(DataChangesService);

  protected readonly moneyHome = moneyPath();
  protected readonly comingSoon = MODULES.filter((module) => module.status === 'coming-soon');

  /** Read again with the data, so a page left open into the next day shows that day. */
  readonly today = computed(() => {
    this.dataChanges.version();
    return new Date();
  });
  readonly dateLabel = computed(() =>
    this.today().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' }),
  );

  // The same requests as the Dashboard's tiles.
  readonly yearReport = rxResource({
    params: () => this.dataChanges.version(),
    stream: () => this.reportsRepository.getMonthlyCategorizedGraph(),
  });
  readonly monthReport = rxResource({
    params: () => this.dataChanges.version(),
    stream: () => this.reportsRepository.getCurrentMonthCategorizedGraph(),
  });
  readonly cashFlow = rxResource({
    params: () => this.dataChanges.version(),
    stream: () => this.reportsRepository.getCashFlow(),
  });
  readonly netWorth = rxResource({
    params: () => this.dataChanges.version(),
    stream: () => this.reportsRepository.getNetWorth(),
  });
  readonly budgets = rxResource({
    params: () => this.dataChanges.version(),
    stream: () => this.budgetRepository.filter({ status: Status.Active, page: 1, pageSize: 1000 }),
  });
}
