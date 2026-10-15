import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { PersonDetailsInputDto } from '../../../core/models/inputs/people-input-dto';
import { PersonDto } from '../../../core/models/outputs/people-output-dto';
import { PEOPLE_LIMITS, REMINDER_CHOICES, groupLabel, parseGroups } from '../people';

export type PersonForm = FormGroup<{
  name: FormControl<string>;
  nickname: FormControl<string>;
  relationship: FormControl<string>;
  /** Typed as "Family, gaming group". */
  groups: FormControl<string>;
  /** 1 to 12, or null for no birthday. */
  birthMonth: FormControl<number | null>;
  birthDay: FormControl<number | null>;
  birthYear: FormControl<number | null>;
  email: FormControl<string>;
  phone: FormControl<string>;
  /** Days, or null for no reminder. */
  contactEveryDays: FormControl<number | null>;
  notes: FormControl<string>;
}>;

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function groupsValidator(control: AbstractControl<string>): ValidationErrors | null {
  const groups = parseGroups(control.value ?? '');
  if (groups.length > PEOPLE_LIMITS.groups) return { tooManyGroups: true };
  if (groups.some((group) => group.length > PEOPLE_LIMITS.group || group.includes('|'))) {
    return { badGroup: true };
  }
  return null;
}

/** Month and day both or neither; a day that the month has (February 29 only without a year or in a leap year). */
function birthdayValidator(control: AbstractControl): ValidationErrors | null {
  const {
    birthMonth: month,
    birthDay: day,
    birthYear: year,
  } = control.value as {
    birthMonth: number | null;
    birthDay: number | null;
    birthYear: number | null;
  };
  if (month === null && day === null) return year === null ? null : { birthday: true };
  if (month === null || day === null) return { birthday: true };
  const max = new Date(year ?? 2000, month, 0).getDate();
  if (!Number.isInteger(day) || day < 1 || day > max) return { birthday: true };
  if (
    year !== null &&
    (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear())
  ) {
    return { birthday: true };
  }
  return null;
}

function text(max: number, value = '') {
  return new FormControl(value, { nonNullable: true, validators: [Validators.maxLength(max)] });
}

/** The person form, empty for a new person, or with a person's details. */
export function createPersonForm(person?: PersonDto): PersonForm {
  const p = person?.person;
  return new FormGroup(
    {
      name: new FormControl(p?.name ?? '', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.pattern(/\S/),
          Validators.maxLength(PEOPLE_LIMITS.name),
        ],
      }),
      nickname: text(PEOPLE_LIMITS.nickname, p?.nickname ?? ''),
      relationship: text(PEOPLE_LIMITS.relationship, p?.relationship ?? ''),
      groups: new FormControl((p?.groups ?? []).map(groupLabel).join(', '), {
        nonNullable: true,
        validators: [groupsValidator],
      }),
      birthMonth: new FormControl<number | null>(p?.birthday?.month ?? null),
      birthDay: new FormControl<number | null>(p?.birthday?.day ?? null),
      birthYear: new FormControl<number | null>(p?.birthday?.year ?? null),
      email: new FormControl(p?.email ?? '', {
        nonNullable: true,
        validators: [Validators.email, Validators.maxLength(PEOPLE_LIMITS.email)],
      }),
      phone: text(PEOPLE_LIMITS.phone, p?.phone ?? ''),
      contactEveryDays: new FormControl<number | null>(p?.contactEveryDays ?? null, [
        Validators.min(1),
        Validators.max(PEOPLE_LIMITS.contactEveryDays),
      ]),
      notes: text(PEOPLE_LIMITS.notes, person?.notes ?? ''),
    },
    { validators: [birthdayValidator] },
  );
}

function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** The details for the API, from the form. */
export function personDetailsOf(form: PersonForm): PersonDetailsInputDto {
  const v = form.getRawValue();
  return {
    name: v.name.trim(),
    nickname: orNull(v.nickname),
    relationship: orNull(v.relationship),
    groups: parseGroups(v.groups),
    birthday:
      v.birthMonth !== null && v.birthDay !== null
        ? { month: Number(v.birthMonth), day: Number(v.birthDay), year: v.birthYear ?? null }
        : null,
    email: orNull(v.email),
    phone: orNull(v.phone),
    notes: orNull(v.notes),
    contactEveryDays: v.contactEveryDays ? Number(v.contactEveryDays) : null,
  };
}

