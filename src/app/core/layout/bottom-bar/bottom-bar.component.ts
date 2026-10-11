import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { MAIN_MENU } from '../../modules/module-registry';

/** The main menu as a bar at the bottom of small screens, like the Android app. Capture is the round centre action. */
@Component({
  selector: 'app-bottom-bar',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  host: { role: 'navigation', 'aria-label': 'Main menu' },
  template: `
    @for (item of items; track item.route) {
      <a
        class="bottom-item"
        [class.primary]="item.primary"
        [routerLink]="item.route"
        routerLinkActive="active"
        ariaCurrentWhenActive="page"
      >
        <span class="bottom-icon"
          ><app-icon [name]="item.icon" [size]="item.primary ? 24 : 22"
        /></span>
        <span class="bottom-label">{{ item.label }}</span>
      </a>
    }
  `,
  styleUrl: './bottom-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BottomBarComponent {
  readonly items = MAIN_MENU;
}
