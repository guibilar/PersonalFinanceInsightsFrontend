import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Card with a left-aligned title, optional subtitle and an optional [card-actions] slot. */
@Component({
  selector: 'app-card-wrapper',
  templateUrl: './card-wrapper.component.html',
  host: { class: 'd-block h-100' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardWrapperComponent {
  readonly headerTitle = input('');
  readonly subtitle = input<string>();
}
