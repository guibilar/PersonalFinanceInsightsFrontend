import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ImportSummary, StatementImportComponent } from './statement-import.component';
import { AccountType } from '../../../core/models/enums/account-type';
import { StatementFormat } from '../../../core/models/enums/statement-format';
import { AccountOutputDto } from '../../../core/models/outputs/account-output-dto';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';

const accounts: AccountOutputDto[] = [
  {
    id: 'a1',
    name: 'Chequing',
    type: AccountType.Chequing,
    format: StatementFormat.Cibc,
    transactionCount: 10,
  },
  {
    id: 'a2',
    name: 'Visa',
    type: AccountType.CreditCard,
    format: StatementFormat.Cibc,
    transactionCount: 5,
  },
];

describe('StatementImportComponent', () => {
  let fixture: ComponentFixture<StatementImportComponent>;
  let component: StatementImportComponent;
  let http: HttpTestingController;
  let imported: ImportSummary[];
  let progressed: number;

  const root = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [StatementImportComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    fixture = TestBed.createComponent(StatementImportComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    imported = [];
    progressed = 0;
    component.imported.subscribe((result) => imported.push(result));
    component.progressed.subscribe(() => progressed++);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  async function loadAccounts(list: AccountOutputDto[] = accounts): Promise<void> {
    TestBed.tick();
    http.expectOne({ method: 'GET', url: '/api/Accounts' }).flush(list);
    await fixture.whenStable();
  }

  function selectFile(...files: File[]): void {
    const input = { files } as unknown as HTMLInputElement;
    component.onFileSelected(input);
  }

  /** Lets the import go on to its next file. */
  const nextFile = () => new Promise((resolve) => setTimeout(resolve));

  function entry(name: string) {
    return component.files().find((f) => f.file.name === name)!;
  }

  function submitButton(): HTMLButtonElement {
    return root().querySelector('button[type=submit]')!;
  }

  function importRequest() {
    return http.expectOne({ method: 'POST', url: '/api/Transaction/Import' });
  }

  it('lists the accounts by name and type', async () => {
    await loadAccounts();

    const options = Array.from(root().querySelectorAll('#import-account option')).map((o) =>
      o.textContent?.trim(),
    );
    expect(options).toEqual(['Select the account', 'Chequing · Chequing', 'Visa · Credit card']);
  });

  it('leaves out accounts without statement files', async () => {
    await loadAccounts([
      ...accounts,
      { ...accounts[0], id: 'a3', name: 'Neo chequing', format: StatementFormat.Manual },
    ]);

    const options = Array.from(root().querySelectorAll('#import-account option')).map((o) =>
      o.textContent!.trim(),
    );
    expect(options).toEqual(['Select the account', 'Chequing · Chequing', 'Visa · Credit card']);
  });

  it('sends to the accounts page when there are none', async () => {
    await loadAccounts([]);

    expect(root().querySelector('#import-account')).toBeNull();
    expect(root().textContent).toContain('You have no accounts yet.');
    expect(root().querySelector('a')!.getAttribute('href')).toBe('/accounts');
  });

  it('needs an account and a file before importing', async () => {
    await loadAccounts();
    expect(submitButton().disabled).toBe(true);

    component.form.controls.accountId.setValue('a1');
    await fixture.whenStable();
    expect(submitButton().disabled).toBe(true);

    selectFile(new File(['x'], 'statement.csv'));
    await fixture.whenStable();
    expect(submitButton().disabled).toBe(false);
  });

  it('rejects files over 5 MB without uploading', async () => {
    await loadAccounts();
    selectFile(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'huge.csv'));

    expect(component.files()).toEqual([]);
    expect(component.fileError()).toContain('5 MB');
  });

  it('uploads into the chosen account and emits the result', async () => {
    await loadAccounts();
    component.form.controls.accountId.setValue('a2');
    selectFile(new File(['x'], 'statement.csv'));

    const done = component.onSubmit();
    expect(component.uploading()).toBe(true);
    const request = importRequest();
    expect((request.request.body as FormData).get('accountId')).toBe('a2');
    request.flush({ read: 3, added: 2, skipped: 1 });
    await done;

    expect(component.uploading()).toBe(false);
    expect(imported).toEqual([{ files: 1, read: 3, added: 2, skipped: 1 }]);
  });

  it('warns when the file looks like another account’s, and imports anyway on request', async () => {
    await loadAccounts();
    component.form.controls.accountId.setValue('a1');
    selectFile(new File(['x'], 'statement.csv'));
    const detail = 'This looks like a credit card export, but Chequing is a chequing account.';

    const done = component.onSubmit();
    importRequest().flush(
      { status: 409, title: 'Account mismatch', detail, code: 'account-mismatch' },
      { status: 409, statusText: 'Conflict' },
    );
    await done;
    await fixture.whenStable();

    expect(entry('statement.csv')).toEqual(
      expect.objectContaining({ state: 'mismatch', message: detail }),
    );
    expect(root().querySelector('li')!.textContent).toContain(detail);
    expect(imported).toEqual([]);

    Array.from(root().querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.trim() === 'Import anyway')!
      .click();
    const retry = importRequest();
    const body = retry.request.body as FormData;
    expect(body.get('accountId')).toBe('a1');
    expect(body.get('confirmed')).toBe('true');
    retry.flush({ read: 3, added: 3, skipped: 0 });
    await fixture.whenStable();

    expect(entry('statement.csv').state).toBe('imported');
    expect(imported).toEqual([{ files: 1, read: 3, added: 3, skipped: 0 }]);
  });

  it('drops the warning when another account is chosen', async () => {
    await loadAccounts();
    component.form.controls.accountId.setValue('a1');
    selectFile(new File(['x'], 'statement.csv'));
    const done = component.onSubmit();
    importRequest().flush(
      { status: 409, detail: 'Most rows are already on Visa.', code: 'account-mismatch' },
      { status: 409, statusText: 'Conflict' },
    );
    await done;

    component.form.controls.accountId.setValue('a2');

    expect(entry('statement.csv')).toEqual({ file: expect.any(File), state: 'waiting' });
  });

  it('shows validation messages from the API', async () => {
    await loadAccounts();
    component.form.controls.accountId.setValue('a2');
    selectFile(new File(['x'], 'statement.csv'));

    const done = component.onSubmit();
    importRequest().flush(
      { status: 400, errors: { file: ['The statement file is empty.'] } },
      { status: 400, statusText: 'Bad Request' },
    );
    await done;

    expect(entry('statement.csv').message).toBe('The statement file is empty.');
    expect(imported).toEqual([]);
  });

  it('shows a generic message for server errors', async () => {
    await loadAccounts();
    component.form.controls.accountId.setValue('a1');
    selectFile(new File(['x'], 'statement.csv'));

    const done = component.onSubmit();
    importRequest().flush(null, { status: 500, statusText: 'Error' });
    await done;

    expect(entry('statement.csv').message).toBe('The import failed. Please try again.');
  });

  it('explains when the server refuses the file as too large', async () => {
    await loadAccounts();
    component.form.controls.accountId.setValue('a1');
    selectFile(new File(['x'], 'statement.csv'));

    const done = component.onSubmit();
    importRequest().flush('<html>413 Request Entity Too Large</html>', {
      status: 413,
      statusText: 'Request Entity Too Large',
    });
    await done;

    expect(entry('statement.csv').message).toBe(
      'The file is too large to upload (the limit is 5 MB).',
    );
  });

  it('imports several files one after another, and sums them up', async () => {
    await loadAccounts();
    component.form.controls.accountId.setValue('a1');
    selectFile(new File(['x'], 'May.pdf'), new File(['y'], 'June.pdf'));
    await fixture.whenStable();
    expect(submitButton().textContent?.trim()).toBe('Import 2 files');

    const done = component.onSubmit();
    const first = importRequest();
    expect((first.request.body as FormData).get('file')).toEqual(
      expect.objectContaining({ name: 'May.pdf' }),
    );
    first.flush({
      read: 1,
      added: 1,
      skipped: 0,
      balance: 900,
      balanceDate: '2026-05-31T00:00:00Z',
    });
    await nextFile();
    const second = importRequest();
    expect((second.request.body as FormData).get('file')).toEqual(
      expect.objectContaining({ name: 'June.pdf' }),
    );
    second.flush({
      read: 4,
      added: 3,
      skipped: 1,
      balance: 1000,
      balanceDate: '2026-06-30T00:00:00Z',
    });
    await done;

    expect(imported).toEqual([
      {
        files: 2,
        read: 5,
        added: 4,
        skipped: 1,
        balance: 1000,
        balanceDate: '2026-06-30T00:00:00Z',
      },
    ]);
  });

  it('holds the account while files are on their way to it', async () => {
    await loadAccounts();
    component.form.controls.accountId.setValue('a1');
    selectFile(new File(['x'], 'May.pdf'));
    const done = component.onSubmit();
    await fixture.whenStable();
    expect(component.form.controls.accountId.disabled).toBe(true);

    importRequest().flush({ read: 1, added: 1, skipped: 0 });
    await done;
    await fixture.whenStable();
    expect(component.form.controls.accountId.enabled).toBe(true);
  });

  it('closed while importing: stops before the next file, and still reloads and says what landed', async () => {
    await loadAccounts();
    const changes = TestBed.inject(DataChangesService);
    const before = changes.version();
    component.form.controls.accountId.setValue('a1');
    selectFile(new File(['x'], 'May.pdf'), new File(['y'], 'June.pdf'));

    const done = component.onSubmit();
    const first = importRequest();
    fixture.destroy();
    first.flush({ read: 2, added: 2, skipped: 0 });
    await done;

    http.expectNone({ method: 'POST', url: '/api/Transaction/Import' });
    expect(imported).toEqual([]);
    expect(changes.version()).toBe(before + 1);
    expect(
      TestBed.inject(ToastService)
        .toasts()
        .map((t) => t.message),
    ).toEqual(['Imported 2 new transactions']);
  });

  it('keeps going past a file it can’t read, and stays open to show which', async () => {
    await loadAccounts();
    component.form.controls.accountId.setValue('a1');
    selectFile(
      new File(['x'], 'scan.pdf'),
      new File(['y'], 'June.pdf'),
      new File(['z'], 'big.csv', {}),
    );

    const done = component.onSubmit();
    importRequest().flush(
      { status: 400, errors: { file: ['This PDF can’t be read.'] } },
      { status: 400, statusText: 'Bad Request' },
    );
    await nextFile();
    importRequest().flush({ read: 2, added: 2, skipped: 0 });
    await nextFile();
    importRequest().flush({ read: 1, added: 0, skipped: 1 });
    await done;
    await fixture.whenStable();

    expect(component.files().map((f) => f.state)).toEqual(['failed', 'imported', 'imported']);
    expect(imported).toEqual([]);
    expect(progressed).toBe(1);
    expect(root().textContent).toContain('This PDF can’t be read.');
    expect(root().textContent).toContain('2 added');
    expect(submitButton().textContent?.trim()).toBe('Try again');

    const retry = component.onSubmit();
    importRequest().flush({ read: 3, added: 3, skipped: 0 });
    await retry;

    expect(imported).toEqual([{ files: 3, read: 6, added: 5, skipped: 1 }]);
  });

  it('leaves out files over 5 MB, and imports the others', async () => {
    await loadAccounts();
    selectFile(
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'huge.pdf'),
      new File(['x'], 'ok.pdf'),
    );

    expect(component.files().map((f) => f.file.name)).toEqual(['ok.pdf']);
    expect(component.fileError()).toBe('Left out, larger than 5 MB: huge.pdf.');
  });
});
