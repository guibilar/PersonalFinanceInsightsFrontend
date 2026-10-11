import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IconComponent, IconName } from '../../shared/ui/icon/icon.component';
import { StatementImportLauncher } from '../../core/data/statement-import-launcher.service';
import { moneyPath } from './money-paths';

export interface MoneyNavLink {
  path: string;
  label: string;
  icon: IconName;
  exact: boolean;
}

export interface MoneyNavGroup {
  label: string;
  links: MoneyNavLink[];
  /** Setup pages: visited now and then, so they sit lower and quieter. */
  quiet?: boolean;
}

/** The Money sub-menu: the groups of the old finance sidebar. */
export const MONEY_NAV: readonly MoneyNavGroup[] = [
  {
    label: 'Overview',
    links: [
      { path: moneyPath(), label: 'Dashboard', icon: 'dashboard', exact: true },
      { path: moneyPath('net-worth'), label: 'Net worth', icon: 'trending-up', exact: false },
      { path: moneyPath('review'), label: 'Review', icon: 'calendar', exact: false },
    ],
  },
  {
    label: 'Spending',
    links: [
      {
        path: moneyPath('transactions'),
        label: 'Transactions',
        icon: 'transactions',
        exact: false,
      },
      { path: moneyPath('budgets'), label: 'Budgets', icon: 'budgets', exact: false },
      { path: moneyPath('subscriptions'), label: 'Subscriptions', icon: 'refresh', exact: false },
    ],
  },
  {
    label: 'Setup',
    quiet: true,
    links: [
      { path: moneyPath('accounts'), label: 'Accounts', icon: 'bank', exact: false },
      { path: moneyPath('categories'), label: 'Categories', icon: 'tag', exact: false },
      { path: moneyPath('tags'), label: 'Tags', icon: 'hash', exact: false },
      { path: moneyPath('rules'), label: 'Rules', icon: 'rules', exact: false },
    ],
  },
];

/**
 * The Money module's frame: its sub-menu and "Import statements" beside the finance pages on wide screens, and a row
 * that scrolls sideways above them on narrow ones.
 */
@Component({
  selector: 'app-money-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  template: `
    <div class="money-layout">
      <nav class="money-nav" aria-label="Money">
        <p class="money-title">
          <app-icon name="banknote" [size]="18" />
          <span>Money</span>
        </p>
        <button
          type="button"
          class="btn btn-primary btn-sm import-button"
          (click)="importer.open()"
        >
          <app-icon name="upload" [size]="16" />
          <span>Import statements</span>
        </button>
        <div class="money-groups">
          @for (group of groups; track group.label) {
            <div class="money-group" [class.quiet]="group.quiet">
              <p class="money-group-label" [id]="'money-nav-' + group.label">{{ group.label }}</p>
              <ul class="money-list" [attr.aria-labelledby]="'money-nav-' + group.label">
                @for (link of group.links; track link.path) {
                  <li>
                    <a
                      class="money-item"
                      [routerLink]="link.path"
                      routerLinkActive="active"
                      [routerLinkActiveOptions]="{ exact: link.exact }"
                      ariaCurrentWhenActive="page"
                    >
                      <app-icon [name]="link.icon" [size]="18" />
                      <span>{{ link.label }}</span>
                    </a>
                  </li>
                }
              </ul>
            </div>
          }
        </div>
      </nav>
      <div class="money-content">
        <router-outlet />
      </div>
    </div>
  `,
  styleUrl: './money-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoneyLayoutComponent {
  protected readonly importer = inject(StatementImportLauncher);
  readonly groups = MONEY_NAV;
}
