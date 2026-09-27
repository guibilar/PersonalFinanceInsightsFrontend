import {
  ChangeDetectionStrategy,
  Component,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SidePanelComponent } from './side-panel.component';

@Component({
  imports: [SidePanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button id="opener" (click)="open.set(true)">Open</button>
    @if (open()) {
      <app-side-panel title="Edit thing" (closed)="open.set(false)">
        <input id="first-field" />
      </app-side-panel>
    }
  `,
})
class HostComponent {
  readonly open = signal(false);
}

describe('SidePanelComponent', () => {
  function setup() {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    return { fixture, host: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  async function openPanel(fixture: ReturnType<typeof setup>['fixture'], el: HTMLElement) {
    const opener = el.querySelector<HTMLButtonElement>('#opener')!;
    opener.focus();
    opener.click();
    await fixture.whenStable();
  }

  it('is an accessible dialog titled by its heading and focuses the first field', async () => {
    const { fixture, el } = setup();
    await openPanel(fixture, el);

    const dialog = el.querySelector('[role=dialog]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(el.querySelector('#' + dialog.getAttribute('aria-labelledby'))?.textContent).toContain(
      'Edit thing',
    );
    expect(document.activeElement?.id).toBe('first-field');
    fixture.nativeElement.remove();
  });

  it('closes on Escape and gives focus back', async () => {
    const { fixture, host, el } = setup();
    await openPanel(fixture, el);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();

    expect(host.open()).toBeFalse();
    expect(document.activeElement?.id).toBe('opener');
    fixture.nativeElement.remove();
  });

  it('closes on backdrop click', async () => {
    const { fixture, host, el } = setup();
    await openPanel(fixture, el);

    el.querySelector<HTMLElement>('.panel-backdrop')!.click();

    expect(host.open()).toBeFalse();
    fixture.nativeElement.remove();
  });
});
