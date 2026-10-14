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
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ItemDetailsInputDto } from '../../../core/models/inputs/home-input-dto';
import { ItemSummaryDto, RoomDto } from '../../../core/models/outputs/home-output-dto';
import { parseTags } from '../../tasks/tasks';
import { HOME_LIMITS } from '../home';

export type ItemForm = FormGroup<{
  name: FormControl<string>;
  /** A room id, or empty for no room. */
  roomId: FormControl<string>;
  category: FormControl<string>;
  brand: FormControl<string>;
  model: FormControl<string>;
  serialNumber: FormControl<string>;
  quantity: FormControl<number | null>;
  /** `yyyy-MM-dd`, or empty. */
  purchasedOn: FormControl<string>;
  purchasePrice: FormControl<number | null>;
  currentValue: FormControl<number | null>;
  warrantyUntil: FormControl<string>;
  /** Typed as "kitchen, insured". */
  tags: FormControl<string>;
  notes: FormControl<string>;
}>;

/** Values to start a new item with: a room, or the name, price and day of a transaction. */
export interface ItemFormStart {
  name?: string;
  roomId?: string | null;
  purchasedOn?: string | null;
  purchasePrice?: number | null;
}

function tagsValidator(control: AbstractControl<string>): ValidationErrors | null {
  const tags = parseTags(control.value ?? '');
  if (tags.length > HOME_LIMITS.tags) return { tooManyTags: true };
  if (tags.some((tag) => tag.length > HOME_LIMITS.tag)) return { tagTooLong: true };
  return null;
}

/** An amount: empty, or 0 to the limit, with at most 2 decimals. */
const amountValidator: ValidatorFn = (control) => {
  const value = control.value as number | null;
  if (value === null || value === undefined) return null;
  const cents = value * 100;
  return value < 0 || value > HOME_LIMITS.amount || Math.abs(Math.round(cents) - cents) > 1e-6
    ? { amount: true }
    : null;
};

/** A quantity: empty (1), or a whole number from 1 to the limit. */
const quantityValidator: ValidatorFn = (control) => {
  const value = control.value as number | null;
  if (value === null || value === undefined) return null;
  return !Number.isInteger(value) || value < 1 || value > HOME_LIMITS.quantity
    ? { quantity: true }
    : null;
};

function text(max: number) {
  return new FormControl('', { nonNullable: true, validators: [Validators.maxLength(max)] });
}

/** The item form, empty (or with start values) for a new item, or with an item's details. */
export function createItemForm(item?: ItemSummaryDto, start: ItemFormStart = {}): ItemForm {
  const form: ItemForm = new FormGroup({
    name: new FormControl(item?.name ?? start.name ?? '', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/\S/),
        Validators.maxLength(HOME_LIMITS.name),
      ],
    }),
    roomId: new FormControl(item ? (item.roomId ?? '') : (start.roomId ?? ''), {
      nonNullable: true,
    }),
    category: text(HOME_LIMITS.category),
    brand: text(HOME_LIMITS.brand),
    model: text(HOME_LIMITS.model),
    serialNumber: text(HOME_LIMITS.serialNumber),
    quantity: new FormControl<number | null>(item?.quantity ?? 1, [quantityValidator]),
    purchasedOn: new FormControl(item ? (item.purchasedOn ?? '') : (start.purchasedOn ?? ''), {
      nonNullable: true,
    }),
    purchasePrice: new FormControl<number | null>(
      item ? item.purchasePrice : (start.purchasePrice ?? null),
      [amountValidator],
    ),
    currentValue: new FormControl<number | null>(item?.currentValue ?? null, [amountValidator]),
    warrantyUntil: new FormControl(item?.warrantyUntil ?? '', { nonNullable: true }),
    tags: new FormControl((item?.tags ?? []).join(', '), {
      nonNullable: true,
      validators: [tagsValidator],
    }),
    notes: text(HOME_LIMITS.notes),
  });
  if (item) {
    form.patchValue({
      category: item.category ?? '',
      brand: item.brand ?? '',
      model: item.model ?? '',
      serialNumber: item.serialNumber ?? '',
      notes: item.notes ?? '',
    });
  }
  return form;
}

/** The form as the API takes it: trimmed, empty values as null. */
export function itemDetailsOf(form: ItemForm): ItemDetailsInputDto {
  const value = form.getRawValue();
  const orNull = (text: string) => text.trim() || null;
  return {
    name: value.name.trim(),
    roomId: value.roomId || null,
    category: orNull(value.category),
    brand: orNull(value.brand),
    model: orNull(value.model),
    serialNumber: orNull(value.serialNumber),
    quantity: value.quantity ?? 1,
    purchasedOn: value.purchasedOn || null,
    purchasePrice: value.purchasePrice ?? null,
    currentValue: value.currentValue ?? null,
    warrantyUntil: value.warrantyUntil || null,
    notes: orNull(value.notes),
    tags: parseTags(value.tags),
  };
}

let nextId = 0;

