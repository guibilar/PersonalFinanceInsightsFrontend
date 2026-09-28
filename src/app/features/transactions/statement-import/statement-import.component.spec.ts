import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { StatementImportComponent } from './statement-import.component';
import { AccountType } from '../../../core/models/enums/account-type';
import { AccountOutputDto } from '../../../core/models/outputs/account-output-dto';
import { ImportResultOutputDto } from '../../../core/models/outputs/import-result-output-dto';

const accounts: AccountOutputDto[] = [
  { id: 'a1', name: 'Chequing', type: AccountType.Chequing, transactionCount: 10 },
  { id: 'a2', name: 'Visa', type: AccountType.CreditCard, transactionCount: 5 },
];

describe('StatementImportComponent', () => {
  let fixture: ComponentFixture<StatementImportComponent>;
  let component: StatementImportComponent;
  let http: HttpTestingController;
  let imported: ImportResultOutputDto[];

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
    component.imported.subscribe((result) => imported.push(result));
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  async function loadAccounts(list: AccountOutputDto[] = accounts): Promise<void> {
    TestBed.tick();
    http.expectOne({ method: 'GET', url: '/api/Accounts' }).flush(list);
    await fixture.whenStable();
  }

  function selectFile(file: File): void {
    const input = { files: [file] } as unknown as HTMLInputElement;
    component.onFileSelected(input);
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

    expect(component.file()).toBeNull();
    expect(component.fileError()).toContain('5 MB');
  });

  it('uploads into the chosen account and emits the result', async () => {
    await loadAccounts();
    component.form.controls.accountId.setValue('a2');
    selectFile(new File(['x'], 'statement.csv'));

    component.onSubmit();
    expect(component.uploading()).toBe(true);
    const request = importRequest();
    expect((request.request.body as FormData).get('accountId')).toBe('a2');
    request.flush({ read: 3, added: 2, skipped: 1 });

    expect(component.uploading()).toBe(false);
    expect(imported).toEqual([{ read: 3, added: 2, skipped: 1 }]);
  });

  it('warns when the file looks like another account’s, and imports anyway on request', async () => {
    await loadAccounts();
    component.form.controls.accountId.setValue('a1');
    selectFile(new File(['x'], 'statement.csv'));
    const detail = 'This looks like a credit card export, but Chequing is a chequing account.';

    component.onSubmit();
    importRequest().flush(
      { status: 409, title: 'Account mismatch', detail, code: 'account-mismatch' },
      { status: 409, statusText: 'Conflict' },
    );
    await fixture.whenStable();

    expect(component.mismatch()).toBe(detail);
    expect(component.error()).toBeNull();
    expect(root().querySelector('.alert-warning')!.textContent).toContain(detail);
    expect(imported).toEqual([]);

    Array.from(root().querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.trim() === 'Import anyway')!
      .click();
    const retry = importRequest();
    const body = retry.request.body as FormData;
    expect(body.get('accountId')).toBe('a1');
    expect(body.get('confirmed')).toBe('true');
    retry.flush({ read: 3, added: 3, skipped: 0 });

    expect(component.mismatch()).toBeNull();
    expect(imported).toEqual([{ read: 3, added: 3, skipped: 0 }]);
  });

  it('drops the warning when another account is chosen', async () => {
    await loadAccounts();
    component.form.controls.accountId.setValue('a1');
    selectFile(new File(['x'], 'statement.csv'));
    component.onSubmit();
    importRequest().flush(
      { status: 409, detail: 'Most rows are already on Visa.', code: 'account-mismatch' },
      { status: 409, statusText: 'Conflict' },
    );

    component.form.controls.accountId.setValue('a2');

    expect(component.mismatch()).toBeNull();
  });

  it('shows validation messages from the API', async () => {
    await loadAccounts();
    component.form.controls.accountId.setValue('a2');
    selectFile(new File(['x'], 'statement.csv'));

    component.onSubmit();
    importRequest().flush(
      { status: 400, errors: { file: ['The statement file is empty.'] } },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.error()).toBe('The statement file is empty.');
    expect(imported).toEqual([]);
  });

  it('shows a generic message for server errors', async () => {
    await loadAccounts();
    component.form.controls.accountId.setValue('a1');
    selectFile(new File(['x'], 'statement.csv'));

    component.onSubmit();
    importRequest().flush(null, { status: 500, statusText: 'Error' });

    expect(component.error()).toBe('The import failed. Please try again.');
  });

  it('explains when the server refuses the file as too large', async () => {
    await loadAccounts();
    component.form.controls.accountId.setValue('a1');
    selectFile(new File(['x'], 'statement.csv'));

    component.onSubmit();
    importRequest().flush('<html>413 Request Entity Too Large</html>', {
      status: 413,
      statusText: 'Request Entity Too Large',
    });

    expect(component.error()).toBe('The file is too large to upload (the limit is 5 MB).');
  });
});
