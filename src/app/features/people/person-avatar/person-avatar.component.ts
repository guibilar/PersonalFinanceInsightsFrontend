import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { avatarTone, initialsOf } from '../people';

/** A round badge with the initials of a person, in a colour that comes from the name. Decoration only. */
@Component({
  selector: 'app-person-avatar',
  template: `<span
    class="avatar tone-{{ tone() }}"
    [style.width.px]="size()"
    [style.height.px]="size()"
    [style.font-size.px]="size() * 0.36"
    aria-hidden="true"
    >{{ initials() }}</span
  >`,
  styles: `
    .avatar {
      display: inline-flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      font-weight: 700;
      line-height: 1;
    }
    .tone-0 {
      background: #f6e6ec;
      color: #8a2e52;
    }
    .tone-1 {
      background: #e8eef6;
      color: #2d5287;
    }
    .tone-2 {
      background: #e3f0ee;
      color: #0e6b63;
    }
    .tone-3 {
      background: #ece7f5;
      color: #4f3a80;
    }
    .tone-4 {
      background: #fbebdc;
      color: #9a4f10;
    }
    .tone-5 {
      background: #eeeae3;
      color: #4a463f;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonAvatarComponent {
  readonly name = input.required<string>();
  readonly size = input(40);
  readonly initials = computed(() => initialsOf(this.name()));
  readonly tone = computed(() => avatarTone(this.name()));
}