/** The fields of a person: name, nickname, relationship, groups, birthday, contact, reminder, and notes. */
@Component({
  selector: 'app-person-fields',
  imports: [ReactiveFormsModule],
  template: `
    <div class="row g-3" [formGroup]="form()">
      <div class="col-12 col-md-6">
        <label for="person-name" class="form-label">Name</label>
        <input
          id="person-name"
          type="text"
          class="form-control"
          formControlName="name"
          autocomplete="off"
          [maxlength]="limits.name"
          [class.is-invalid]="form().controls.name.touched && form().controls.name.invalid"
        />
        <div class="invalid-feedback">Enter a name.</div>
      </div>
      <div class="col-6 col-md-3">
        <label for="person-nickname" class="form-label">Nickname</label>
        <input id="person-nickname" type="text" class="form-control" formControlName="nickname" />
      </div>
      <div class="col-6 col-md-3">
        <label for="person-relationship" class="form-label">Relationship</label>
        <input
          id="person-relationship"
          type="text"
          class="form-control"
          placeholder="Friend"
          formControlName="relationship"
        />
      </div>
      <div class="col-12">
        <label for="person-groups" class="form-label">Groups</label>
        <input
          id="person-groups"
          type="text"
          class="form-control"
          placeholder="Family, gaming group"
          formControlName="groups"
          [class.is-invalid]="form().controls.groups.invalid"
        />
        <div class="form-text">Separate groups with commas.</div>
        <div class="invalid-feedback">At most 20 groups of 50 characters, without “|”.</div>
      </div>
      <fieldset class="col-12">
        <legend class="form-label fs-6 mb-2">Birthday</legend>
        <div class="d-flex flex-wrap gap-2">
          <label for="person-birth-month" class="visually-hidden">Month</label>
          <select id="person-birth-month" class="form-select w-auto" formControlName="birthMonth">
            <option [ngValue]="null">Month</option>
            @for (month of months; track month; let i = $index) {
              <option [ngValue]="i + 1">{{ month }}</option>
            }
          </select>
          <label for="person-birth-day" class="visually-hidden">Day</label>
          <input
            id="person-birth-day"
            type="number"
            class="form-control small-number"
            placeholder="Day"
            min="1"
            max="31"
            formControlName="birthDay"
          />
          <label for="person-birth-year" class="visually-hidden">Year (optional)</label>
          <input
            id="person-birth-year"
            type="number"
            class="form-control year-number"
            placeholder="Year (optional)"
            min="1900"
            formControlName="birthYear"
          />
        </div>
        @if (form().hasError('birthday')) {
          <div class="text-danger small mt-1" data-testid="birthday-error">
            Choose a month and a day that exist (the year is optional).
          </div>
        }
      </fieldset>
      <div class="col-12 col-md-6">
        <label for="person-email" class="form-label">Email</label>
        <input
          id="person-email"
          type="email"
          class="form-control"
          formControlName="email"
          [class.is-invalid]="form().controls.email.invalid"
        />
        <div class="invalid-feedback">Enter an email address.</div>
      </div>
      <div class="col-12 col-md-6">
        <label for="person-phone" class="form-label">Phone</label>
        <input id="person-phone" type="tel" class="form-control" formControlName="phone" />
      </div>
      <div class="col-12 col-md-6">
        <label for="person-reminder" class="form-label">Reach-out reminder</label>
        <select id="person-reminder" class="form-select" formControlName="contactEveryDays">
          <option [ngValue]="null">No reminder</option>
          @for (choice of reminders; track choice.days) {
            <option [ngValue]="choice.days">{{ choice.label }}</option>
          }
          @if (customReminder(); as days) {
            <option [ngValue]="days">Every {{ days }} days</option>
          }
        </select>
        <div class="form-text">
          “Needs attention” shows the person when it is time to reach out.
        </div>
      </div>
      <div class="col-12">
        <label for="person-notes" class="form-label">Notes</label>
        <textarea
          id="person-notes"
          class="form-control"
          rows="3"
          formControlName="notes"
          [maxlength]="limits.notes"
        ></textarea>
      </div>
    </div>
  `,
  styles: `
    .small-number {
      width: 6rem;
    }
    .year-number {
      width: 10rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonFieldsComponent {
  readonly form = input.required<PersonForm>();
  readonly limits = PEOPLE_LIMITS;
  readonly months = MONTHS;
  readonly reminders = REMINDER_CHOICES;

  /** A reminder from the server that the choices do not have, so the select keeps it. */
  customReminder(): number | null {
    const days = this.form().controls.contactEveryDays.value;
    return days && !REMINDER_CHOICES.some((choice) => choice.days === days) ? days : null;
  }
}
