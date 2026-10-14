import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  inject,
  input,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { TaskDetailsInputDto } from '../../../core/models/inputs/task-input-dto';
import {
  REPEAT_UNITS,
  RepeatMode,
  RepeatUnit,
  TaskSummaryDto,
} from '../../../core/models/outputs/task-output-dto';
import { REPEAT_MODES, TASK_LIMITS, parseTags, unitName } from '../tasks';

export type TaskForm = FormGroup<{
  title: FormControl<string>;
  notes: FormControl<string>;
  /** `yyyy-MM-dd`, or empty. */
  dueOn: FormControl<string>;
  /** Typed as "home, garden". */
  tags: FormControl<string>;
  repeats: FormControl<boolean>;
  every: FormControl<number | null>;
  unit: FormControl<RepeatUnit>;
  mode: FormControl<RepeatMode>;
}>;

/** Values to start a new task with, for example from a document ("Renew …", 14 days before it expires). */
export interface TaskFormStart {
  title?: string;
  dueOn?: string | null;
}

function tagsValidator(control: AbstractControl<string>): ValidationErrors | null {
  const tags = parseTags(control.value ?? '');
  if (tags.length > TASK_LIMITS.tags) return { tooManyTags: true };
  if (tags.some((tag) => tag.length > TASK_LIMITS.tag)) return { tagTooLong: true };
  return null;
}

/** A repeat needs a whole number of units, from 1 to 1000. */
function repeatValidator(group: AbstractControl): ValidationErrors | null {
  const { repeats, every } = group.value as { repeats?: boolean; every?: number | null };
  if (!repeats) return null;
  return every === null ||
    every === undefined ||
    !Number.isInteger(every) ||
    every < 1 ||
    every > TASK_LIMITS.every
    ? { every: true }
    : null;
}

/** The task form, empty (or with start values) for a new task, or with a task's details. */
export function createTaskForm(task?: TaskSummaryDto, start: TaskFormStart = {}): TaskForm {
  return new FormGroup(
    {
      title: new FormControl(task?.title ?? start.title ?? '', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.pattern(/\S/),
          Validators.maxLength(TASK_LIMITS.title),
        ],
      }),
      notes: new FormControl(task?.notes ?? '', {
        nonNullable: true,
        validators: [Validators.maxLength(TASK_LIMITS.notes)],
      }),
      dueOn: new FormControl(task ? (task.dueOn ?? '') : (start.dueOn ?? ''), {
        nonNullable: true,
      }),
      tags: new FormControl((task?.tags ?? []).join(', '), {
        nonNullable: true,
        validators: [tagsValidator],
      }),
      repeats: new FormControl(!!task?.repeat, { nonNullable: true }),
      every: new FormControl<number | null>(task?.repeat?.every ?? 1),
      unit: new FormControl<RepeatUnit>(task?.repeat?.unit ?? 'Weeks', { nonNullable: true }),
      mode: new FormControl<RepeatMode>(task?.repeat?.mode ?? 'FromDueDate', {
        nonNullable: true,
      }),
    },
    { validators: [repeatValidator] },
  );
}

/** The form as the API takes it: trimmed, empty values as null, no repeat when "Repeat" is off. */
export function taskDetailsOf(
  form: TaskForm,
  sortOrder: number | null = null,
): TaskDetailsInputDto {
  const value = form.getRawValue();
  return {
    title: value.title.trim(),
    notes: value.notes.trim() || null,
    dueOn: value.dueOn || null,
    tags: parseTags(value.tags),
    repeat: value.repeats ? { every: value.every ?? 1, unit: value.unit, mode: value.mode } : null,
    sortOrder,
  };
}

let nextId = 0;

