import {
  ChangeDetectionStrategy,
  Component,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ModalComponent } from './modal.component';

@Component({
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button id="opener" (click)="open.set(true)">Open</button>
    @if (open()) {
      <app-modal title="Edit thing" (closed)="open.set(false)">
        <input id="first-field" />
      </app-modal>
    }
  `,
})
class HostComponent {
  readonly open = signal(false);
}

describe('ModalComponent', () => {
  function setup() {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    return { fixture, host: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  async function openModal(fixture: ReturnType<typeof setup>['fixture'], el: HTMLElement) {
    const opener = el.querySelector<HTMLButtonElement>('#opener')!;
    opener.focus();
    opener.click();
    await fixture.whenStable();
  }

  it('is a modal dialog titled by its heading and focuses the first field', async () => {
    const { fixture, el } = setup();
    await openModal(fixture, el);

    const dialog = el.querySelector('dialog')!;
    expect(dialog.matches(':modal')).toBe(true);
    expect(el.querySelector('#' + dialog.getAttribute('aria-labelledby'))?.textContent).toContain(
      'Edit thing',
    );
    expect(document.activeElement?.id).toBe('first-field');
    fixture.nativeElement.remove();
  });

  it('on a touch screen, focuses the dialog rather than a field', async () => {
    const matchMedia = vi
      .spyOn(window, 'matchMedia')
      .mockImplementation(
        (query) => ({ matches: query === '(pointer: coarse)', media: query }) as MediaQueryList,
      );
    const { fixture, el } = setup();
    await openModal(fixture, el);

    expect(document.activeElement).toBe(el.querySelector('dialog'));
    matchMedia.mockRestore();
    fixture.nativeElement.remove();
  });

  it('closes on Escape and gives focus back', async () => {
    const { fixture, host, el } = setup();
    await openModal(fixture, el);

    // What the browser does on Escape; the dialog must not close itself before its parent removes it.
    const cancel = new Event('cancel', { cancelable: true });
    el.querySelector('dialog')!.dispatchEvent(cancel);
    await fixture.whenStable();

    expect(cancel.defaultPrevented).toBe(true);
    expect(host.open()).toBe(false);
    expect(document.activeElement?.id).toBe('opener');
    fixture.nativeElement.remove();
  });

  it('keeps Tab inside the dialog', async () => {
    const { fixture, el } = setup();
    await openModal(fixture, el);
    const field = el.querySelector<HTMLInputElement>('#first-field')!;
    const close = el.querySelector<HTMLButtonElement>('.btn-close-modal')!;
    const tab = (target: HTMLElement, shiftKey = false) =>
      target.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }),
      );

    expect(document.activeElement).toBe(field);
    tab(field); // last focusable: wraps to the first (the close button)
    expect(document.activeElement).toBe(close);
    tab(close, true); // Shift+Tab from the first: wraps to the last
    expect(document.activeElement).toBe(field);
    fixture.nativeElement.remove();
  });

  it('closes on a click on the backdrop', async () => {
    const { fixture, host, el } = setup();
    await openModal(fixture, el);
    // A click on the backdrop targets the dialog element itself.
    const backdrop = el.querySelector('dialog')!;

    backdrop.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    backdrop.click();

    expect(host.open()).toBe(false);
    fixture.nativeElement.remove();
  });

  it('stays open when a press inside the dialog is let go over the backdrop', async () => {
    const { fixture, host, el } = setup();
    await openModal(fixture, el);
    const backdrop = el.querySelector('dialog')!;

    // Selecting text in a field and letting go outside the dialog.
    el.querySelector('#first-field')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    backdrop.click();
    // A click on the content never closes it.
    el.querySelector<HTMLElement>('.modal-body-area')!.click();

    expect(host.open()).toBe(true);
    fixture.nativeElement.remove();
  });

  it('stops the page behind it from scrolling while open', async () => {
    const { fixture, host, el } = setup();
    await openModal(fixture, el);
    expect(document.body.style.overflow).toBe('hidden');

    host.open.set(false);
    await fixture.whenStable();

    expect(document.body.style.overflow).toBe('');
    fixture.nativeElement.remove();
  });
});
