import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Grey placeholder shapes shown while content loads. */
@Component({
  selector: 'app-skeleton',
  template: `
    <div class="placeholder-glow" aria-hidden="true">
      @for (line of lineList(); track $index) {
        <span
          class="placeholder d-block rounded mb-2"
          [style.height]="height()"
          [style.width]="line"
        ></span>
      }
    </div>
    <span class="visually-hidden">Loading…</span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonComponent {
  readonly lines = input(3);
  readonly height = input('1rem');

  // Varying widths look more like real content.
  readonly lineList = computed(() =>
    Array.from({ length: this.lines() }, (_, i) => `${[100, 85, 70, 92, 60][i % 5]}%`),
  );
}