/** The fields of a task, for a new task and for an edit. The parent owns the form and the buttons. */
@Component({
  selector: 'app-task-fields',
  imports: [ReactiveFormsModule],
  template: `
    <div class="row g-3" [formGroup]="form()">
      <div class="col-12">
        <label class="form-label" [for]="id + '-title'">Title</label>
        <input
          type="text"
          class="form-control"
          autocomplete="off"
          formControlName="title"
          [id]="id + '-title'"
          [maxlength]="limits.title"
          [class.is-invalid]="form().controls.title.touched && form().controls.title.invalid"
        />
        <div class="invalid-feedback">Give it a title.</div>
      </div>
      <div class="col-12 col-sm-6">
        <label class="form-label" [for]="id + '-due'">Due on</label>
        <input
          type="date"
          class="form-control"
          formControlName="dueOn"
          [id]="id + '-due'"
          [attr.aria-describedby]="id + '-due-help'"
        />
        <div class="form-text" [id]="id + '-due-help'">
          @if (form().controls.repeats.value) {
            Without a date, a repeated task is due today.
          } @else {
            Leave it empty for "some day".
          }
        </div>
      </div>
      <div class="col-12 col-sm-6">
        <label class="form-label" [for]="id + '-tags'">Tags</label>
        <input
          type="text"
          class="form-control"
          autocomplete="off"
          placeholder="home, garden"
          formControlName="tags"
          [id]="id + '-tags'"
          [attr.aria-describedby]="id + '-tags-help'"
          [class.is-invalid]="form().controls.tags.invalid"
        />
        <div class="form-text" [id]="id + '-tags-help'">Separate them with commas.</div>
        <div class="invalid-feedback">
          At most {{ limits.tags }} tags, each up to {{ limits.tag }} characters.
        </div>
      </div>

      <div class="col-12">
        <fieldset class="repeat rounded border p-3" data-testid="repeat">
          <legend class="visually-hidden">Repeat</legend>
          <div class="form-check form-switch mb-0">
            <input
              type="checkbox"
              class="form-check-input"
              role="switch"
              formControlName="repeats"
              [id]="id + '-repeats'"
            />
            <label class="form-check-label" [for]="id + '-repeats'">Repeat</label>
          </div>
          @if (form().controls.repeats.value) {
            <div class="d-flex flex-wrap align-items-center gap-2 mt-3">
              <label class="mb-0" [for]="id + '-every'">Every</label>
              <input
                type="number"
                class="form-control every"
                min="1"
                [max]="limits.every"
                step="1"
                formControlName="every"
                [id]="id + '-every'"
                [class.is-invalid]="form().hasError('every')"
              />
              <label class="visually-hidden" [for]="id + '-unit'">Unit</label>
              <select class="form-select unit" formControlName="unit" [id]="id + '-unit'">
                @for (unit of units; track unit) {
                  <option [value]="unit">{{ unitLabel(unit) }}</option>
                }
              </select>
            </div>
            @if (form().hasError('every')) {
              <div class="small text-danger mt-1" role="alert">
                Repeat every 1 to {{ limits.every }} {{ unitLabel(form().controls.unit.value) }}.
              </div>
            }
            <div class="mt-3 d-flex flex-column gap-2" role="radiogroup" aria-label="Next date">
              @for (option of modes; track option.mode) {
                <div class="form-check">
                  <input
                    type="radio"
                    class="form-check-input"
                    formControlName="mode"
                    [value]="option.mode"
                    [id]="id + '-' + option.mode"
                    [attr.aria-describedby]="id + '-' + option.mode + '-help'"
                  />
                  <label class="form-check-label fw-medium" [for]="id + '-' + option.mode">
                    {{ option.label }}
                  </label>
                  <div class="form-text mt-0" [id]="id + '-' + option.mode + '-help'">
                    {{ option.help }}
                  </div>
                </div>
              }
            </div>
          }
        </fieldset>
      </div>

      <div class="col-12">
        <label class="form-label" [for]="id + '-notes'">Notes</label>
        <textarea
          class="form-control"
          rows="3"
          formControlName="notes"
          [id]="id + '-notes'"
          [maxlength]="limits.notes"
        ></textarea>
      </div>
    </div>
  `,
  styles: `
    .every {
      width: 6rem;
    }
    .unit {
      width: auto;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskFieldsComponent {
  readonly form = input.required<TaskForm>();
  readonly units = REPEAT_UNITS;
  readonly modes = REPEAT_MODES;
  readonly limits = TASK_LIMITS;
  readonly id = `task-fields-${nextId++}`;

  constructor() {
    // The parent marks the fields as touched on a save, and the repeat switch shows more fields: redraw then too.
    const changes = inject(ChangeDetectorRef);
    effect((onCleanup) => {
      const subscription = this.form().events.subscribe(() => changes.markForCheck());
      onCleanup(() => subscription.unsubscribe());
    });
  }

  /** "days" or "day", from the number typed. */
  unitLabel(unit: RepeatUnit): string {
    return unitName(unit, this.form().controls.every.value ?? 2);
  }
}
