import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, map } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { PeopleRepository } from '../../../core/api/people-repository';
import { DataChangesService } from '../../../core/data/data-changes.service';
import {
  GiftIdeaDto,
  InteractionDto,
  LoanDirection,
  LoanDto,
  PERSON_DOCUMENT_LINK,
  PERSON_ITEM_LINK,
  PERSON_TASK_LINK,
  PersonDto,
  PersonLinkDto,
} from '../../../core/models/outputs/people-output-dto';
import { LoanInputDto } from '../../../core/models/inputs/people-input-dto';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { formatDay } from '../../../shared/utils/format';
import { keptValueOf } from '../../../shared/utils/resource-value';
import { transactionLink } from '../../transactions/transaction-list/transaction-list-query';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';
import {
  PersonFieldsComponent,
  createPersonForm,
  personDetailsOf,
} from '../person-fields/person-fields.component';
import {
  CONTACT_KINDS,
  PEOPLE_LIMITS,
  PEOPLE_TODAY,
  birthdayText,
  groupLabel,
  peopleError,
  reminderText,
} from '../people';

/** The quick action that is open: a form under the three buttons. */
export type PersonAction = 'contact' | 'gift' | 'loan' | null;

/** One line of the history: a contact, or a loan (on the day of the loan). Newest first. */
export interface HistoryEntry {
  key: string;
  day: string;
  label: string;
  text: string;
  contact?: InteractionDto;
  loan?: LoanDto;
}

/** A link of the person, with where it opens. */
export interface LinkView {
  link: PersonLinkDto;
  label: string;
  route: string;
  queryParams: Record<string, string>;
}

/**
 * One person: the strip (birthday, last contact, reminder), the quick actions "Log contact", "Gift idea", and "Lend
 * item", the gift ideas as a checklist (a check marks the gift as given today), the open loans with "Returned", the
 * history, the links, edit, and delete.
 */
