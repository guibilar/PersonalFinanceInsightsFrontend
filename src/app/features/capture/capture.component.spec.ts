import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CaptureComponent } from './capture.component';
import { StatementImportLauncher } from '../../core/data/statement-import-launcher.service';

describe('CaptureComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CaptureComponent],
      providers: [provideZonelessChangeDetection()],
    });
  });

  it('imports statements, and shows the other actions as coming soon', async () => {
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
      ['Import', false],
      ['Document', true],
      ['Note', true],
      ['Task', true],
    ]);

    buttons[0].click();
    expect(TestBed.inject(StatementImportLauncher).isOpen()).toBe(true);
  });
});
