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
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { BottomBarComponent } from '../bottom-bar/bottom-bar.component';
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
import {
  TransactionAddPanel,
  transactionLink,
} from '../../../features/transactions/transaction-add-panel/transaction-add-panel';
import { TransactionOutputDto } from '../../models/outputs/transaction-output-dto';
import { DataChangesService } from '../../data/data-changes.service';
import { StatementImportLauncher } from '../../data/statement-import-launcher.service';
import { TransactionAddLauncher } from '../../data/transaction-add-launcher.service';
import { MAIN_MENU, activeModules } from '../../modules/module-registry';
import { amountsHidden, toggleAmountsHidden } from '../../../shared/utils/privacy';

const COLLAPSED_STORAGE_KEY = 'sidebar-collapsed';

/**
 * The app frame. The main menu (Today, Timeline, Capture, Modules, Search) and the active modules are in a sidebar,
 * collapsible to icons, on wide screens. Small screens have a bottom bar with the main menu, and a slide-out sidebar
 * for the modules and the account. A module brings its own sub-menu (Money: the finance pages).
 */
@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    IconComponent,
    BottomBarComponent,
    ModalComponent,
    ChangePasswordFormComponent,
    ConfirmDialogComponent,
    StatementImportComponent,
    TransactionAddPanel,
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

  readonly mainMenu = MAIN_MENU;
  readonly modules = activeModules();

  readonly collapsed = signal(readFlag(COLLAPSED_STORAGE_KEY));
  readonly mobileOpen = signal(false);
  readonly changingPassword = signal(false);
  readonly confirmingSignOutOthers = signal(false);
  /** The import panel opens from Money and Capture; the shell shows it over any page. */
  protected readonly importer = inject(StatementImportLauncher);
  /** "Add transaction" opens from Capture; the shell shows it over any page too. */
  protected readonly adder = inject(TransactionAddLauncher);
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
    this.importer.close();
    this.dataChanges.changed();
    this.toasts.success(describeImport(summary));
  }

  onTransactionAdded(added: TransactionOutputDto): void {
    this.adder.close();
    this.adder.lastAdded.set({ date: added.date, accountId: added.accountId });
    this.dataChanges.changed();
    this.toasts.success(`Added “${added.description}” to ${added.accountName}`, {
      label: 'View',
      ...transactionLink(added),
    });
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
