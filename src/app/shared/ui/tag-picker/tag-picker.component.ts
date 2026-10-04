import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { TagRepository } from '../../../core/api/tag-repository';
import { TagReference } from '../../../core/models/outputs/tag-output-dto';
import { TEXT_LIMITS } from '../../../core/models/text-limits';
import { IconComponent } from '../icon/icon.component';
import { conflictDetail, validationDetail } from '../../utils/problem-detail';

/** "Vacation  2026 " as the API keeps it: trimmed, single-spaced. */
function tidy(name: string): string {
  return name.trim().split(/\s+/).join(' ');
}

/**
 * Picks tags for a transaction: removable chips for the chosen ones, and a field that picks a tag by name or,
 * when there is none by that name, adds it.
 */
@Component({
  selector: 'app-tag-picker',
  imports: [IconComponent],
  template: `
    @if (chosen().length > 0) {
      <ul class="list-unstyled d-flex flex-wrap gap-1 mb-2" aria-label="Chosen tags">
        @for (tag of chosen(); track tag.id) {
          <li
            class="badge rounded-pill bg-body-secondary text-body border fw-medium d-inline-flex align-items-center gap-1"
          >
            #{{ tag.name }}
            <button
              type="button"
              class="btn btn-link p-0 lh-1 text-body-secondary"
              [attr.aria-label]="'Remove ' + tag.name"
              title="Remove"
              (click)="remove(tag.id)"
            >
              <app-icon name="close" [size]="12" />
            </button>
          </li>
        }
      </ul>
    }
    <div class="input-group">
      <input
        type="text"
        class="form-control"
        autocomplete="off"
        placeholder="Add a tag"
        [id]="inputId()"
        [attr.list]="inputId() + '-options'"
        [attr.aria-describedby]="error() ? inputId() + '-error' : null"
        [class.is-invalid]="!!error()"
        [attr.maxlength]="maxName"
        [value]="text()"
        [disabled]="adding()"
        (input)="onInput($any($event.target).value)"
        (keydown.enter)="$event.preventDefault(); add()"
      />
      <button
        type="button"
        class="btn btn-outline-secondary"
        [disabled]="!text().trim() || adding()"
        (click)="add()"
      >
        {{ adding() ? 'Adding…' : isNew() ? 'Create' : 'Add' }}
      </button>
    </div>
    <datalist [id]="inputId() + '-options'">
      @for (tag of offered(); track tag.id) {
        <option [value]="tag.name"></option>
      }
    </datalist>
    @if (error(); as error) {
      <div [id]="inputId() + '-error'" class="invalid-feedback d-block">{{ error }}</div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagPickerComponent {
  private readonly tagRepository = inject(TagRepository);

  /** Every tag there is; the page loads them. */
  readonly tags = input<TagReference[]>([]);
  /** The chosen tags' ids. */
  readonly selected = model<string[]>([]);
  readonly inputId = input('tag-picker');

  readonly maxName = TEXT_LIMITS.tagName;
  readonly text = signal('');
  readonly adding = signal(false);
  readonly error = signal<string | null>(null);
  /** Added here, until the page's list has them too. */
  private readonly created = signal<TagReference[]>([]);

  private readonly known = computed(() => {
    const tags = this.tags();
    const ids = new Set(tags.map((t) => t.id));
    return [...tags, ...this.created().filter((t) => !ids.has(t.id))];
  });
  readonly chosen = computed(() => {
    const known = new Map(this.known().map((t) => [t.id, t]));
    return this.selected()
      .map((id) => known.get(id))
      .filter((t): t is TagReference => !!t)
      .sort((a, b) => a.name.localeCompare(b.name));
  });
  readonly offered = computed(() => {
    const selected = new Set(this.selected());
    return this.known().filter((t) => !selected.has(t.id));
  });
  /** What's typed is no tag yet: adding creates it. */
  readonly isNew = computed(() => {
    const name = tidy(this.text());
    return !!name && !this.find(name);
  });

  onInput(value: string): void {
    this.text.set(value);
    this.error.set(null);
  }

  private find(name: string): TagReference | undefined {
    const lower = name.toLowerCase();
    return this.known().find((t) => t.name.toLowerCase() === lower);
  }

  add(): void {
    const name = tidy(this.text());
    if (!name || this.adding()) return;
    const existing = this.find(name);
    if (existing) {
      this.choose(existing);
      return;
    }
    this.adding.set(true);
    this.tagRepository.create({ name }).subscribe({
      next: (tag) => {
        this.adding.set(false);
        this.created.update((created) => [...created, { id: tag.id, name: tag.name }]);
        this.choose(tag);
      },
      error: (error: unknown) => {
        this.adding.set(false);
        this.error.set(conflictDetail(error, validationDetail(error, 'Could not add the tag.')));
      },
    });
  }

  private choose(tag: TagReference): void {
    if (!this.selected().includes(tag.id)) this.selected.update((ids) => [...ids, tag.id]);
    this.text.set('');
    this.error.set(null);
  }

  remove(id: string): void {
    this.selected.update((ids) => ids.filter((x) => x !== id));
  }
}
