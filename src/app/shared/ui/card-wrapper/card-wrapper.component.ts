import { Component, Input} from '@angular/core';

@Component({
  selector: 'app-card-wrapper',
  templateUrl: './card-wrapper.component.html',
})
export class CardWrapperComponent {
  @Input() headerTitle: string = '';
}
