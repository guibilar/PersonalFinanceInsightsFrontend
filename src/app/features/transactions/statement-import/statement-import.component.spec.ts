import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { StatementImportComponent } from './statement-import.component';
import { AccountType } from '../../../core/models/enums/account-type';
import { ImportResultOutputDto } from '../../../core/models/outputs/import-result-output-dto';

describe('StatementImportComponent', () => {
  let fixture: ComponentFixture<StatementImportComponent>;
  let component: StatementImportComponent;
  let http: HttpTestingController;
  let imported: ImportResultOutputDto[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [StatementImportComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
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

  function selectFile(file: File): void {
    const input = { files: [file] } as unknown as HTMLInputElement;
    component.onFileSelected(input);
  }

  function submitButton(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector('button[type=submit]')!;
  }

  it('needs an account and a file before importing', async () => {
    expect(submitButton().disabled).toBe(true);

    component.form.controls.account.setValue(AccountType.Chequing);
    await fixture.whenStable();
    expect(submitButton().disabled).toBe(true);

    selectFile(new File(['x'], 'statement.csv'));
    await fixture.whenStable();
    expect(submitButton().disabled).toBe(false);
  });

  it('rejects files over 5 MB without uploading', () => {
    selectFile(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'huge.csv'));

    expect(component.file()).toBeNull();
    expect(component.fileError()).toContain('5 MB');
  });

  it('uploads and emits the result', () => {
    component.form.controls.account.setValue(AccountType.CreditCard);
    selectFile(new File(['x'], 'statement.csv'));

    component.onSubmit();
    expect(component.uploading()).toBe(true);
    http.expectOne('/api/Transaction/Import').flush({ read: 3, added: 2, skipped: 1 });

    expect(component.uploading()).toBe(false);
    expect(imported).toEqual([{ read: 3, added: 2, skipped: 1 }]);
  });

  it('shows validation messages from the API', () => {
    component.form.controls.account.setValue(AccountType.CreditCard);
    selectFile(new File(['x'], 'statement.csv'));

    component.onSubmit();
    http
      .expectOne('/api/Transaction/Import')
      .flush(
        { status: 400, errors: { file: ['The statement file is empty.'] } },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(component.error()).toBe('The statement file is empty.');
    expect(imported).toEqual([]);
  });

  it('shows a generic message for server errors', () => {
    component.form.controls.account.setValue(AccountType.Savings);
    selectFile(new File(['x'], 'statement.csv'));

    component.onSubmit();
    http.expectOne('/api/Transaction/Import').flush(null, { status: 500, statusText: 'Error' });

    expect(component.error()).toBe('The import failed. Please try again.');
  });

  it('explains when the server refuses the file as too large', () => {
    component.form.controls.account.setValue(AccountType.Savings);
    selectFile(new File(['x'], 'statement.csv'));

    component.onSubmit();
    http.expectOne('/api/Transaction/Import').flush('<html>413 Request Entity Too Large</html>', {
      status: 413,
      statusText: 'Request Entity Too Large',
    });

    expect(component.error()).toBe('The file is too large to upload (the limit is 5 MB).');
  });
});
