import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  NavigationEnd,
  NavigationSkipped,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { ThemeService } from '../../theme/theme.service';
import { IconComponent, IconName } from '../../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AuthService } from '../../auth/auth.service';
import { ChangePasswordFormComponent } from '../../../features/account/change-password-form.component';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import {
  ImportSummary,
  StatementImportComponent,
  describeImport,
} from '../../../features/transactions/statement-import/statement-import.component';
import { DataChangesService } from '../../data/data-changes.service';
import { amountsHidden, toggleAmountsHidden } from '../../../shared/utils/privacy';

const COLLAPSED_STORAGE_KEY = 'sidebar-collapsed';

interface NavLink {
  path: string;
  label: string;
  icon: IconName;
  exact: boolean;
}

interface NavGroup {
  label: string;
  links: NavLink[];
  /** Setup pages: visited now and then, so they sit lower and quieter. */
  quiet?: boolean;
}

/** Sidebar layout: collapsible to icons on desktop, a slide-out menu on small screens. */
@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    IconComponent,
    ModalComponent,
    ChangePasswordFormComponent,
    ConfirmDialogComponent,
    StatementImportComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);
  protected readonly amountsHidden = amountsHidden;
  protected readonly toggleAmountsHidden = toggleAmountsHidden;
  private readonly toasts = inject(ToastService);

  readonly groups: NavGroup[] = [
    {
      label: 'Overview',
      links: [
        { path: '/', label: 'Dashboard', icon: 'dashboard', exact: true },
        { path: '/net-worth', label: 'Net worth', icon: 'trending-up', exact: false },
        { path: '/review', label: 'Review', icon: 'calendar', exact: false },
      ],
    },
    {
      label: 'Spending',
      links: [
        { path: '/transactions', label: 'Transactions', icon: 'transactions', exact: false },
        { path: '/budgets', label: 'Budgets', icon: 'budgets', exact: false },
        { path: '/subscriptions', label: 'Subscriptions', icon: 'refresh', exact: false },
      ],
    },
    {
      label: 'Setup',
      quiet: true,
      links: [
        { path: '/accounts', label: 'Accounts', icon: 'bank', exact: false },
        { path: '/categories', label: 'Categories', icon: 'tag', exact: false },
        { path: '/tags', label: 'Tags', icon: 'hash', exact: false },
        { path: '/rules', label: 'Rules', icon: 'rules', exact: false },
      ],
    },
  ];

  readonly collapsed = signal(readFlag(COLLAPSED_STORAGE_KEY));
  readonly mobileOpen = signal(false);
  readonly changingPassword = signal(false);
  readonly confirmingSignOutOthers = signal(false);
  readonly importing = signal(false);
  protected readonly dataChanges = inject(DataChangesService);

  constructor() {
    // Close the slide-out menu after navigating.
    inject(Router)
      .events.pipe(
        // Skipped too: the link to the page already open navigates nowhere, but the menu was still tapped.
        filter((event) => event instanceof NavigationEnd || event instanceof NavigationSkipped),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.mobileOpen.set(false));
  }

  onImported(summary: ImportSummary): void {
    this.importing.set(false);
    this.dataChanges.changed();
    this.toasts.success(describeImport(summary));
  }

  onPasswordChanged(): void {
    this.changingPassword.set(false);
    this.toasts.success('Password changed. Other devices were signed out.');
  }

  signOutOtherDevices(): void {
    this.confirmingSignOutOthers.set(false);
    this.auth.signOutOtherDevices().subscribe({
      next: ({ count }) =>
        this.toasts.success(
          count === 0
            ? 'No other devices were signed in'
            : `Signed out ${count} other ${count === 1 ? 'session' : 'sessions'}`,
        ),
      error: () => this.toasts.error('Could not sign out the other devices. Try again.'),
    });
  }

  signOut(): void {
    this.auth.logout().subscribe({
      error: () => this.toasts.error('Could not sign out. Try again.'),
    });
  }

  toggleCollapsed(): void {
    this.collapsed.update((value) => !value);
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(this.collapsed()));
    } catch {
      // Not remembered when storage is unavailable.
    }
  }
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}
