import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-navigation',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navigation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NavigationComponent {
  readonly links = [
    { path: '/', label: 'Dashboard', exact: true },
    { path: '/transactions', label: 'Transactions', exact: false },
    { path: '/budgets', label: 'Budgets', exact: false }
  ];

  readonly isMenuOpen = signal(false);

  toggleMenu(): void {
    this.isMenuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }
}
