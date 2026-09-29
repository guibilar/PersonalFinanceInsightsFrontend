import {
  ChangeDetectionStrategy,
  Component,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConfirmDialogComponent } from './confirm-dialog.component';

@Component({
  imports: [ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-confirm-dialog
        title="Delete budget?"
        message="It will be gone."
        confirmLabel="Delete"
        [danger]="true"
        (confirmed)="result.set('confirmed'); open.set(false)"
        (cancelled)="result.set('cancelled'); open.set(false)"
      />
    }
  `,
})
class HostComponent {
  readonly open = signal(true);
  readonly result = signal<string | null>(null);
}

describe('ConfirmDialogComponent', () => {
  function setup() {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    return { fixture, host: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('is an alert dialog that starts focus on Cancel', async () => {
    const { fixture, el } = setup();
    await fixture.whenStable();

    const dialog = el.querySelector('dialog[role=alertdialog]')!;
    expect(dialog.matches(':modal')).toBe(true);
    expect(el.querySelector('#' + dialog.getAttribute('aria-labelledby'))?.textContent).toContain(
      'Delete budget?',
    );
    expect(el.querySelector('#' + dialog.getAttribute('aria-describedby'))?.textContent).toContain(
      'It will be gone.',
    );
    expect(document.activeElement?.textContent?.trim()).toBe('Cancel');
    fixture.nativeElement.remove();
  });

  it('confirms with the confirm button', async () => {
    const { fixture, host, el } = setup();
    await fixture.whenStable();

    el.querySelector<HTMLButtonElement>('.btn-danger')!.click();

    expect(host.result()).toBe('confirmed');
    fixture.nativeElement.remove();
  });

  it('cancels on Escape', async () => {
    const { fixture, host, el } = setup();
    await fixture.whenStable();

    // What the browser does on Escape.
    const cancel = new Event('cancel', { cancelable: true });
    el.querySelector('dialog')!.dispatchEvent(cancel);

    expect(cancel.defaultPrevented).toBe(true);
    expect(host.result()).toBe('cancelled');
    fixture.nativeElement.remove();
  });

  it('cancels on a click on the backdrop, but not on the card', async () => {
    const { fixture, host, el } = setup();
    await fixture.whenStable();

    el.querySelector<HTMLElement>('.card')!.click();
    expect(host.result()).toBeNull();
    el.querySelector('dialog')!.click();

    expect(host.result()).toBe('cancelled');
    fixture.nativeElement.remove();
  });
});