@Component({
  selector: 'app-person-detail',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MoneyPipe,
    ConfirmDialogComponent,
    ErrorStateComponent,
    IconComponent,
    PersonAvatarComponent,
    PersonFieldsComponent,
    SkeletonComponent,
  ],
  templateUrl: './person-detail.component.html',
  styleUrl: './person-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonDetailComponent {
  private readonly repository = inject(PeopleRepository);
  private readonly dataChanges = inject(DataChangesService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  /** A read-only user (T60) gets no actions, no edit, and no delete. */
  readonly canWrite = inject(AuthService).canWrite;
  readonly today = inject(PEOPLE_TODAY);

  readonly id = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id') ?? '')),
    {
      initialValue: '',
    },
  );

  readonly personResource = rxResource({
    params: () => ({ id: this.id(), version: this.dataChanges.version() }),
    stream: ({ params }) => this.repository.get(params.id),
  });
  readonly person = keptValueOf(this.personResource);
  readonly notFound = computed(() => {
    const error = this.personResource.error() as { status?: number } | undefined;
    return error?.status === 404 || error?.status === 400;
  });

  readonly action = signal<PersonAction>(null);
  readonly editing = signal(false);
  readonly busy = signal(false);
  readonly confirmingDelete = signal(false);
  readonly deletingContact = signal<InteractionDto | null>(null);
  readonly limits = PEOPLE_LIMITS;
  readonly contactKinds = CONTACT_KINDS;

  editForm = createPersonForm();

  readonly contactForm = new FormGroup({
    occurredOn: new FormControl('', { nonNullable: true }),
    kind: new FormControl<string>('Call', { nonNullable: true }),
    note: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(PEOPLE_LIMITS.note)],
    }),
  });

  readonly giftForm = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/\S/),
        Validators.maxLength(PEOPLE_LIMITS.giftTitle),
      ],
    }),
    price: new FormControl<number | null>(null, [
      Validators.min(0),
      Validators.max(PEOPLE_LIMITS.amount),
    ]),
    occasion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(PEOPLE_LIMITS.occasion)],
    }),
  });

  readonly loanForm = new FormGroup({
    itemName: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/\S/),
        Validators.maxLength(PEOPLE_LIMITS.itemName),
      ],
    }),
    direction: new FormControl<LoanDirection>('Lent', { nonNullable: true }),
    dueOn: new FormControl('', { nonNullable: true }),
  });

  readonly openGifts = computed(() =>
    (this.person()?.giftIdeas ?? []).filter((gift) => !gift.givenOn),
  );
  readonly givenGifts = computed(() =>
    (this.person()?.giftIdeas ?? []).filter((gift) => !!gift.givenOn),
  );
  readonly openLoans = computed(() =>
    (this.person()?.loans ?? []).filter((loan) => !loan.returnedOn),
  );

  /** The contacts and the loans, newest first. */
  readonly history = computed<HistoryEntry[]>(() => {
    const person = this.person();
    if (!person) return [];
    const entries: HistoryEntry[] = [
      ...person.interactions.map((contact) => ({
        key: `c-${contact.id}`,
        day: contact.occurredOn,
        label: contact.kind ?? 'Contact',
        text: contact.note ?? '',
        contact,
      })),
      ...person.loans.map((loan) => ({
        key: `l-${loan.id}`,
        day: loan.lentOn,
        label: loan.direction === 'Lent' ? 'Lent' : 'Borrowed',
        text: loan.itemName,
        loan,
      })),
    ];
    return entries.sort((a, b) => b.day.localeCompare(a.day) || a.key.localeCompare(b.key));
  });

  readonly links = computed<LinkView[]>(() =>
    (this.person()?.links ?? []).map((link) => {
      switch (link.kind) {
        case PERSON_DOCUMENT_LINK:
          return { link, label: 'Document', route: `/documents/${link.targetId}`, queryParams: {} };
        case PERSON_TASK_LINK:
          return { link, label: 'Task', route: `/tasks/${link.targetId}`, queryParams: {} };
        case PERSON_ITEM_LINK:
          return {
            link,
            label: 'Home item',
            route: `/home/items/${link.targetId}`,
            queryParams: {},
          };
        default: {
          const target = transactionLink(link.targetId);
          return {
            link,
            label: 'Transaction',
            route: target.route,
            queryParams: target.queryParams as Record<string, string>,
          };
        }
      }
    }),
  );

  groupsText(person: PersonDto): string {
    const parts = [person.person.relationship, ...person.person.groups.map(groupLabel)].filter(
      Boolean,
    );
    return parts.join(' · ');
  }

  birthday(person: PersonDto): string {
    return person.person.birthday ? birthdayText(person.person.birthday) : '—';
  }

  lastContact(person: PersonDto): string {
    return person.person.lastContactOn ? formatDay(person.person.lastContactOn) : '—';
  }

  reminder(person: PersonDto): string {
    return reminderText(person.person.contactEveryDays);
  }

  day(iso: string): string {
    return formatDay(iso);
  }

  toggle(action: PersonAction): void {
    this.action.set(this.action() === action ? null : action);
    this.contactForm.reset({ occurredOn: '', kind: 'Call', note: '' });
    this.giftForm.reset({ title: '', price: null, occasion: '' });
    this.loanForm.reset({ itemName: '', direction: 'Lent', dueOn: '' });
  }

  startEdit(person: PersonDto): void {
    this.editForm = createPersonForm(person);
    this.editing.set(true);
  }

  saveEdit(person: PersonDto): void {
    if (this.busy()) return;
    this.editForm.markAllAsTouched();
    if (this.editForm.invalid) return;
    this.run(
      this.repository.update(person.person.id, personDetailsOf(this.editForm)),
      'Saved',
      'Could not save the person.',
      () => this.editing.set(false),
    );
  }

  logContact(person: PersonDto): void {
    if (this.busy()) return;
    const v = this.contactForm.getRawValue();
    if (v.occurredOn && v.occurredOn > this.today()) {
      this.toasts.error('A contact cannot be in the future.');
      return;
    }
    this.run(
      this.repository.logInteraction(person.person.id, {
        occurredOn: v.occurredOn || null,
        kind: v.kind || null,
        note: v.note.trim() || null,
      }),
      'Logged the contact',
      'Could not log the contact.',
      () => this.action.set(null),
    );
  }

  addGift(person: PersonDto): void {
    if (this.busy()) return;
    this.giftForm.markAllAsTouched();
    if (this.giftForm.invalid) return;
    const v = this.giftForm.getRawValue();
    this.run(
      this.repository.addGift(person.person.id, {
        title: v.title.trim(),
        notes: null,
        price: v.price,
        occasion: v.occasion.trim() || null,
        givenOn: null,
      }),
      'Added the gift idea',
      'Could not add the gift idea.',
      () => this.action.set(null),
    );
  }

  addLoan(person: PersonDto): void {
    if (this.busy()) return;
    this.loanForm.markAllAsTouched();
    if (this.loanForm.invalid) return;
    const v = this.loanForm.getRawValue();
    this.run(
      this.repository.addLoan(person.person.id, {
        itemName: v.itemName.trim(),
        direction: v.direction,
        lentOn: null,
        dueOn: v.dueOn || null,
        returnedOn: null,
        notes: null,
      }),
      v.direction === 'Lent' ? 'Added the lent item' : 'Added the borrowed item',
      'Could not add the loan.',
      () => this.action.set(null),
    );
  }

  /** The checkbox of a gift idea: given today, or (unchecked) back to an idea. */
  toggleGiven(gift: GiftIdeaDto): void {
    if (this.busy()) return;
    const givenOn = gift.givenOn ? null : this.today();
    this.run(
      this.repository.updateGift(gift.id, {
        title: gift.title,
        notes: gift.notes,
        price: gift.price,
        occasion: gift.occasion,
        givenOn,
      }),
      givenOn ? `Marked “${gift.title}” as given` : `“${gift.title}” is an idea again`,
      'Could not change the gift idea.',
    );
  }

  deleteGift(gift: GiftIdeaDto): void {
    this.run(
      this.repository.deleteGift(gift.id),
      `Deleted “${gift.title}”`,
      'Could not delete the gift idea.',
    );
  }

  returned(loan: LoanDto): void {
    if (this.busy()) return;
    const back: LoanInputDto = {
      itemName: loan.itemName,
      direction: loan.direction,
      lentOn: loan.lentOn,
      dueOn: loan.dueOn,
      returnedOn: this.today() < loan.lentOn ? loan.lentOn : this.today(),
      notes: loan.notes,
    };
    this.run(
      this.repository.updateLoan(loan.id, back),
      `“${loan.itemName}” is back`,
      'Could not change the loan.',
    );
  }

  deleteLoan(loan: LoanDto): void {
    this.run(
      this.repository.deleteLoan(loan.id),
      `Deleted “${loan.itemName}”`,
      'Could not delete the loan.',
    );
  }

  confirmDeleteContact(contact: InteractionDto): void {
    this.run(
      this.repository.deleteInteraction(contact.id),
      'Deleted the contact',
      'Could not delete the contact.',
      () => this.deletingContact.set(null),
    );
  }

  unlink(person: PersonDto, view: LinkView): void {
    this.run(
      this.repository.removeLink(person.person.id, view.link.id),
      'Removed the link',
      'Could not remove the link.',
    );
  }

  confirmDelete(person: PersonDto): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.repository.delete(person.person.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.confirmingDelete.set(false);
        this.dataChanges.changed();
        this.toasts.success(`Deleted “${person.person.name}”`);
        void this.router.navigate(['/people']);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.confirmingDelete.set(false);
        this.toasts.error(peopleError(error, 'Could not delete the person.'));
      },
    });
  }

  /** Runs one change: busy while it runs, then a new load of every page (data changes), and a toast. */
  private run<T>(call: Observable<T>, success: string, failure: string, after?: () => void): void {
    this.busy.set(true);
    call.subscribe({
      next: () => {
        this.busy.set(false);
        after?.();
        this.dataChanges.changed();
        this.toasts.success(success);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toasts.error(peopleError(error, failure));
      },
    });
  }
}
