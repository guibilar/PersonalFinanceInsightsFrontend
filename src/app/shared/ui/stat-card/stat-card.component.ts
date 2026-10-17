import { NgTemplateOutlet } from '@angular/common';
import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent, IconName } from '../icon/icon.component';

export type StatTone = 'good' | 'bad' | 'warning' | 'neutral';

/**
 * A headline number (KPI) with an icon and an optional coloured hint line.
 * `compact` puts the icon beside the label, so a narrow tile gives the number its full width.
 */
@Component({
  selector: 'app-stat-card',
  imports: [IconComponent, NgTemplateOutlet],
  template: `
    <div class="card h-100" [class.compact]="compact()">
      @if (compact()) {
        <div class="card-body">
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="stat-icon"><app-icon [name]="icon()" [size]="16" /></span>
            <p class="small text-body-secondary fw-medium mb-0 min-w-0">{{ label() }}</p>
          </div>
          <ng-container *ngTemplateOutlet="figures" />
        </div>
      } @else {
        <div class="card-body d-flex gap-3 align-items-start">
          <span class="stat-icon"><app-icon [name]="icon()" /></span>
          <div class="min-w-0">
            <p class="small text-body-secondary fw-medium mb-1">{{ label() }}</p>
            <ng-container *ngTemplateOutlet="figures" />
          </div>
        </div>
      }
    </div>
    <ng-template #figures>
      <p class="stat-value mb-1 text-truncate">{{ value() }}</p>
      @if (hint(); as hint) {
        <p
          class="stat-hint small mb-0 d-flex align-items-start gap-1"
          [class.text-success]="tone() === 'good'"
          [class.text-danger]="tone() === 'bad'"
          [class.text-warning-emphasis]="tone() === 'warning'"
          [class.text-body-secondary]="tone() === 'neutral'"
        >
          @if (hintIcon(); as hintIcon) {
            <app-icon class="stat-hint-icon" [name]="hintIcon" [size]="14" />
          }
          <span class="min-w-0">{{ hint }}</span>
        </p>
      }
    </ng-template>
  `,
  styles: `
    /* The colour of the module around it (data-accent), or terracotta. */
    .stat-icon {
      display: inline-flex;
      padding: 0.625rem;
      border-radius: 50%;
      background: var(--accent-bg, var(--bs-primary-bg-subtle));
      color: var(--accent, var(--bs-primary-text-emphasis));
      flex-shrink: 0;
    }
    .compact .stat-icon {
      padding: 0.375rem;
    }
    /* A long hint wraps under its trend icon, inside the card. */
    .stat-hint {
      overflow-wrap: anywhere;
    }
    .stat-hint-icon {
      flex-shrink: 0;
      margin-top: 0.2em;
    }
    /* The number in Fraunces: the figure is what you read first. */
    .stat-value {
      font-family: var(--hestia-display-font);
      font-size: 1.5rem;
      font-weight: 600;
      line-height: 1.2;
      font-variation-settings: 'SOFT' 100;
      color: var(--bs-emphasis-color);
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
  readonly compact = input(false, { transform: booleanAttribute });
}
