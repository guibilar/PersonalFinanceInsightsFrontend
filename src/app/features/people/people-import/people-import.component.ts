import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { PeopleRepository } from '../../../core/api/people-repository';
import { DataChangesService } from '../../../core/data/data-changes.service';
import {
  ImportedPersonDto,
  PeopleImportItemDto,
  PeopleImportResultDto,
} from '../../../core/models/outputs/people-output-dto';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { validationDetail } from '../../../shared/utils/problem-detail';

/** The biggest vCard file that the page sends (the server takes 20 million characters; photos make files big). */
export const MAX_VCARD_BYTES = 20_000_000;

/** The Contact Picker API of Chrome on Android (not in the TypeScript DOM types yet). */
interface ContactInfo {
  name?: string[];
  email?: string[];
  tel?: string[];
}
interface ContactsManager {
  select(properties: string[], options: { multiple: boolean }): Promise<ContactInfo[]>;
}

/** The phone's contact picker, when the browser has one (Chrome on Android). */
export function contactPicker(nav: Navigator = navigator): ContactsManager | null {
  const contacts = (nav as Navigator & { contacts?: ContactsManager }).contacts;
  return contacts && typeof contacts.select === 'function' ? contacts : null;
}

/** People from the contact picker: the first name, email, and phone of each. */
export function fromPicker(contacts: ContactInfo[]): ImportedPersonDto[] {
  return contacts
    .map((c) => ({
      name: c.name?.find((n) => n.trim())?.trim() ?? null,
      email: c.email?.find((e) => e.trim())?.trim() ?? null,
      phone: c.tel?.find((t) => t.trim())?.trim() ?? null,
    }))
    .filter((p) => p.name || p.email || p.phone);
}

/** The names of new details, as the user reads them: "birthday, email". */
const FIELD_NAMES: Record<string, string> = {
  nickname: 'nickname',
  relationship: 'relationship',
  email: 'email',
  phone: 'phone',
  notes: 'notes',
  birthday: 'birthday',
  groups: 'groups',
};

/** One line for a contact of the preview. */
export function actionText(item: PeopleImportItemDto): string {
  switch (item.action) {
    case 'Add':
      return 'New person';
    case 'Merge':
      return `Adds ${item.newFields.map((f) => FIELD_NAMES[f] ?? f).join(', ')} to ${item.existingName}`;
    case 'Same':
      return `Already here as ${item.existingName}`;
    default:
      return item.reason ?? 'Skipped';
  }
}

/** "Oct 20, 1990" or "Oct 20". */
export function birthdayText(person: ImportedPersonDto): string | null {
  const b = person.birthday;
  if (!b) return null;
  const date = new Date(b.year ?? 2000, b.month - 1, b.day);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(b.year ? { year: 'numeric' } : {}),
  });
}

/**
 * Import contacts (T105): a vCard file (`.vcf`, from a phone, iCloud, or Google Contacts), or the phone's contacts (the
 * Contact Picker of Chrome on Android). The page shows what the import would do (new people, details added to people
 * who are here already, contacts that are the same), and imports the chosen ones.
 */
@Component({
  selector: 'app-people-import',
  imports: [RouterLink, IconComponent],
  templateUrl: './people-import.component.html',
  styleUrl: './people-import.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeopleImportComponent {
  private readonly repository = inject(PeopleRepository);
  private readonly dataChanges = inject(DataChangesService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  readonly canWrite = inject(AuthService).canWrite;

  readonly picker = contactPicker();
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly dragging = signal(false);
  /** The contacts as sent (one of the two), and the preview of the server. */
  private readonly source = signal<{ vCard?: string; people?: ImportedPersonDto[] } | null>(null);
  readonly preview = signal<PeopleImportResultDto | null>(null);
  readonly chosen = signal<ReadonlySet<number>>(new Set());

  /** The contacts that an import can change: new people and merges. */
  readonly choosable = computed(
    () => this.preview()?.people.filter((p) => p.action === 'Add' || p.action === 'Merge') ?? [],
  );
  readonly chosenCount = computed(() => this.chosen().size);
  readonly allChosen = computed(
    () => this.choosable().length > 0 && this.chosenCount() === this.choosable().length,
  );

  readonly actionText = actionText;

  /** "ana@example.com · +1 403 555 0199 · Oct 20, 1990". */
  details(person: ImportedPersonDto): string {
    return [person.email, person.phone, birthdayText(person)].filter((part) => !!part).join(' · ');
  }

  async chooseFile(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (file) await this.readFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) await this.readFile(file);
  }

  private async readFile(file: File): Promise<void> {
    if (file.size > MAX_VCARD_BYTES) {
      this.error.set('The file is too big (at most 20 MB).');
      return;
    }
    this.load({ vCard: await file.text() });
  }

  async fromPhone(): Promise<void> {
    if (!this.picker) return;
    try {
      const contacts = await this.picker.select(['name', 'email', 'tel'], { multiple: true });
      const people = fromPicker(contacts);
      if (people.length > 0) this.load({ people });
    } catch {
      this.error.set('The phone did not give the contacts.');
    }
  }

  private load(source: { vCard?: string; people?: ImportedPersonDto[] }): void {
    this.error.set(null);
    this.busy.set(true);
    this.repository.importPeople({ ...source, dryRun: true }).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.source.set(source);
        this.preview.set(result);
        this.chosen.set(new Set(this.choosable().map((p) => p.index)));
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(validationDetail(error, 'Could not read the contacts.'));
      },
    });
  }

  isChosen(index: number): boolean {
    return this.chosen().has(index);
  }

  toggle(index: number): void {
    const next = new Set(this.chosen());
    if (next.has(index)) next.delete(index);
    else next.add(index);
    this.chosen.set(next);
  }

  toggleAll(): void {
    this.chosen.set(this.allChosen() ? new Set() : new Set(this.choosable().map((p) => p.index)));
  }

  startOver(): void {
    this.preview.set(null);
    this.source.set(null);
    this.chosen.set(new Set());
  }

  confirm(): void {
    const source = this.source();
    if (!source || this.chosenCount() === 0) return;
    this.busy.set(true);
    this.repository
      .importPeople({ ...source, dryRun: false, only: [...this.chosen()].sort((a, b) => a - b) })
      .subscribe({
        next: (result) => {
          this.busy.set(false);
          this.dataChanges.changed();
          const parts = [];
          if (result.added)
            parts.push(`${result.added} ${result.added === 1 ? 'person' : 'people'} added`);
          if (result.merged) parts.push(`${result.merged} updated`);
          this.toasts.success(parts.length ? `${parts.join(', ')}.` : 'Nothing to import.');
          void this.router.navigateByUrl('/people');
        },
        error: (error: unknown) => {
          this.busy.set(false);
          this.error.set(validationDetail(error, 'Could not import the contacts.'));
        },
      });
  }
}
