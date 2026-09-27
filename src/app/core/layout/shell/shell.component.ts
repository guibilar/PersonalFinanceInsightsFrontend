import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { ThemeService } from '../../theme/theme.service';
import { IconComponent, IconName } from '../../../shared/ui/icon/icon.component';

const COLLAPSED_STORAGE_KEY = 'sidebar-collapsed';

interface NavLink {
  path: string;
  label: string;
  icon: IconName;
  exact: boolean;
}

/** Sidebar layout: collapsible to icons on desktop, a slide-out menu on small screens. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  protected readonly theme = inject(ThemeService);

  readonly links: NavLink[] = [
    { path: '/', label: 'Dashboard', icon: 'dashboard', exact: true },
    { path: '/transactions', label: 'Transactions', icon: 'transactions', exact: false },
    { path: '/budgets', label: 'Budgets', icon: 'budgets', exact: false },
  ];

  readonly collapsed = signal(readFlag(COLLAPSED_STORAGE_KEY));
  readonly mobileOpen = signal(false);

  constructor() {
    // Close the slide-out menu after navigating.
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.mobileOpen.set(false));
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
