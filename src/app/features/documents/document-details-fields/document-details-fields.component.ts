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
import { DocumentDetailsInputDto } from '../../../core/models/inputs/document-input-dto';
import {
  DOCUMENT_KINDS,
  DocumentKind,
  DocumentSummaryDto,
} from '../../../core/models/outputs/document-output-dto';
import { DOCUMENT_LIMITS, parseTags } from '../documents';

export type DocumentDetailsForm = FormGroup<{
  title: FormControl<string>;
  kind: FormControl<DocumentKind>;
  /** Typed as "kitchen, appliances". */
  tags: FormControl<string>;
  issuedOn: FormControl<string>;
  expiresOn: FormControl<string>;
  notes: FormControl<string>;
}>;

function tagsValidator(control: AbstractControl<string>): ValidationErrors | null {
  const tags = parseTags(control.value ?? '');
  if (tags.length > DOCUMENT_LIMITS.tags) return { tooManyTags: true };
  if (tags.some((tag) => tag.length > DOCUMENT_LIMITS.tag)) return { tagTooLong: true };
  return null;
}

/** The expiry day cannot be before the issue day. */
function datesValidator(group: AbstractControl): ValidationErrors | null {
  const { issuedOn, expiresOn } = group.value as { issuedOn?: string; expiresOn?: string };
  return issuedOn && expiresOn && expiresOn < issuedOn ? { expiresBeforeIssued: true } : null;
}

/** The details form, empty or with a document's details. */
export function createDetailsForm(document?: DocumentSummaryDto): DocumentDetailsForm {
  return new FormGroup(
    {
      title: new FormControl(document?.title ?? '', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.pattern(/\S/),
          Validators.maxLength(DOCUMENT_LIMITS.title),
        ],
      }),
      kind: new FormControl<DocumentKind>(document?.kind ?? 'Other', { nonNullable: true }),
      tags: new FormControl((document?.tags ?? []).join(', '), {
        nonNullable: true,
        validators: [tagsValidator],
      }),
      issuedOn: new FormControl(document?.issuedOn ?? '', { nonNullable: true }),
      expiresOn: new FormControl(document?.expiresOn ?? '', { nonNullable: true }),
      notes: new FormControl(document?.notes ?? '', {
        nonNullable: true,
        validators: [Validators.maxLength(DOCUMENT_LIMITS.notes)],
      }),
    },
    { validators: [datesValidator] },
  );
}

/** The form as the API takes it: trimmed, empty values as null. */
export function detailsOf(form: DocumentDetailsForm): DocumentDetailsInputDto {
  const value = form.getRawValue();
  return {
    title: value.title.trim(),
    kind: value.kind,
    tags: parseTags(value.tags),
    issuedOn: value.issuedOn || null,
    expiresOn: value.expiresOn || null,
    notes: value.notes.trim() || null,
  };
}

let nextId = 0;

/** The fields of a document's details, for the upload and for editing. The parent owns the form and the buttons. */
@Component({
  selector: 'app-document-details-fields',
  imports: [ReactiveFormsModule],
  template: `
    <div class="row g-3" [formGroup]="form()">
      <div class="col-12 col-md-8">
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
      <div class="col-12 col-md-4">
        <label class="form-label" [for]="id + '-kind'">Kind</label>
        <select class="form-select" formControlName="kind" [id]="id + '-kind'">
          @for (kind of kinds; track kind) {
            <option [value]="kind">{{ kind }}</option>
          }
        </select>
      </div>
      <div class="col-12">
        <label class="form-label" [for]="id + '-tags'">Tags</label>
        <input
          type="text"
          class="form-control"
          autocomplete="off"
          placeholder="kitchen, appliances"
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
      <div class="col-6">
        <label class="form-label" [for]="id + '-issued'">Issued on</label>
        <input type="date" class="form-control" formControlName="issuedOn" [id]="id + '-issued'" />
      </div>
      <div class="col-6">
        <label class="form-label" [for]="id + '-expires'">Expires on</label>
        <input
          type="date"
          class="form-control"
          formControlName="expiresOn"
          [id]="id + '-expires'"
          [class.is-invalid]="form().hasError('expiresBeforeIssued')"
        />
        <div class="invalid-feedback">It cannot expire before it was issued.</div>
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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentDetailsFieldsComponent {
  readonly form = input.required<DocumentDetailsForm>();
  readonly kinds = DOCUMENT_KINDS;
  readonly limits = DOCUMENT_LIMITS;
  readonly id = `document-details-${nextId++}`;

  constructor() {
    // The parent marks the fields as touched on a save, and sets values: redraw the errors then too.
    const changes = inject(ChangeDetectorRef);
    effect((onCleanup) => {
      const subscription = this.form().events.subscribe(() => changes.markForCheck());
      onCleanup(() => subscription.unsubscribe());
    });
  }
}
