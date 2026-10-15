import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { IconComponent, IconName } from '../../../shared/ui/icon/icon.component';

/**
 * A small preview of a document file (T61): the server's thumbnail (the first page of a PDF, or the photo), or the icon
 * of the type when the server has no thumbnail for it (404) or the image does not load.
 */
@Component({
  selector: 'app-document-thumbnail',
  imports: [IconComponent],
  template: `
    @if (failed()) {
      <span class="thumb thumb-icon" data-testid="thumbnail-icon"
        ><app-icon [name]="icon()" [size]="18"
      /></span>
    } @else {
      <img
        class="thumb"
        loading="lazy"
        alt=""
        data-testid="thumbnail"
        [src]="url()"
        (error)="failed.set(true)"
      />
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }
    .thumb {
      width: 2.75rem;
      height: 2.75rem;
      border-radius: var(--bs-border-radius);
      object-fit: cover;
      background: var(--bs-tertiary-bg);
      border: 1px solid var(--bs-border-color-translucent);
    }
    .thumb-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 0;
      background: var(--bs-primary-bg-subtle);
      color: var(--bs-primary-text-emphasis);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentThumbnailComponent {
  /** The thumbnail address (`DocumentRepository.thumbnailUrl`). */
  readonly url = input.required<string>();
  /** The icon when there is no thumbnail. */
  readonly icon = input<IconName>('file-text');

  readonly failed = signal(false);
}
