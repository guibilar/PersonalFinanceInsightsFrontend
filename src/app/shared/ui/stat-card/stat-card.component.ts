import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent, IconName } from '../icon/icon.component';

export type StatTone = 'good' | 'bad' | 'neutral';

/** A headline number (KPI) with an icon and an optional coloured hint line. */
@Component({
  selector: 'app-stat-card',
  imports: [IconComponent],
  template: `
    <div class="card h-100">
      <div class="card-body d-flex gap-3 align-items-start">
        <span class="stat-icon"><app-icon [name]="icon()" /></span>
        <div class="min-w-0">
          <p class="small text-body-secondary fw-medium mb-1">{{ label() }}</p>
          <p class="h4 fw-semibold mb-1 text-truncate">{{ value() }}</p>
          @if (hint(); as hint) {
            <p
              class="small mb-0 d-flex align-items-center gap-1"
              [class.text-success]="tone() === 'good'"
              [class.text-danger]="tone() === 'bad'"
              [class.text-body-secondary]="tone() === 'neutral'"
            >
              @if (hintIcon(); as hintIcon) {
                <app-icon [name]="hintIcon" [size]="14" />
              }
              {{ hint }}
            </p>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .stat-icon {
      display: inline-flex;
      padding: 0.625rem;
      border-radius: var(--bs-border-radius-lg);
      background: var(--bs-primary-bg-subtle);
      color: var(--bs-primary-text-emphasis);
    }
    .min-w-0 {
      min-width: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly icon = input.required<IconName>();
  readonly hint = input<string | null>();
  readonly hintIcon = input<IconName | null>();
  readonly tone = input<StatTone>('neutral');
}