/** The fields of an item, for a new item and for an edit. The parent owns the form and the buttons. */
@Component({
  selector: 'app-item-fields',
  imports: [ReactiveFormsModule],
  template: `
    <div class="row g-3" [formGroup]="form()">
      <div class="col-12 col-sm-8">
        <label class="form-label" [for]="id + '-name'">Name</label>
        <input
          type="text"
          class="form-control"
          autocomplete="off"
          formControlName="name"
          [id]="id + '-name'"
          [maxlength]="limits.name"
          [class.is-invalid]="form().controls.name.touched && form().controls.name.invalid"
        />
        <div class="invalid-feedback">Give it a name.</div>
      </div>
      <div class="col-12 col-sm-4">
        <label class="form-label" [for]="id + '-room'">Room</label>
        <select class="form-select" formControlName="roomId" [id]="id + '-room'">
          <option value="">No room</option>
          @for (room of rooms(); track room.id) {
            <option [value]="room.id">{{ room.name }}</option>
          }
        </select>
      </div>
      <div class="col-12 col-sm-6">
        <label class="form-label" [for]="id + '-category'">Category</label>
        <input
          type="text"
          class="form-control"
          placeholder="Appliance, Electronics, Furniture"
          formControlName="category"
          [id]="id + '-category'"
          [maxlength]="limits.category"
        />
      </div>
      <div class="col-12 col-sm-6">
        <label class="form-label" [for]="id + '-brand'">Brand</label>
        <input
          type="text"
          class="form-control"
          formControlName="brand"
          [id]="id + '-brand'"
          [maxlength]="limits.brand"
        />
      </div>
      <div class="col-12 col-sm-6">
        <label class="form-label" [for]="id + '-model'">Model</label>
        <input
          type="text"
          class="form-control"
          formControlName="model"
          [id]="id + '-model'"
          [maxlength]="limits.model"
        />
      </div>
      <div class="col-12 col-sm-6">
        <label class="form-label" [for]="id + '-serial'">Serial number</label>
        <input
          type="text"
          class="form-control"
          autocomplete="off"
          formControlName="serialNumber"
          [id]="id + '-serial'"
          [maxlength]="limits.serialNumber"
        />
      </div>
      <div class="col-6 col-sm-3">
        <label class="form-label" [for]="id + '-quantity'">Quantity</label>
        <input
          type="number"
          class="form-control"
          min="1"
          step="1"
          formControlName="quantity"
          [id]="id + '-quantity'"
          [class.is-invalid]="form().controls.quantity.invalid"
        />
        <div class="invalid-feedback">A whole number, 1 or more.</div>
      </div>
      <div class="col-6 col-sm-3">
        <label class="form-label" [for]="id + '-purchased'">Bought on</label>
        <input
          type="date"
          class="form-control"
          formControlName="purchasedOn"
          [id]="id + '-purchased'"
        />
      </div>
      <div class="col-6 col-sm-3">
        <label class="form-label" [for]="id + '-price'">Price (each)</label>
        <input
          type="number"
          class="form-control"
          min="0"
          step="0.01"
          formControlName="purchasePrice"
          [id]="id + '-price'"
          [class.is-invalid]="form().controls.purchasePrice.invalid"
        />
        <div class="invalid-feedback">An amount, 0 or more, with cents at most.</div>
      </div>
      <div class="col-6 col-sm-3">
        <label class="form-label" [for]="id + '-value'">Value now (each)</label>
        <input
          type="number"
          class="form-control"
          min="0"
          step="0.01"
          formControlName="currentValue"
          [id]="id + '-value'"
          [attr.aria-describedby]="id + '-value-help'"
          [class.is-invalid]="form().controls.currentValue.invalid"
        />
        <div class="form-text" [id]="id + '-value-help'">Empty: the price counts.</div>
        <div class="invalid-feedback">An amount, 0 or more, with cents at most.</div>
      </div>
      <div class="col-12 col-sm-6">
        <label class="form-label" [for]="id + '-warranty'">Warranty until</label>
        <input
          type="date"
          class="form-control"
          formControlName="warrantyUntil"
          [id]="id + '-warranty'"
        />
      </div>
      <div class="col-12 col-sm-6">
        <label class="form-label" [for]="id + '-tags'">Tags</label>
        <input
          type="text"
          class="form-control"
          autocomplete="off"
          placeholder="insured, gift"
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
export class ItemFieldsComponent {
  readonly form = input.required<ItemForm>();
  /** The rooms for the room list, in list order. */
  readonly rooms = input<readonly RoomDto[]>([]);
  readonly limits = HOME_LIMITS;
  readonly id = `item-fields-${nextId++}`;

  constructor() {
    // The parent marks the fields as touched on a save: redraw then too.
    const changes = inject(ChangeDetectorRef);
    effect((onCleanup) => {
      const subscription = this.form().events.subscribe(() => changes.markForCheck());
      onCleanup(() => subscription.unsubscribe());
    });
  }
}
