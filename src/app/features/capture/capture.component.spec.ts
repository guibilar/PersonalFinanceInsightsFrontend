import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CaptureComponent } from './capture.component';
import { StatementImportLauncher } from '../../core/data/statement-import-launcher.service';
import { TransactionAddLauncher } from '../../core/data/transaction-add-launcher.service';
import { AuthService } from '../../core/auth/auth.service';
import { readOnlyAuth } from '../../testing/test-auth';

describe('CaptureComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CaptureComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    });
  });

  it('adds a transaction, a document, a task, an item, a person or a quick note, imports statements, and opens the journal', async () => {
    const fixture = TestBed.createComponent(CaptureComponent);
    await fixture.whenStable();
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        'button.capture-action',
      ),
    );

    expect(
      buttons.map((button) => [button.textContent!.trim().split(/\s+/)[0], button.disabled]),
    ).toEqual([
      ['Add', false],
      ['Import', false],
    ]);
    const links = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>(
        'a.capture-action',
      ),
    );
    expect(
      links.map((link) => [
        link.querySelector('.fw-semibold')!.textContent!.trim(),
        link.getAttribute('href'),
      ]),
    ).toEqual([
      ['Add document', '/documents/new'],
      ['Add task', '/tasks/new'],
      ['Add item', '/home/items/new'],
      ['Add person', '/people/new'],
      ['Quick note', '/inbox'],
      ['Write in journal', '/journal'],
    ]);

    buttons[0].click();
    expect(TestBed.inject(TransactionAddLauncher).isOpen()).toBe(true);
    expect(TestBed.inject(StatementImportLauncher).isOpen()).toBe(false);

    buttons[1].click();
    expect(TestBed.inject(StatementImportLauncher).isOpen()).toBe(true);
  });

  it('disables every add action for a read-only user, and says why', async () => {
    TestBed.overrideProvider(AuthService, { useValue: readOnlyAuth() });
    const fixture = TestBed.createComponent(CaptureComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="read-only"]')?.textContent).toContain(
      'This account can only read.',
    );
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button.capture-action'));
    expect(
      buttons.map((button) => [
        button.querySelector('.fw-semibold')!.firstChild!.textContent!.trim(),
        button.disabled,
      ]),
    ).toEqual([
      ['Add transaction', true],
      ['Import statements', true],
      ['Add document', true],
      ['Add task', true],
      ['Add item', true],
      ['Add person', true],
      ['Quick note', true],
      ['Write in journal', true],
    ]);
    expect(root.querySelector('a.capture-action')).toBeNull();
  });
});
