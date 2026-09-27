import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-card-wrapper',
  templateUrl: './card-wrapper.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CardWrapperComponent {
  readonly headerTitle = input('');
}
