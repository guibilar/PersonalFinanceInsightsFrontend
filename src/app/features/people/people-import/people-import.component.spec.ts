import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideLocationMocks } from '@angular/common/testing';
import {
  PeopleImportComponent,
  actionText,
  contactPicker,
  fromPicker,
} from './people-import.component';
import { PeopleImportResultDto } from '../../../core/models/outputs/people-output-dto';
import { provideReadOnlyUser } from '../../../testing/test-auth';

@Component({ template: '' })
class BlankComponent {}

const preview = (dryRun = true): PeopleImportResultDto => ({
  dryRun,
  added: 1,
  merged: 1,
  unchanged: 1,
  skipped: 1,
  people: [
    {
      index: 0,
      action: 'Merge',
      person: {
        name: 'Ana Souza',
        email: 'ana@example.com',
        birthday: { month: 10, day: 20, year: 1990 },
      },
      existingId: 'p1',
      existingName: 'Ana S.',
      matchedBy: 'phone',
      newFields: ['email', 'birthday'],
      reason: null,
    },
    {
      index: 1,
      action: 'Same',
      person: { name: 'Bruno Lima' },
      existingId: 'p2',
      existingName: 'Bruno Lima',
      matchedBy: 'name',
      newFields: [],
      reason: null,
    },
    {
      index: 2,
      action: 'Add',
      person: { name: 'João Gonçalves', phone: '403-555-0123' },
      existingId: null,
      existingName: null,
      matchedBy: null,
      newFields: [],
      reason: null,
    },
    {
      index: 3,
      action: 'Skip',
      person: { name: '' },
      existingId: null,
      existingName: null,
      matchedBy: null,
      newFields: [],
      reason: 'Enter a name.',
    },
  ],
});

describe('PeopleImportComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  const root = () => harness.routeNativeElement as HTMLElement;
  const text = (el: Element) => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
  const byId = <T extends HTMLElement = HTMLElement>(id: string) =>
    root().querySelector<T>(`[data-testid="${id}"]`);

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
    TestBed.tick();
    harness.fixture.detectChanges();
  }

  async function start(extra: unknown[] = []): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'people/import', component: PeopleImportComponent },
          { path: 'people', component: BlankComponent },
        ]),
        provideLocationMocks(),
        ...(extra as []),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/import', PeopleImportComponent);
  }

  async function chooseFile(content: string): Promise<void> {
    const input = byId<HTMLInputElement>('vcf-file')!;
    Object.defineProperty(input, 'files', {
      value: [new File([content], 'contacts.vcf', { type: 'text/vcard' })],
    });
    input.dispatchEvent(new Event('change'));
    await settle();
  }

  /** The request to the import, once the page has read the file (File.text() is asynchronous). */
  async function importRequest() {
    for (let i = 0; i < 100; i++) {
      const found = http.match('/api/people/import');
      if (found.length) return found[0];
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    return http.expectOne('/api/people/import');
  }

  afterEach(() => http.verify());

  it('previews a vCard file, with the new people and the merges chosen, then imports the chosen ones', async () => {
    await start();
    await chooseFile('BEGIN:VCARD\nFN:Ana Souza\nEND:VCARD');

    const request = await importRequest();
    expect(request.request.body).toEqual({
      vCard: 'BEGIN:VCARD\nFN:Ana Souza\nEND:VCARD',
      dryRun: true,
    });
    request.flush(preview());
    await settle();

    const rows = Array.from(byId('preview')!.querySelectorAll('li'));
    expect(rows.map(text)).toEqual([
      'Ana Souza ana@example.com · Oct 20, 1990 Adds email, birthday to Ana S.',
      'Bruno Lima Already here as Bruno Lima',
      'João Gonçalves 403-555-0123 New person',
      '(No name) Enter a name.',
    ]);
    const boxes = Array.from(
      byId('preview')!.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    );
    expect(boxes.map((b) => [b.checked, b.disabled])).toEqual([
      [true, false],
      [false, true],
      [true, false],
      [false, true],
    ]);
    expect(text(byId('confirm')!)).toBe('Import 2 contacts');

    // Not Ana: only João.
    boxes[0].click();
    await settle();
    expect(text(byId('confirm')!)).toBe('Import 1 contact');
    byId('confirm')!.click();
    const done = http.expectOne('/api/people/import');
    expect(done.request.body).toEqual({
      vCard: 'BEGIN:VCARD\nFN:Ana Souza\nEND:VCARD',
      dryRun: false,
      only: [2],
    });
    done.flush({ ...preview(false), added: 1, merged: 0 });
    await settle();
    expect(TestBed.inject(Router).url).toBe('/people');
  });

  it('shows the reason when the server refuses the file', async () => {
    await start();
    await chooseFile('hello');

    (await importRequest()).flush(
      {
        title: 'Bad',
        status: 400,
        errors: { vCard: ['This is not a vCard (.vcf) file: it has no BEGIN:VCARD.'] },
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await settle();

    expect(text(byId('import-error')!)).toContain('This is not a vCard (.vcf) file');
  });

  it('chooses none, then all', async () => {
    await start();
    await chooseFile('BEGIN:VCARD\nEND:VCARD');
    (await importRequest()).flush(preview());
    await settle();

    byId('toggle-all')!.click();
    await settle();
    expect(byId<HTMLButtonElement>('confirm')!.disabled).toBe(true);
    expect(text(byId('toggle-all')!)).toBe('Choose all');
    byId('toggle-all')!.click();
    await settle();
    expect(text(byId('confirm')!)).toBe('Import 2 contacts');
  });

  it('is only for a user who can write', async () => {
    await start([provideReadOnlyUser()]);

    expect(byId('read-only')).not.toBeNull();
    expect(byId('drop-zone')).toBeNull();
  });

  it('reads the contacts of the phone picker', () => {
    expect(
      fromPicker([
        { name: ['Ana Souza', 'Ana'], email: ['', 'ana@example.com'], tel: ['+1 403 555 0199'] },
        { name: [], email: [], tel: [] },
      ]),
    ).toEqual([{ name: 'Ana Souza', email: 'ana@example.com', phone: '+1 403 555 0199' }]);
    expect(contactPicker({} as Navigator)).toBeNull();
    expect(actionText(preview().people[3])).toBe('Enter a name.');
  });
});
